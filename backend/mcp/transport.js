/**
 * Streamable HTTP transport for the ProfilleAI Claude Connector.
 *
 * Mounts a single endpoint `POST /mcp` (and matching GET/DELETE for the
 * MCP session lifecycle). Each MCP session is bound to the auth context
 * resolved at `initialize` time \u2014 every subsequent tool call from
 * Claude reuses that user.
 *
 * Auth strategy: ProfilleAI JWT in `Authorization: Bearer <token>`.
 * Full OAuth 2.1 / dynamic client registration can be layered on later
 * without touching the tool layer (see backend/mcp/auth.js).
 */

const { randomUUID } = require('crypto');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const { buildMcpServer } = require('./server');
const { resolveAuthUser } = require('./auth');

// Per-session state. Sessions are cheap (one transport + one McpServer)
// but they're stateful, so keep them in memory keyed by Mcp-Session-Id.
const sessions = new Map(); // sessionId -> { transport, server, user }

function isInitializeRequest(body) {
  if (!body) return false;
  const items = Array.isArray(body) ? body : [body];
  return items.some(
    (m) => m && typeof m === 'object' && m.method === 'initialize',
  );
}

async function handleMcpRequest(req, res) {
  const sessionId = req.header('mcp-session-id');

  // ---- Existing session ----
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId);
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp] transport error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'MCP transport error' });
    }
    return;
  }

  // ---- New session: must be an initialize call ----
  if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Invalid or missing Mcp-Session-Id. Send an `initialize` request first.',
      },
      id: null,
    });
  }

  // Resolve the ProfilleAI user from the Bearer token at session start.
  const user = await resolveAuthUser(req);

  // No valid token \u2192 challenge with 401 + WWW-Authenticate so Claude's
  // custom-connector client starts the OAuth 2.1 flow (it discovers the
  // authorization server from the protected-resource metadata below).
  if (!user) {
    const apiBase = (process.env.MCP_ISSUER || 'https://api.profilleai.com').replace(/\/$/, '');
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${apiBase}/.well-known/oauth-protected-resource"`,
    );
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authentication required. Connect ProfilleAI in Claude to sign in.' },
      id: null,
    });
  }

  const mcpServer = buildMcpServer({ getUser: async () => user });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newId) => {
      sessions.set(newId, { transport, server: mcpServer, user });
      console.log(`[mcp] session initialized: ${newId} (user=${user?.id || 'anon'})`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      console.log(`[mcp] session closed: ${transport.sessionId}`);
    }
  };

  await mcpServer.connect(transport);

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] init error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP transport error' });
  }
}

/**
 * Mount the MCP endpoint on the given Express app.
 * Call this only when `featureFlags.claudeConnector` is enabled.
 */
function mountMcp(app) {
  // CORS for Claude.ai's web client. We allow only the official origin
  // and explicitly expose the Mcp-Session-Id header so the SDK on the
  // browser side can read it.
  app.use('/mcp', (req, res, next) => {
    const origin = req.header('origin');
    const allowed = ['https://claude.ai', 'https://www.claude.ai'];
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Mcp-Session-Id, mcp-session-id, mcp-protocol-version',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.post('/mcp', handleMcpRequest);
  app.get('/mcp', handleMcpRequest);
  app.delete('/mcp', handleMcpRequest);

  console.log('\ud83e\udd16 MCP connector mounted at POST /mcp (Claude.ai)');
}

module.exports = mountMcp;

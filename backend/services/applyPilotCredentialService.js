const { ApplyPilotCredential } = require('../models');
const { encrypt, decrypt } = require('./harvestService');

function asNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function sanitizeCredential(row) {
  if (!row) return null;
  const c = row.toJSON ? row.toJSON() : row;
  return {
    id: c.id,
    provider: c.provider,
    authType: c.authType,
    label: c.label || null,
    accountIdentifier: c.accountIdentifier || null,
    metadata: c.metadata || {},
    isActive: !!c.isActive,
    lastVerifiedAt: c.lastVerifiedAt || null,
    lastError: c.lastError || null,
    hasSecret: !!c.secretEncrypted,
    updatedAt: c.updatedAt || null,
    createdAt: c.createdAt || null,
  };
}

async function listCredentials(userId) {
  const rows = await ApplyPilotCredential.findAll({
    where: { userId },
    order: [['updatedAt', 'DESC']],
  });
  return rows.map(sanitizeCredential);
}

async function upsertCredential(userId, payload = {}) {
  const provider = asNullableString(payload.provider)?.toLowerCase();
  const authType = asNullableString(payload.authType)?.toLowerCase() || 'password';
  const label = asNullableString(payload.label);
  const accountIdentifier = asNullableString(payload.accountIdentifier);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
    ? payload.metadata
    : {};

  if (!provider) {
    const err = new Error('provider is required');
    err.status = 400;
    throw err;
  }

  let row = null;
  if (payload.id) {
    row = await ApplyPilotCredential.findOne({ where: { id: payload.id, userId } });
    if (!row) {
      const err = new Error('credential_not_found');
      err.status = 404;
      throw err;
    }
  } else {
    row = await ApplyPilotCredential.findOne({
      where: {
        userId,
        provider,
        authType,
        accountIdentifier,
      },
    });
  }

  const secret = asNullableString(payload.secret);
  if (!row && !secret) {
    const err = new Error('secret is required for new credentials');
    err.status = 400;
    throw err;
  }

  if (!row) {
    row = await ApplyPilotCredential.create({
      userId,
      provider,
      authType,
      label,
      accountIdentifier,
      secretEncrypted: encrypt(secret),
      metadata,
      isActive,
      lastError: null,
    });
    return sanitizeCredential(row);
  }

  row.provider = provider;
  row.authType = authType;
  row.label = label;
  row.accountIdentifier = accountIdentifier;
  row.metadata = metadata;
  row.isActive = isActive;
  if (secret) {
    row.secretEncrypted = encrypt(secret);
    row.lastError = null;
  }
  await row.save();
  return sanitizeCredential(row);
}

async function getDecryptedCredential({ userId, provider, authType, accountIdentifier }) {
  const where = {
    userId,
    provider,
    isActive: true,
  };
  if (authType) where.authType = authType;
  if (accountIdentifier) where.accountIdentifier = accountIdentifier;

  const rows = await ApplyPilotCredential.findAll({
    where,
    order: [['updatedAt', 'DESC']],
  });
  if (rows.length === 0) return null;

  // Multi-account warning: when more than one active credential matches
  // and the caller didn't specify accountIdentifier, we silently pick
  // the most-recently-updated one. This is rarely what the user wants
  // when they have e.g. two Greenhouse accounts on different boards.
  // Callers should pass an explicit credentialId via getDecryptedCredentialById
  // (resolved from ApplyPilotApplication.credentialId) when possible.
  if (rows.length > 1 && !accountIdentifier) {
    console.warn(
      `[applypilot] ambiguous credential: user=${userId} provider=${provider} has ${rows.length} active credentials; using most-recent (id=${rows[0].id}). Set ApplyPilotApplication.credentialId to disambiguate.`,
    );
  }

  const row = rows[0];
  return {
    ...sanitizeCredential(row),
    secret: decrypt(row.secretEncrypted),
  };
}

/**
 * Lookup a credential by its primary key, scoped to the user. Used by
 * the submit worker when the application row pinned a specific
 * credential (ApplyPilotApplication.credentialId). Falls through to
 * null if the credential was deleted or deactivated since pinning.
 */
async function getDecryptedCredentialById({ userId, credentialId }) {
  if (!credentialId) return null;
  const row = await ApplyPilotCredential.findOne({
    where: { id: credentialId, userId, isActive: true },
  });
  if (!row) return null;
  return {
    ...sanitizeCredential(row),
    secret: decrypt(row.secretEncrypted),
  };
}

async function markCredentialStatus({ userId, provider, ok, error }) {
  if (!userId || !provider) return null;
  const row = await ApplyPilotCredential.findOne({
    where: { userId, provider, isActive: true },
    order: [['updatedAt', 'DESC']],
  });
  if (!row) return null;

  row.lastVerifiedAt = ok ? new Date() : row.lastVerifiedAt;
  row.lastError = ok ? null : String(error || 'Credential verification failed').slice(0, 2000);
  await row.save();
  return sanitizeCredential(row);
}

module.exports = {
  listCredentials,
  upsertCredential,
  getDecryptedCredential,
  getDecryptedCredentialById,
  markCredentialStatus,
  sanitizeCredential,
};

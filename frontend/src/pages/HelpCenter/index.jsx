import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as SparkleIcon,
  ContactSupport as ContactIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpIcon,
  QuestionAnswer as ChatIcon,
  Send as SendIcon,
  SupportAgent as AgentIcon,
} from '@mui/icons-material';
import { supportAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, GRADIENTS } from '@/designTokens';
import ReactMarkdown from 'react-markdown';

// ─── FAQ content (static, cheap to load, most Qs get answered here) ──
const FAQ = [
  {
    q: 'How do I create my profile?',
    a: 'Go to "Create your profile", then choose one of three ways: upload a resume PDF/DOCX, import from LinkedIn (via the "Save to PDF" option on your own LinkedIn profile), or start from scratch. AI extracts and structures the content for you.',
  },
  {
    q: 'What is ApplyPilot and how do I use it?',
    a: 'ApplyPilot is our Chrome extension that detects job listings on LinkedIn, Greenhouse, Lever, Workday and 20+ other platforms, then auto-tailors your resume and fills out the application form. Install from the Extension page, sign in with your ProfilleAI account, and it works on any job page.',
  },
  {
    q: 'How does resume tailoring work?',
    a: 'Open a job listing (from our jobs page or via the extension) and click "Tailor". AI rewrites your resume to match the job\u2019s keywords, requirements, and tone \u2014 you review the changes before downloading. Free plan gets 3 lifetime tailorings; Pro gets 50/month.',
  },
  {
    q: 'What\u2019s the difference between Free, Pro, and Pro+?',
    a: 'Free is a trial with 1 resume parse and 1 profile enhancement per month. Pro ($14.99/mo) unlocks 20 parses, 30 enhancements, 50 tailorings, and unlimited career suggestions. Pro+ ($29.99/mo) adds ApplyPilot auto-apply (30/week), 200 tailorings, and batch tailoring.',
  },
  {
    q: 'How do I cancel or change my subscription?',
    a: 'Go to Pricing (or your account menu \u2192 Upgrade), and use the "Manage subscription" link to open the Stripe billing portal. You can cancel, switch plans, or update payment there. Cancellation takes effect at the end of your current billing period.',
  },
  {
    q: 'I ran out of AI credits. What now?',
    a: 'Free credits reset each month. If you need more sooner, upgrade to Pro from the Pricing page (or the "Upgrade" pill in the top nav). Pro credits refresh monthly on your billing date.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Open a support ticket via the "Contact support" tab and we\u2019ll process deletion within 30 days per our privacy policy. All your data will be permanently removed.',
  },
  {
    q: 'Something is broken. What do I do?',
    a: 'Try a hard refresh (Cmd/Ctrl + Shift + R) first \u2014 that fixes most stale-cache issues. If it persists, ask the AI assistant in the "Ask AI" tab; if it can\u2019t help, it will offer to open a ticket for our team with the full context.',
  },
];

const TICKET_CATEGORIES = [
  { value: 'bug', label: 'Something\u2019s broken' },
  { value: 'billing', label: 'Billing or subscription' },
  { value: 'account', label: 'Account or login' },
  { value: 'feature', label: 'Feature request' },
  { value: 'question', label: 'How-to question' },
  { value: 'other', label: 'Other' },
];

// Assistant's opening line every session.
const CHAT_GREETING = {
  role: 'assistant',
  content: "Hi! I'm the ProfilleAI support assistant. Ask me anything about profiles, resume tailoring, ApplyPilot, or your subscription. If I can't help, I'll open a ticket for the team.",
};

const HelpCenter = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Deep-link support: /help?tab=contact | ai | faq
  const initialTab = useMemo(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t === 'contact') return 1;
    if (t === 'faq') return 2;
    return 0;
  }, [location.search]);
  const [tab, setTab] = useState(initialTab);

  // ─── AI chat state ─────────────────────────────────────────────────
  const [chat, setChat] = useState([CHAT_GREETING]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    // Autoscroll on new messages / loading state.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, chatLoading]);

  const sendChat = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;
    setInput('');
    setChatError('');
    const nextChat = [...chat, { role: 'user', content: text }];
    setChat(nextChat);
    setChatLoading(true);
    try {
      const { data } = await supportAPI.chat(
        // Skip the greeting when sending to the API — it's already implied
        // by the system prompt on the server.
        nextChat.filter((m) => m !== CHAT_GREETING)
      );
      const reply = data?.message?.trim();
      if (!reply) throw new Error('empty response');
      setChat((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const serverMsg = err?.response?.data?.error;
      setChatError(serverMsg || 'The assistant is temporarily unavailable. Please try again or open a ticket below.');
    } finally {
      setChatLoading(false);
    }
  };

  const escalateToTicket = () => {
    // Jump to the Contact tab and prefill the form with the AI transcript
    // stored in ref state below.
    setTab(1);
  };

  // ─── Ticket form state ─────────────────────────────────────────────
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'question',
    message: '',
  });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState(null); // { id, reference } | null
  const [ticketError, setTicketError] = useState('');

  const submitTicket = async () => {
    setTicketError('');
    setTicketResult(null);
    const { subject, category, message } = ticketForm;
    if (!subject.trim() || subject.trim().length < 3) {
      setTicketError('Please add a short subject (at least 3 characters).');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setTicketError('Please describe the issue in at least 10 characters.');
      return;
    }

    setTicketSubmitting(true);
    try {
      const chatTranscript = chat.filter((m) => m !== CHAT_GREETING);
      const { data } = await supportAPI.createTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
        // Include AI chat only if the user actually used it.
        chatTranscript: chatTranscript.length > 0 ? chatTranscript : undefined,
        source: 'help_center',
      });
      setTicketResult(data?.ticket || { reference: 'submitted' });
      setTicketForm({ subject: '', category: 'question', message: '' });
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg;
      setTicketError(serverMsg || 'Could not send your message. Please try again.');
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      {/* Header */}
      <Box sx={{ mb: { xs: 3, md: 4 }, textAlign: { xs: 'left', md: 'center' } }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.25,
            px: 2,
            py: 0.75,
            borderRadius: '999px',
            background: 'rgba(102,126,234,0.1)',
            color: COLORS.PRIMARY,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          <HelpIcon sx={{ fontSize: 16 }} /> Help center
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: COLORS.TEXT_PRIMARY,
            fontSize: { xs: 26, md: 36 },
            lineHeight: 1.15,
          }}
        >
          How can we help you?
        </Typography>
        <Typography sx={{ color: COLORS.TEXT_SECONDARY, mt: 1, fontSize: { xs: 14, md: 16 } }}>
          Ask the AI assistant, browse common questions, or reach a human on our team.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          borderRadius: '16px',
          border: `1px solid ${COLORS.BORDER_LIGHT}`,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            borderBottom: `1px solid ${COLORS.BORDER_LIGHT}`,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 56, fontSize: 14 },
            '& .Mui-selected': { color: COLORS.PRIMARY },
            '& .MuiTabs-indicator': { background: GRADIENTS.PRIMARY, height: 3 },
          }}
        >
          <Tab icon={<ChatIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Ask AI" />
          <Tab icon={<ContactIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Contact support" />
          <Tab icon={<HelpIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="FAQ" />
        </Tabs>

        {/* ─── Tab 0: Ask AI ────────────────────────────────────────── */}
        {tab === 0 && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              ref={scrollRef}
              sx={{
                minHeight: 320,
                maxHeight: { xs: 380, md: 480 },
                overflowY: 'auto',
                p: { xs: 1.5, md: 2 },
                background: COLORS.BG_LIGHT,
                borderRadius: '12px',
                mb: 2,
              }}
            >
              {chat.map((msg, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    gap: 1.25,
                    mb: 1.75,
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      background: msg.role === 'user' ? GRADIENTS.PRIMARY : COLORS.BG_WHITE,
                      color: msg.role === 'user' ? '#fff' : COLORS.PRIMARY,
                      border: msg.role === 'user' ? 'none' : `1px solid ${COLORS.BORDER_LIGHT}`,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === 'user'
                      ? (user?.firstName?.[0] || 'Y').toUpperCase()
                      : <AgentIcon sx={{ fontSize: 18 }} />}
                  </Avatar>
                  <Box
                    sx={{
                      maxWidth: '82%',
                      background: msg.role === 'user' ? GRADIENTS.PRIMARY : COLORS.BG_WHITE,
                      color: msg.role === 'user' ? '#fff' : COLORS.TEXT_PRIMARY,
                      border: msg.role === 'user' ? 'none' : `1px solid ${COLORS.BORDER_LIGHT}`,
                      p: 1.5,
                      px: 1.75,
                      borderRadius: '14px',
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                      wordBreak: 'break-word',
                      // Trim MUI/browser defaults so the AI's markdown lists
                      // and paragraphs look native inside the bubble.
                      '& p': { margin: '0 0 8px 0' },
                      '& p:last-child': { marginBottom: 0 },
                      '& ol, & ul': { margin: '4px 0 8px 0', paddingLeft: '20px' },
                      '& li': { margin: '2px 0' },
                      '& li > p': { margin: 0 },
                      '& strong': { fontWeight: 700 },
                      '& code': {
                        background: msg.role === 'user' ? 'rgba(255,255,255,0.18)' : COLORS.BG_LIGHT,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      },
                      '& a': {
                        color: msg.role === 'user' ? '#fff' : COLORS.PRIMARY,
                        textDecoration: 'underline',
                      },
                      '& h1, & h2, & h3, & h4': {
                        fontSize: '1.02em',
                        fontWeight: 700,
                        margin: '4px 0 6px 0',
                      },
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        // Downgrade headings + prevent raw HTML to avoid
                        // any surprise from AI-generated tags.
                        components={{
                          h1: ({ node, ...props }) => <div {...props} style={{ fontWeight: 700, fontSize: '1.02em' }} />,
                          h2: ({ node, ...props }) => <div {...props} style={{ fontWeight: 700, fontSize: '1.02em' }} />,
                        }}
                        // react-markdown@10 is HTML-safe by default; no
                        // rehype-raw plugin means any inline HTML in the
                        // AI reply is escaped, not rendered.
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </Box>
                </Box>
              ))}
              {chatLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, ml: 5.25 }}>
                  <CircularProgress size={14} sx={{ color: COLORS.PRIMARY }} />
                  <Typography sx={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>
                    Thinking\u2026
                  </Typography>
                </Box>
              )}
            </Box>

            {chatError && (
              <Alert severity="error" sx={{ mb: 1.5, borderRadius: '10px' }}>
                {chatError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="Ask a question\u2026"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                disabled={chatLoading}
                sx={{
                  '& .MuiOutlinedInput-root': { borderRadius: '12px' },
                }}
              />
              <IconButton
                onClick={sendChat}
                disabled={chatLoading || !input.trim()}
                sx={{
                  background: GRADIENTS.PRIMARY,
                  color: '#fff',
                  width: 48,
                  height: 48,
                  alignSelf: 'flex-end',
                  '&:hover': { background: GRADIENTS.PRIMARY, opacity: 0.9 },
                  '&.Mui-disabled': { background: '#c0c0c0', color: '#fff' },
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: 12, color: COLORS.TEXT_MUTED }}>
                <SparkleIcon sx={{ fontSize: 13, verticalAlign: -2, mr: 0.5, color: COLORS.PRIMARY }} />
                AI answers can be wrong. For account-specific issues, open a ticket.
              </Typography>
              {chat.length > 1 && (
                <Button
                  size="small"
                  onClick={escalateToTicket}
                  sx={{ textTransform: 'none', fontWeight: 600, color: COLORS.PRIMARY }}
                >
                  Open a ticket instead
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* ─── Tab 1: Contact support ───────────────────────────────── */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {ticketResult ? (
              <Alert
                severity="success"
                sx={{ borderRadius: '12px', mb: 2 }}
                action={
                  <Button
                    size="small"
                    onClick={() => setTicketResult(null)}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Send another
                  </Button>
                }
              >
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Thanks — we\u2019ll be in touch.</Typography>
                <Typography sx={{ fontSize: 13 }}>
                  We got your message. Ticket reference:{' '}
                  <Box component="code" sx={{ background: 'rgba(0,0,0,0.06)', px: 0.75, borderRadius: 0.5 }}>
                    {ticketResult.reference || (ticketResult.id || '').slice(0, 8)}
                  </Box>
                  {'. '}A copy is in your inbox at{' '}
                  <b>{user?.email}</b>.
                </Typography>
              </Alert>
            ) : (
              <>
                <Typography sx={{ color: COLORS.TEXT_SECONDARY, fontSize: 14, mb: 2 }}>
                  Reach a human on our team. We reply within 1 business day.
                  {chat.filter((m) => m !== CHAT_GREETING).length > 0 && (
                    <>
                      {' '}Your AI chat transcript will be attached automatically for context.
                    </>
                  )}
                </Typography>

                {ticketError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>
                    {ticketError}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  label="Subject"
                  placeholder="e.g. Can\u2019t download my tailored resume"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  disabled={ticketSubmitting}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <TextField
                  fullWidth
                  select
                  label="Category"
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                  disabled={ticketSubmitting}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  multiline
                  minRows={5}
                  maxRows={12}
                  label="How can we help?"
                  placeholder="Tell us what you were trying to do, what happened, and what you expected."
                  value={ticketForm.message}
                  onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })}
                  disabled={ticketSubmitting}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Replies go to ${user?.email || 'your account email'}`}
                    size="small"
                    sx={{ background: COLORS.BG_LIGHT, color: COLORS.TEXT_SECONDARY, fontSize: 12 }}
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Button
                    onClick={submitTicket}
                    disabled={ticketSubmitting}
                    variant="contained"
                    startIcon={ticketSubmitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SendIcon />}
                    sx={{
                      background: GRADIENTS.PRIMARY,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: '10px',
                      px: 3,
                      '&:hover': { background: GRADIENTS.PRIMARY, opacity: 0.9 },
                      '&.Mui-disabled': { background: '#c0c0c0', color: '#fff' },
                    }}
                  >
                    {ticketSubmitting ? 'Sending\u2026' : 'Send message'}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}

        {/* ─── Tab 2: FAQ ───────────────────────────────────────────── */}
        {tab === 2 && (
          <Box sx={{ p: { xs: 1, md: 2 } }}>
            {FAQ.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ textAlign: 'center', pb: 2 }}>
              <Typography sx={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, mb: 1.5 }}>
                Didn\u2019t find your answer?
              </Typography>
              <Button
                onClick={() => setTab(0)}
                startIcon={<ChatIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: COLORS.PRIMARY,
                  mr: 1,
                }}
              >
                Ask the AI
              </Button>
              <Button
                onClick={() => setTab(1)}
                startIcon={<ContactIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: COLORS.PRIMARY,
                }}
              >
                Contact support
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

// ─── FAQ accordion item ────────────────────────────────────────────
const FaqItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box
      sx={{
        borderBottom: `1px solid ${COLORS.BORDER_LIGHT}`,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); } }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: { xs: 1.5, md: 2 },
          cursor: 'pointer',
          transition: 'background 0.15s ease',
          '&:hover': { background: COLORS.BG_LIGHT },
          '&:focus-visible': {
            outline: `2px solid ${COLORS.PRIMARY}`,
            outlineOffset: -2,
            background: COLORS.BG_LIGHT,
          },
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: { xs: 14, md: 15 }, color: COLORS.TEXT_PRIMARY }}>
          {question}
        </Typography>
        {open ? <ExpandLessIcon sx={{ color: COLORS.TEXT_SECONDARY }} /> : <ExpandMoreIcon sx={{ color: COLORS.TEXT_SECONDARY }} />}
      </Box>
      {open && (
        <Typography
          sx={{
            px: { xs: 1.5, md: 2 },
            pb: 2,
            color: COLORS.TEXT_SECONDARY,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {answer}
        </Typography>
      )}
    </Box>
  );
};

export default HelpCenter;

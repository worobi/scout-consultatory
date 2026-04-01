/**
 * Scout Consultatory – AI Chat Route
 * Supports OpenAI (GPT) and Anthropic (Claude) — switchable via .env
 */

const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

// ── Rate limit chat specifically ──────────────────────────────
const chatLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.CHAT_RATE_LIMIT_MAX) || 30,
  message:  { error: 'Too many chat messages. Try again in a few minutes.' },
  keyGenerator: (req) => req.ip,
});

// ── System prompt ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Scout, the AI assistant for Scout Consultatory — a Michigan-based, veteran-led IT and operations consulting firm founded in 2020.

Your role is to help site visitors understand what Scout Consultatory does, answer questions about services, and help qualify leads.

About Scout Consultatory:
- Founded by Brandon Worobi (Army veteran → logistics → IT → behavioral health → consulting)
- Core services: IT consulting, web development & hosting, workflow automation, CRM/system integrations, fractional CTO services, compliance & documentation, AI adoption for SMBs
- Philosophy: No buzzwords, no fluff. Practical, operational-first thinking.
- Target clients: Small to medium businesses with disorganized systems, fragmented tools, manual processes, outdated infrastructure

Service tiers:
1. Tier 1 – Fix / Clean-Up: Address immediate issues, quick wins
2. Tier 2 – Optimize / Integrate: Connect tools, reduce manual work
3. Tier 3 – Full Overhaul / Automate: End-to-end system redesign + automation

Tone guidelines:
- Direct, confident, slightly informal — like a knowledgeable colleague
- No corporate speak, no buzzword soup
- Real-world language, brief answers
- If they have a problem, acknowledge it and point toward a solution
- If they want to get in touch, encourage them to fill out the contact form

If asked about pricing: explain that it's flexible based on scope, time, and complexity — and encourage them to start a conversation.

Do NOT make up specific pricing numbers. Do NOT promise outcomes you can't guarantee. Keep responses concise — 2-4 sentences max unless a longer answer is genuinely needed.`;

// ── AI call: OpenAI ───────────────────────────────────────────
async function callOpenAI(messages) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model:       process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens:  512,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

// ── AI call: Claude ───────────────────────────────────────────
async function callClaude(messages) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client    = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model:      process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   messages,
  });

  return response.content[0].text;
}

// ── Route: POST /api/chat ─────────────────────────────────────
router.post('/', chatLimit, async (req, res) => {
  const { messages } = req.body;

  // Validate
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }
  if (messages.length > 20) {
    return res.status(400).json({ error: 'Conversation too long. Please start a new chat.' });
  }
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format.' });
    }
    if (msg.content.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 chars).' });
    }
  }

  const provider = (req.body.provider || process.env.AI_PROVIDER || 'openai').toLowerCase();

  try {
    let reply;
    if (provider === 'claude') {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured.');
      reply = await callClaude(messages);
    } else {
      if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured.');
      reply = await callOpenAI(messages);
    }

    res.json({ reply, provider });

  } catch (err) {
    console.error('[CHAT ERROR]', err.message);
    // Fallback: try the other provider
    try {
      let fallbackReply;
      if (provider === 'claude' && process.env.OPENAI_API_KEY) {
        fallbackReply = await callOpenAI(messages);
        return res.json({ reply: fallbackReply, provider: 'openai', fallback: true });
      } else if (provider !== 'claude' && process.env.ANTHROPIC_API_KEY) {
        fallbackReply = await callClaude(messages);
        return res.json({ reply: fallbackReply, provider: 'claude', fallback: true });
      }
    } catch (fallbackErr) {
      console.error('[CHAT FALLBACK ERROR]', fallbackErr.message);
    }

    res.status(500).json({
      error: 'AI service temporarily unavailable. Please try again or use the contact form.',
    });
  }
});

// ── Route: GET /api/chat/status ───────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    openai:    !!process.env.OPENAI_API_KEY,
    claude:    !!process.env.ANTHROPIC_API_KEY,
    provider:  process.env.AI_PROVIDER || 'openai',
  });
});

module.exports = router;

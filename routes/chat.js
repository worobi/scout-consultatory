/**
 * Scout Consultatory – Chat Route
 * Scripted response engine — no external AI APIs required
 * Transcripts emailed to Brandon after each conversation
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const router     = express.Router();

// ── Rate limiting ─────────────────────────────────────────────
const chatLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      40,
  message:  { error: 'Too many messages. Try again in a few minutes.' },
  keyGenerator: (req) => req.ip,
});

// ── Scripted response engine ──────────────────────────────────

function matches(text, keywords) {
  return keywords.some(k => text.includes(k));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getResponse(userMsg, history) {
  const msg  = userMsg.toLowerCase().trim();
  const turn = history.filter(m => m.role === 'user').length;

  // ── Greetings
  if (turn <= 1 && matches(msg, ['hello', 'hi', 'hey', 'howdy', "what's up", 'sup', 'good morning', 'good afternoon'])) {
    return pick([
      "Hey! I'm Scout's assistant. What's going on with your business — anything broken or slowing you down?",
      "Hey, what's up! I'm here to answer questions about what Scout Consultatory does. What are you trying to figure out?",
      "Hi there. I can answer questions about our services, how we work, or pricing. What do you need?",
    ]);
  }

  // ── Pricing
  if (matches(msg, ['price', 'cost', 'how much', 'rate', 'pricing', 'charge', 'fee', 'budget', 'expensive', 'affordable', 'quote'])) {
    return "Pricing is flexible — it depends on scope, time, and complexity. We don't publish fixed rates because every situation is different. What we typically do is run a quick audit first, then put together a short proposal with a few options at different price points. No commitment required to see the numbers. Want to get that started?";
  }

  // ── Services overview
  if (matches(msg, ['what do you do', 'services', 'what can you help', 'what do you offer', 'offerings', 'capabilities'])) {
    return "We cover six main areas: IT consulting, web development & hosting, workflow automation, CRM & system integrations, fractional CTO support, and AI adoption for small businesses. The common thread is fixing systems that are costing you time or money. What area sounds most relevant to you?";
  }

  // ── IT Consulting
  if (matches(msg, ['it consulting', 'it support', 'tech support', 'infrastructure', 'network', 'server', 'hardware', 'software', 'tech stack', 'it issues'])) {
    return "IT consulting is basically: we come in, assess what you have, find what's costing you — whether that's security gaps, outdated software, inefficient setup — and give you a clear plan to fix it. No jargon, no upselling stuff you don't need. Is there a specific tech issue on your end right now?";
  }

  // ── Web development
  if (matches(msg, ['website', 'web dev', 'web design', 'redesign', 'slow site', 'site is', 'landing page', 'wordpress', 'hosting', 'domain'])) {
    return "We build and host sites that are fast, functional, and built to actually convert visitors — not just look nice. We also take over hosting and maintenance so it's not something you have to manage. Is your current site the problem, or are you starting from scratch?";
  }

  // ── Workflow automation
  if (matches(msg, ['automat', 'workflow', 'manual', 'repetitive', 'zapier', 'make.com', 'power automate', 'process', 'time consuming', 'inefficien'])) {
    return "Automation is one of the biggest wins for most small businesses. If your team is manually copying data, sending the same emails, or updating multiple systems by hand — that's all fixable. We map the process, find the bottlenecks, and connect the tools. What's the most repetitive thing your team deals with right now?";
  }

  // ── CRM / Integrations
  if (matches(msg, ['crm', 'salesforce', 'hubspot', 'pipedrive', 'contacts', 'leads', 'pipeline', 'client management', 'customer management', 'integration'])) {
    return "CRM and integration work is a big part of what we do. Whether you need a CRM set up from scratch, an existing one cleaned up and actually used, or your tools connected so data flows automatically — we handle all of it. What does your current setup look like?";
  }

  // ── Fractional CTO
  if (matches(msg, ['fractional cto', 'cto', 'tech leadership', 'tech strategy', 'technology decisions', 'startup', 'scale', 'technical direction'])) {
    return "Fractional CTO means you get senior-level tech strategy and oversight without the full-time salary. Good fit for companies that are growing and need someone making smart technology decisions — but don't need (or can't afford) a full-time hire yet. Is that a gap you're feeling right now?";
  }

  // ── AI adoption
  if (matches(msg, ['ai', 'artificial intelligence', 'chatgpt', 'openai', 'machine learning', 'gpt', 'claude', 'llm', 'ai tool'])) {
    return "We help small businesses actually use AI — not just talk about it. That means deploying the right tools for your specific workflows: automating reports, drafting communications, processing data, building AI-assisted intake systems. Practical stuff that saves real hours. What are you currently doing manually that you wish you weren't?";
  }

  // ── About / Brandon
  if (matches(msg, ['who are you', 'about you', 'background', 'experience', 'veteran', 'brandon', 'founded', 'michigan', 'who is'])) {
    return "Scout Consultatory was founded by Brandon Worobi — Army veteran with a background in logistics, IT, and operations consulting. Started in 2020, based in Michigan. The approach comes from actually working in broken systems and figuring out how to fix them. Want to connect directly with Brandon?";
  }

  // ── Timeline
  if (matches(msg, ['how long', 'timeline', 'turnaround', 'quick', 'fast', 'urgent', 'asap', 'when can'])) {
    return "Depends on scope. A quick audit and proposal can happen within a few days. A small web project or automation build is typically 1–3 weeks. Larger overhauls get scoped before we commit to timelines. What are you working against on your end?";
  }

  // ── Process / how it works
  if (matches(msg, ['how does it work', 'process', 'next step', 'get started', 'what happens', 'first step', 'onboard'])) {
    return "Simple process: you reach out, we take a quick look at what you've got, and put together a short proposal with options. No long discovery phases, no commitment required to see the recommendations. From there you pick what makes sense. Ready to get that going?";
  }

  // ── Contact intent
  if (matches(msg, ['contact', 'reach out', 'talk', 'call', 'email', 'schedule', 'meeting', 'connect', 'phone', 'get in touch'])) {
    return "Best way is to fill out the contact form on this page — it goes straight to Brandon. Or email directly at Brandon@worobi.com. He usually responds same day.";
  }

  // ── Affirmative
  if (matches(msg, ['yes', 'yeah', 'yep', 'sure', 'sounds good', 'interested', 'absolutely', 'definitely', "let's do it"])) {
    return "Great. Use the contact form on this page or email Brandon@worobi.com directly. Give him a quick rundown of what's going on and he'll get back to you — usually same day.";
  }

  // ── Not interested
  if (matches(msg, ['no', 'nope', 'not right now', 'maybe later', 'not interested', 'just browsing', 'just looking'])) {
    return "No problem. If anything changes or you want a second opinion on a tech decision down the road, you know where to find us.";
  }

  // ── Thank you
  if (matches(msg, ['thank', 'thanks', 'appreciate', 'helpful', 'perfect', 'great', 'awesome'])) {
    return pick([
      "Of course. Anything else I can answer before you go?",
      "Anytime. Feel free to reach out via the contact form if you want to get something moving.",
      "Happy to help. The contact form is right on this page if you want to start a conversation with Brandon directly.",
    ]);
  }

  // ── Default fallback
  return pick([
    "Good question — that's probably worth a real conversation rather than a chat window. Hit the contact form on this page or email Brandon@worobi.com and he'll give you a straight answer.",
    "I want to make sure you get a useful answer on that. Best move is to reach out directly — Brandon@worobi.com or the contact form below. He usually responds same day.",
    "That's a bit outside what I can answer here, but it's exactly the kind of thing Brandon would have a direct take on. Use the contact form or shoot him an email at Brandon@worobi.com.",
  ]);
}

// ── Email transporter ─────────────────────────────────────────
function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'localhost',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: false },
  });
}

async function sendTranscript(transcript, ip) {
  const transport = getTransporter();
  if (!transport || transcript.length < 2) return;

  const lines = transcript.map(m =>
    `${m.role === 'user' ? '👤 Visitor' : '🤖 Scout'}: ${m.content}`
  ).join('\n\n');

  const html = `
    <h2 style="font-family:sans-serif;color:#1e3a5f;">Chat Transcript — Scout Consultatory</h2>
    <p style="font-family:sans-serif;color:#666;font-size:13px;">
      ${new Date().toLocaleString()} &nbsp;|&nbsp; IP: ${ip || '—'} &nbsp;|&nbsp; ${transcript.length} messages
    </p>
    <div style="font-family:monospace;font-size:13px;background:#f5f5f5;padding:16px;border-radius:6px;white-space:pre-wrap;">${
      lines.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }</div>
    <p style="font-family:sans-serif;color:#999;font-size:12px;margin-top:16px;">Sent automatically by Scout Consultatory chat widget.</p>`;

  await transport.sendMail({
    from:    `"Scout Site Chat" <${process.env.SMTP_USER}>`,
    to:      process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
    subject: `Chat transcript (${transcript.filter(m=>m.role==='user').length} visitor messages) — ${new Date().toLocaleDateString()}`,
    html,
  });
}

// ── POST /api/chat ────────────────────────────────────────────
router.post('/', chatLimit, async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages array is required.' });
  if (messages.length > 30)
    return res.status(400).json({ error: 'Conversation too long. Start a new chat.' });

  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user' || !last.content)
    return res.status(400).json({ error: 'Last message must be from user.' });
  if (last.content.length > 1000)
    return res.status(400).json({ error: 'Message too long (max 1000 chars).' });

  // Natural typing delay
  await new Promise(r => setTimeout(r, 700 + Math.random() * 500));

  const reply         = getResponse(last.content, messages.slice(0, -1));
  const fullTranscript = [...messages, { role: 'assistant', content: reply }];

  res.json({ reply });

  // Email every 3rd exchange (non-blocking)
  const userTurns = fullTranscript.filter(m => m.role === 'user').length;
  if (userTurns % 3 === 0) {
    sendTranscript(fullTranscript, req.ip).catch(e =>
      console.error('[TRANSCRIPT]', e.message)
    );
  }
});

// ── POST /api/chat/transcript (on chat close) ─────────────────
router.post('/transcript', async (req, res) => {
  const { messages } = req.body;
  if (Array.isArray(messages) && messages.length >= 2) {
    sendTranscript(messages, req.ip).catch(() => {});
  }
  res.json({ ok: true });
});

// ── GET /api/chat/status ──────────────────────────────────────
router.get('/status', (_req, res) => {
  res.json({ status: 'scripted', online: true });
});

module.exports = router;

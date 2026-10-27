/**
 * Scout Consultatory – Lead Capture Route
 * Validates, AI-qualifies, and emails incoming leads
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const validator  = require('validator');
const router     = express.Router();

// ── Rate limit lead submissions ───────────────────────────────
const leadLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max:      5,
  message:  { error: 'Too many submissions. Please wait before trying again.' },
  keyGenerator: (req) => req.ip,
});

// ── Email transporter ─────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── AI lead qualification ─────────────────────────────────────
async function qualifyLead(data) {
  const prompt = `You are an assistant for Scout Consultatory, a veteran-led IT and operations consulting firm.

A new lead just submitted the contact form. Analyze their message and provide:
1. Lead score (1–10, where 10 = highest value potential)
2. Primary need category (choose one: IT Infrastructure, Web Development, Workflow Automation, CRM Integration, Fractional CTO, AI Adoption, General Inquiry)
3. Urgency (Low / Medium / High)
4. Recommended first action (1 short sentence)
5. Suggested response tone (Casual / Professional / Technical)

Lead data:
Name: ${data.name}
Business: ${data.business || 'Not provided'}
Email: ${data.email}
Message: ${data.message}

Respond in JSON format only:
{
  "score": 7,
  "category": "Workflow Automation",
  "urgency": "Medium",
  "firstAction": "Schedule a 30-min discovery call to map current workflow",
  "tone": "Casual"
}`;

  try {
    const provider = process.env.AI_PROVIDER || 'openai';

    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client    = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response  = await client.messages.create({
        model:      process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages:   [{ role: 'user', content: prompt }],
      });
      return JSON.parse(response.content[0].text);

    } else if (process.env.OPENAI_API_KEY) {
      const OpenAI   = require('openai');
      const client   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model:           process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages:        [{ role: 'user', content: prompt }],
        max_tokens:      256,
        temperature:     0.3,
        response_format: { type: 'json_object' },
      });
      return JSON.parse(response.choices[0].message.content);
    }
  } catch (err) {
    console.error('[QUALIFY ERROR]', err.message);
  }
  return null;
}

// ── Send notification email ───────────────────────────────────
async function sendLeadEmail(data, qualification) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Mail transport is not configured.');

  const transport = createTransporter();
  const qualHtml  = qualification ? `
    <div style="background:#f0f4ff;border-left:4px solid #2563eb;padding:12px 16px;margin:16px 0;border-radius:4px;">
      <strong>AI Qualification</strong><br>
      Score: <strong>${qualification.score}/10</strong> |
      Category: <strong>${qualification.category}</strong> |
      Urgency: <strong>${qualification.urgency}</strong><br>
      First Action: ${qualification.firstAction}<br>
      Tone: ${qualification.tone}
    </div>` : '';

  const result = await transport.sendMail({
    from:    `"Scout Consultatory Site" <${process.env.SMTP_USER}>`,
    to:      process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
    subject: `New Lead: ${data.name} — ${qualification?.category || 'General Inquiry'}`,
    html: `
      <h2 style="color:#1e3a5f;font-family:sans-serif;">New Lead from Scout Consultatory</h2>
      ${qualHtml}
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;">
        <tr><td style="padding:8px;color:#666;width:120px;">Name</td><td style="padding:8px;font-weight:600;">${data.name}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Email</td><td style="padding:8px;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
        <tr><td style="padding:8px;color:#666;">Phone</td><td style="padding:8px;">${data.phone || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Business</td><td style="padding:8px;">${data.business || '—'}</td></tr>
        <tr><td style="padding:8px;color:#666;">Service</td><td style="padding:8px;">${data.service || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;vertical-align:top;">Message</td><td style="padding:8px;">${data.message.replace(/\n/g, '<br>')}</td></tr>
        <tr><td style="padding:8px;color:#666;">IP</td><td style="padding:8px;color:#aaa;font-size:12px;">${data._ip || '—'}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;color:#666;">Submitted</td><td style="padding:8px;color:#aaa;font-size:12px;">${new Date().toLocaleString()}</td></tr>
      </table>
    `,
  });
  // SMTP acceptance only: this does not establish inbox delivery or reading.
  if (!Array.isArray(result?.accepted) || result.accepted.length === 0) {
    throw new Error('Mail transport did not confirm an accepted recipient.');
  }
  return result;
}

// ── Route: POST /api/leads ────────────────────────────────────
router.post('/', leadLimit, async (req, res) => {
  const { name, email, phone, business, service, message } = req.body || {};
  if ([name, email, phone, business, service, message].some(value =>
    value != null && typeof value !== 'string')) {
    return res.status(400).json({ errors: ['Form fields must be text.'] });
  }

  // ── Validation
  const errors = [];
  if (!name    || name.trim().length < 2)         errors.push('Name is required.');
  if (!email   || !validator.isEmail(email))       errors.push('Valid email is required.');
  if (!message || message.trim().length < 10)      errors.push('Message must be at least 10 characters.');
  if (name     && name.length > 100)               errors.push('Name too long.');
  if (message  && message.length > 2000)           errors.push('Message too long (max 2000 chars).');
  if (phone    && !validator.isMobilePhone(phone, 'any', { strictMode: false }))
                                                   errors.push('Invalid phone number.');

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const leadData = {
    name:     validator.escape(name.trim()),
    email:    validator.normalizeEmail(email),
    phone:    phone    ? validator.escape(phone.trim())    : null,
    business: business ? validator.escape(business.trim()) : null,
    service:  service  ? validator.escape(service.trim())  : null,
    message:  validator.escape(message.trim()),
    _ip:      req.ip,
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(503).json({
      success: false,
      error: 'The inquiry form is temporarily unavailable. Please email Leadscout@Scoutconsultatory.com directly.',
    });
  }

  // ── Optional AI qualification
  let qualification = null;
  try {
    qualification = await qualifyLead(leadData);
  } catch (_) {}

  // Wait for transport acceptance before reporting success. Do not retry here:
  // a connection failure can leave acceptance uncertain and retrying may duplicate mail.
  try {
    await sendLeadEmail(leadData, qualification);
  } catch (err) {
    console.error('[EMAIL ERROR]', err.code || 'MAIL_ACCEPTANCE_UNCONFIRMED');
    return res.status(502).json({
      success: false,
      error: 'We could not confirm that your inquiry was accepted for sending. Your entries are still here. Please email Leadscout@Scoutconsultatory.com directly.',
    });
  }

  // ── Log to console / could write to DB here
  console.log('[LEAD]', {
    name:    leadData.name,
    email:   leadData.email,
    score:   qualification?.score,
    category: qualification?.category,
  });

  res.json({
    success:  true,
    message:  'Your inquiry was accepted for sending. This does not confirm inbox delivery.',
    submissionStatus: 'accepted_for_sending',
    qualification: qualification ? {
      score:    qualification.score,
      category: qualification.category,
      urgency:  qualification.urgency,
    } : null,
  });
});

module.exports = router;

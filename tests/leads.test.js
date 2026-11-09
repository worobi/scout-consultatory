'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const validator = require('validator');
const source = fs.readFileSync(path.join(__dirname, '../routes/leads.js'), 'utf8');

// Only the route handler is executed: no SMTP connections or AI calls are possible.
function harness(overrides = {}, delivery) {
  const env = {
    SMTP_USER: 'website@example.com', SMTP_PASS: 'TEST-ONLY-NOT-A-CREDENTIAL',
    OPENAI_API_KEY: 'TEST-ONLY-NOT-A-CREDENTIAL',
    ANTHROPIC_API_KEY: 'TEST-ONLY-NOT-A-CREDENTIAL',
    LEAD_QUALIFICATION_ENABLED: 'false', ...overrides,
  };
  const sent = [];
  const transports = [];
  let handler;
  let aiLoads = 0;
  const router = { post(_path, _limit, callback) { handler = callback; } };
  vm.runInNewContext(source, {
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === 'express-rate-limit') return () => (_req, _res, next) => next();
      if (name === 'validator') return validator;
      if (name === 'nodemailer') return { createTransport(options) {
        transports.push(options);
        return { async sendMail(mail) {
          sent.push(mail);
          return delivery ? delivery(mail) : { accepted: [mail.to] };
        } };
      } };
      if (name === 'openai' || name === '@anthropic-ai/sdk') {
        aiLoads++;
        throw new Error('AI disabled in routing tests');
      }
      throw new Error(`Unexpected module ${name}`);
    },
    process: { env }, module: { exports: {} },
    console: { log() {}, error() {} },
  });
  return {
    sent, transports, get aiLoads() { return aiLoads; },
    async submit(body) {
      let status = 200;
      let response;
      const res = { status(n) { status = n; return res; }, json(data) { response = data; return res; } };
      await handler({ body, ip: '192.0.2.1' }, res);
      return { status, body: response };
    },
  };
}
const valid = { name: 'Test Inquiry', email: 'Case.Name+crm@gmail.com', message: 'TEST ONLY: Verify website routing. No service requested.' };

test('legacy/default inquiry goes only to approved CRM with intact Reply-To', async () => {
  const h = harness({ NOTIFY_EMAIL: 'wrong@example.com' });
  const r = await h.submit({ ...valid, to: 'attacker@example.com' });
  assert.equal(r.status, 200);
  assert.equal(r.body.submissionStatus, 'accepted_for_sending');
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, 'leadscout@scoutconsultatory.com');
  assert.equal(h.sent[0].replyTo.address, valid.email);
  assert.equal(h.aiLoads, 0);
});

test('support goes only to helpdesk and never loads AI even when enabled', async () => {
  const h = harness({ LEAD_QUALIFICATION_ENABLED: 'true' });
  const r = await h.submit({ ...valid, requestType: 'support' });
  assert.equal(r.status, 200);
  assert.equal(h.sent[0].to, 'sos@scoutconsultatory.com');
  assert.match(h.sent[0].subject, /^Support Request:/);
  assert.equal(h.aiLoads, 0);
});

test('existing sales qualification stays enabled unless explicitly disabled', async () => {
  const h = harness({ LEAD_QUALIFICATION_ENABLED: undefined });
  await h.submit(valid);
  assert.equal(h.aiLoads, 1);
  assert.equal(h.sent.length, 1);
});

test('465 uses implicit TLS; 587 requires STARTTLS', async () => {
  for (const port of ['465', '587']) {
    const h = harness({ SMTP_PORT: port });
    await h.submit(valid);
    assert.equal(h.transports[0].port, Number(port));
    assert.equal(h.transports[0].secure, port === '465');
    assert.equal(h.transports[0].requireTLS, port !== '465');
  }
});

test('invalid ports fail before any send', async () => {
  for (const port of ['0', '65536', '587junk', '-1', '1.5']) {
    const h = harness({ SMTP_PORT: port });
    const r = await h.submit(valid);
    assert.equal(r.status, 502);
    assert.equal(h.sent.length, 0);
  }
});

test('unknown or malformed routes and invalid fields cannot send', async () => {
  for (const body of [
    { ...valid, requestType: 'anything' }, { ...valid, requestType: '__proto__' },
    { ...valid, requestType: 'toString' }, { ...valid, requestType: {} },
    { ...valid, requestType: null }, { ...valid, name: ' ' },
    { ...valid, email: 'invalid' }, { ...valid, email: 'bad@example.com\r\nBcc: other@example.com' },
    { ...valid, name: [] }, { ...valid, message: 'short' },
  ]) {
    const h = harness();
    const r = await h.submit(body);
    assert.equal(r.status, 400);
    assert.equal(h.sent.length, 0);
    assert.equal(h.aiLoads, 0);
  }
});

test('missing SMTP fails with correct destination before mail or AI', async () => {
  for (const requestType of ['sales', 'support']) {
    const h = harness({ SMTP_PASS: '' });
    const r = await h.submit({ ...valid, requestType });
    assert.equal(r.status, 503);
    assert.match(r.body.error, requestType === 'support' ? /sos@/ : /leadscout@/);
    assert.equal(h.sent.length, 0);
    assert.equal(h.aiLoads, 0);
  }
});

test('no success unless intended recipient accepted, never automatic retry', async () => {
  for (const delivery of [
    async () => ({ accepted: [] }),
    async () => ({ accepted: ['unrelated@example.com'] }),
    async () => { throw new Error('Uncertain timeout'); },
  ]) {
    const h = harness({}, delivery);
    const r = await h.submit({ ...valid, requestType: 'support' });
    assert.equal(r.status, 502);
    assert.equal(r.body.success, false);
    assert.match(r.body.error, /sos@scoutconsultatory.com/);
    assert.equal(h.sent.length, 1);
  }
});

test('message HTML is escaped and email preserves plus-tag reply routing', async () => {
  const h = harness();
  await h.submit({ ...valid, message: '<img src=x onerror=alert(1)> test content' });
  assert.doesNotMatch(h.sent[0].html, /<img/);
  assert.match(h.sent[0].html, /&lt;img/);
  assert.equal(h.sent[0].replyTo.address, valid.email);
});

test('visitor name remains plain in structured headers and escaped in HTML', async () => {
  const name = 'Alex "AJ" O\'Neil & <Co>';
  const h = harness();
  await h.submit({ ...valid, name, requestType: 'support' });
  const mail = h.sent[0];
  assert.equal(mail.from.name, name);
  assert.equal(mail.from.address, 'website@example.com');
  assert.equal(mail.replyTo.name, name);
  assert.equal(mail.replyTo.address, valid.email);
  assert.match(mail.text, /Alex "AJ" O'Neil & <Co>/);
  assert.doesNotMatch(mail.html, /<Co>/);
  assert.match(mail.html, /&amp; &lt;Co&gt;/);
  assert.ok(mail.subject.includes(name));
  // Compile to MIME in memory only, never establish an SMTP connection.
  const nodemailer = require('nodemailer');
  const result = await nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' }).sendMail(mail);
  const mime = result.message.toString();
  assert.match(mime, /From: "Alex \\"AJ\\" O'Neil & <Co>" <website@example.com>/);
  assert.match(mime, /Reply-To: "Alex \\"AJ\\" O'Neil & <Co>"/);
  assert.match(mime, /Case.Name\+crm@gmail.com/);
});
test('control characters in display names fail before any send', async () => {
  for (const name of ['Test\r\nBcc: other@example.com', 'Test\nName', 'Test\tName', 'Test\u0000Name', 'Test\u007fName']) {
    const h = harness();
    const r = await h.submit({ ...valid, name });
    assert.equal(r.status, 400);
    assert.equal(h.sent.length, 0);
  }
});

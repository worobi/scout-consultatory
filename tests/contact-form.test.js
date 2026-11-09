'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/contact.html'), 'utf8');
function setup(fetch, type = 'sales') {
  const handlers = {};
  const field = value => ({ value, setCustomValidity(message) { this.validity = message; } });
  const elements = {
    name: field('Test Inquiry'), email: field('test@example.com'), phone: field(''),
    business: field(''), service: { ...field(''), options: [], querySelectorAll: () => [] },
    message: field('TEST ONLY: Verify form routing.'), requestType: field(type),
  };
  const form = { elements, resets: 0, reportValidity: () => true,
    addEventListener(name, fn) { handlers[name] = fn; }, reset() { this.resets++; } };
  const btnText = { textContent: 'Send Inquiry' };
  const spinner = { hidden: true };
  const button = { disabled: false, querySelector: sel => sel === '.btn__text' ? btnText : spinner };
  const status = { hidden: true, focus() { this.focused = true; } };
  vm.runInNewContext(code, {
    document: {
      getElementById(id) { return { contactForm: form, submitBtn: button, formStatus: status }[id] || null; },
      querySelectorAll: () => [],
    },
    window: { location: { pathname: '/contact.html', search: '', href: 'https://scoutconsultatory.com/contact.html' } },
    URL, URLSearchParams, fetch,
  });
  return { form, button, status, elements, submit: () => handlers.submit({ preventDefault() {} }) };
}

test('HTML exposes only two approved destinations and bumps script version', () => {
  assert.match(html, /name="requestType"/);
  assert.match(html, /value="sales"/);
  assert.match(html, /value="support"/);
  assert.match(html, /mailto:sos@scoutconsultatory.com/);
  assert.match(html, /main.js\?v=form-routing20261109/);
});

test('support selection is posted and success resets once', async () => {
  const calls = [];
  const h = setup(async (url, options) => {
    calls.push({ url, data: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ success: true, message: 'Accepted for sending.' }) };
  }, 'support');
  await h.submit();
  assert.equal(calls[0].url, '/api/leads');
  assert.equal(calls[0].data.requestType, 'support');
  assert.equal(h.form.resets, 1);
  assert.equal(h.button.disabled, false);
  assert.equal(h.status.focused, true);
});

test('a repeated submit during flight sends only once', async () => {
  let release;
  let calls = 0;
  const h = setup(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  const first = h.submit();
  await h.submit();
  assert.equal(calls, 1);
  release({ ok: true, json: async () => ({ success: true }) });
  await first;
  assert.equal(h.form.resets, 1);
});

test('HTTP, malformed JSON, and network failures keep entries without retry', async () => {
  for (const mode of ['http', 'json', 'network']) {
    let calls = 0;
    const h = setup(async () => {
      calls++;
      if (mode === 'network') throw new Error('timeout');
      return { ok: mode === 'json', json: async () => {
        if (mode === 'json') throw new Error('bad JSON');
        return { error: 'Not accepted.' };
      } };
    }, 'support');
    await h.submit();
    assert.equal(calls, 1);
    assert.equal(h.form.resets, 0);
    assert.equal(h.elements.message.value, 'TEST ONLY: Verify form routing.');
    assert.equal(h.button.disabled, false);
    assert.equal(h.status.hidden, false);
    if (mode !== 'http') assert.match(h.status.textContent, /sos@scoutconsultatory.com/);
  }
});

test('legacy cached markup without request type keeps sales as default', async () => {
  let payload;
  const h = setup(async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ success: true }) };
  });
  delete h.elements.requestType;
  await h.submit();
  assert.equal(payload.requestType, 'sales');
});

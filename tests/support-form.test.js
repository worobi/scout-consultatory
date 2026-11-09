'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/js/support.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../public/support.html'), 'utf8');
function harness(fetch) {
  const events = {};
  const field = value => ({ value, setCustomValidity(message) { this.error = message; } });
  const elements = {
    name: field(' Test Person '), email: field(' Test.Person+help@example.com '),
    business: field(' Test Business '), summary: field(' Site not loading '),
    details: field(' The page does not load after signing in. '),
  };
  const button = { disabled: true, textContent: '' };
  const status = { hidden: true, focus() { this.focused = true; } };
  const form = {
    elements, resets: 0, busy: false,
    reportValidity: () => Object.values(elements).every(f => !f.error),
    addEventListener(name, fn) { events[name] = fn; },
    setAttribute() { this.busy = true; }, removeAttribute() { this.busy = false; },
    reset() { this.resets++; events.reset?.(); },
  };
  vm.runInNewContext(source, {
    document: { getElementById: id => ({ supportForm: form, supportSubmit: button, supportStatus: status }[id]) },
    fetch, AbortController, setTimeout, clearTimeout,
  });
  return { form, elements, button, status, input: () => events.input(), submit: () => events.submit({ preventDefault() {} }) };
}
test('support page uses labels, bounded fields, email fallback, and guarded submission', () => {
  assert.match(html, /name="requestType" value="support"/);
  assert.match(html, /id="supportSubmit" disabled/);
  assert.match(html, /mailto:sos@scoutconsultatory.com/);
  assert.match(html, /name="summary"[^>]+maxlength="160"/);
  assert.match(html, /name="details"[^>]+maxlength="1800"/);
  for (const field of ['supportName', 'supportEmail', 'supportSummary', 'supportDetails']) {
    assert.match(html, new RegExp('for="' + field + '"'));
    assert.match(html, new RegExp('id="' + field + '"[^>]+required'));
  }
  for (const page of ['index', 'services', 'about', 'contact', 'support']) {
    const body = fs.readFileSync(path.join(__dirname, '../public/' + page + '.html'), 'utf8');
    assert.match(body.split('<footer')[1], /href="\/support.html">Help desk<\/a>/);
  }
});
test('request is support-only and composes issue plus detail within API limit', async () => {
  let posted;
  const h = harness(async (url, options) => {
    posted = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ success: true, submissionStatus: 'accepted_for_sending' }) };
  });
  await h.submit();
  assert.equal(posted.url, '/api/leads');
  assert.equal(posted.body.requestType, 'support');
  assert.equal(posted.body.name, 'Test Person');
  assert.equal(posted.body.email, 'Test.Person+help@example.com');
  assert.equal(posted.body.message, 'Issue: Site not loading\n\nDetails:\nThe page does not load after signing in.');
  assert.equal(h.form.resets, 1);
  assert.equal(h.form.busy, false);
  assert.equal(h.status.focused, true);
  assert.match(h.status.textContent, /does not confirm inbox delivery/);
  h.elements.summary.value = 'S'.repeat(160);
  h.elements.details.value = 'D'.repeat(1800);
  await h.submit();
  assert.ok(posted.body.message.length <= 2000);
});
test('trimmed empty text does not send', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; });
  for (const key of ['name', 'summary', 'details']) h.elements[key].value = '   ';
  await h.submit();
  assert.equal(calls, 0);
  assert.equal(h.form.resets, 0);
});
test('duplicate click while in flight sends once', async () => {
  let calls = 0, release;
  const h = harness(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  const first = h.submit();
  await h.submit();
  assert.equal(calls, 1);
  release({ ok: true, json: async () => ({ success: true, submissionStatus: 'accepted_for_sending' }) });
  await first;
});
test('HTTP errors, malformed responses, unconfirmed success, and timeouts keep inputs without retry', async () => {
  for (const mode of ['503', '429', 'json', 'network', 'unconfirmed']) {
    let calls = 0;
    const h = harness(async () => {
      calls++;
      if (mode === 'network') throw new Error('timeout');
      return { ok: mode === 'json' || mode === 'unconfirmed', json: async () => {
        if (mode === 'json') throw new Error('invalid JSON');
        if (mode === 'unconfirmed') return { success: true };
        return { error: 'Form unavailable. Email sos@scoutconsultatory.com.' };
      } };
    });
    await h.submit();
    assert.equal(calls, 1);
    assert.equal(h.form.resets, 0);
    assert.equal(h.elements.summary.value, ' Site not loading ');
    assert.equal(h.button.disabled, false);
    assert.equal(h.status.hidden, false);
    assert.match(h.status.textContent, /sos@scoutconsultatory.com/);
    assert.equal(h.status.className, 'form-status form-status--error');
  }
});

'use strict';
(function () {
  const form = document.getElementById('supportForm');
  if (!form) return;
  const fields = form.elements;
  const button = document.getElementById('supportSubmit');
  const status = document.getElementById('supportStatus');
  const email = 'sos@scoutconsultatory.com';
  const validate = () => {
    fields.name.setCustomValidity(fields.name.value.trim().length < 2 ? 'Enter your name using at least 2 characters.' : '');
    fields.summary.setCustomValidity(fields.summary.value.trim().length < 5 ? 'Enter a short summary using at least 5 characters.' : '');
    fields.details.setCustomValidity(fields.details.value.trim().length < 10 ? 'Describe the issue using at least 10 characters.' : '');
  };
  form.addEventListener('input', validate);
  form.addEventListener('reset', () => {
    ['name', 'summary', 'details'].forEach(name => fields[name].setCustomValidity(''));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    validate();
    if (!form.reportValidity()) return;
    button.disabled = true;
    button.textContent = 'Sending…';
    status.hidden = true;
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          requestType: 'support',
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          business: fields.business.value.trim(),
          service: 'Help desk',
          message: 'Issue: ' + fields.summary.value.trim() + '\n\nDetails:\n' + fields.details.value.trim(),
        }),
      });
      const data = await response.json();
      if (response.ok && data.success === true && data.submissionStatus === 'accepted_for_sending') {
        status.className = 'form-status form-status--success';
        status.textContent = 'Your support request was accepted for sending. This does not confirm inbox delivery.';
        form.reset();
      } else {
        status.className = 'form-status form-status--error';
        status.textContent = Array.isArray(data.errors) ? data.errors.join(' ') :
          (data.error || 'We could not confirm your request. Your entries are still here. Please email ' + email + ' before submitting again.');
      }
    } catch (_) {
      status.className = 'form-status form-status--error';
      status.textContent = 'We could not confirm whether your request was sent. Your entries are still here. Please email ' + email + ' before submitting again.';
    } finally {
      clearTimeout(timeout);
      form.removeAttribute('aria-busy');
      button.disabled = false;
      button.textContent = 'Send support request';
      status.hidden = false;
      status.focus();
    }
  });
  // Keep native submission disabled until the handler is installed.
  button.disabled = false;
})();

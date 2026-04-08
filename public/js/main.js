/**
 * Scout Consultatory – Main Frontend JS
 * Nav behavior + Lead form + Services fallback
 */

(function () {
  'use strict';

  // ── Nav scroll ────────────────────────────────────────────────
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  // ── Mobile nav ────────────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('is-open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('is-open'))
    );
  }

  // ── Load services ─────────────────────────────────────────────
  const servicesGrid = document.getElementById('servicesGrid');
  if (servicesGrid) {
    fetch('/api/services')
      .then(r => r.json())
      .then(data => {
        servicesGrid.innerHTML = data.services.map(s => `
          <div class="service-card">
            <span class="service-card__icon">${s.icon}</span>
            <h3>${s.title}</h3>
            <p>${s.description}</p>
          </div>`).join('');
      })
      .catch(() => {
        servicesGrid.innerHTML = [
          ['🔍','Root Cause Audit','Structured review of your operations, compliance posture, and process efficacy — traced to root cause, not just flagged on a list.'],
          ['📋','Compliance Gap Analysis','Identify exposure across OSHA, data privacy, HR documentation, HIPAA, and operational policy — before a regulator does it for you.'],
          ['⚙️','Process & Workflow Redesign','Rebuild the processes that are slowing you down. SOPs, workflow corrections, and tool configuration built around what the audit actually found.'],
          ['🔗','System & Tool Integration','Get your CRM, ops tools, and communications platforms working together — configured around your real workflows, not a generic setup.'],
          ['📊','Fractional CTO','Senior operations and technology leadership without the full-time cost. Strategy, oversight, and hands-on execution scoped to what you need.'],
          ['🏭','All Industries','Healthcare, logistics, construction, retail, professional services, property management — the methodology adapts to what your industry requires.'],
        ].map(([icon, title, desc]) => `
          <div class="service-card">
            <span class="service-card__icon">${icon}</span>
            <h3>${title}</h3>
            <p>${desc}</p>
          </div>`).join('');
      });
  }

  // ── Contact form ──────────────────────────────────────────────
  const form       = document.getElementById('contactForm');
  const submitBtn  = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnText    = submitBtn.querySelector('.btn__text');
      const btnSpinner = submitBtn.querySelector('.btn__spinner');

      btnText.textContent = 'Sending…';
      btnSpinner.hidden   = false;
      submitBtn.disabled  = true;
      formStatus.hidden   = true;

      try {
        const res  = await fetch('/api/leads', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     form.name.value.trim(),
            email:    form.email.value.trim(),
            phone:    form.phone.value.trim(),
            business: form.business.value.trim(),
            service:  form.service.value,
            message:  form.message.value.trim(),
          }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          formStatus.className   = 'form-status form-status--success';
          formStatus.textContent = data.message || "Got it — I'll be in touch soon.";
          form.reset();
        } else {
          formStatus.className   = 'form-status form-status--error';
          formStatus.textContent = data.errors ? data.errors.join(' ') : (data.error || 'Something went wrong.');
        }
        formStatus.hidden = false;
      } catch (_) {
        formStatus.className   = 'form-status form-status--error';
        formStatus.textContent = 'Network error. Please email Brandon@scoutconsultatory.com directly.';
        formStatus.hidden      = false;
      } finally {
        btnText.textContent = 'Send It';
        btnSpinner.hidden   = true;
        submitBtn.disabled  = false;
      }
    });
  }

})();

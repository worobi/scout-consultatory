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

  // ── Active nav link ───────────────────────────────────────────
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav__links a, .footer__nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const linkPath = new URL(href, window.location.href).pathname.replace(/\/$/, '') || '/';
    if (linkPath === currentPath ||
        (currentPath === '/' && (linkPath === '/index.html' || linkPath === '')) ||
        (currentPath.endsWith('index.html') && linkPath === '/')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // ── Mobile nav ────────────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    const setMenuOpen = (open) => {
      navLinks.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    navToggle.addEventListener('click', () => setMenuOpen(navToggle.getAttribute('aria-expanded') !== 'true'));
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenuOpen(false)));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        navToggle.focus();
      }
    });
    window.matchMedia('(max-width: 768px)').addEventListener('change', () => setMenuOpen(false));
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
    const fields = form.elements;
    const requestedService = new URLSearchParams(window.location.search).get('service');
    if (Array.from(fields.service.options).some(option => option.value === requestedService)) {
      fields.service.value = requestedService;
      fields.service.querySelectorAll('option').forEach(option => {
        option.defaultSelected = option.value === requestedService;
      });
    }
    // Keep validation consistent with the API, including whitespace-only input.
    const validateText = () => {
      fields.name.setCustomValidity(fields.name.value.trim().length < 2 ? 'Enter a name with at least 2 characters.' : '');
      fields.message.setCustomValidity(fields.message.value.trim().length < 10 ? 'Enter at least 10 characters describing what you need.' : '');
    };
    form.addEventListener('input', validateText);
    form.addEventListener('reset', () => {
      fields.name.setCustomValidity('');
      fields.message.setCustomValidity('');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;
      validateText();
      if (!form.reportValidity()) return;
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
            name:     fields.name.value.trim(),
            email:    fields.email.value.trim(),
            phone:    fields.phone.value.trim(),
            business: fields.business.value.trim(),
            service:  fields.service.value,
            message:  fields.message.value.trim(),
          }),
        });
        const data = await res.json().catch(() => ({ error: 'Unable to confirm your inquiry. Please try again or email Leadscout@Scoutconsultatory.com.' }));

        if (res.ok && data.success) {
          formStatus.className   = 'form-status form-status--success';
          formStatus.textContent = data.message || "Got it — I'll be in touch soon.";
          form.reset();
        } else {
          formStatus.className   = 'form-status form-status--error';
          formStatus.textContent = data.errors ? data.errors.join(' ') : (data.error || 'Something went wrong.');
        }
        formStatus.hidden = false;
        formStatus.focus();
      } catch (_) {
        formStatus.className   = 'form-status form-status--error';
        formStatus.textContent = 'Network error. Please email Leadscout@Scoutconsultatory.com directly.';
        formStatus.hidden      = false;
        formStatus.focus();
      } finally {
        btnText.textContent = 'Send Inquiry';
        btnSpinner.hidden   = true;
        submitBtn.disabled  = false;
      }
    });
  }

})();

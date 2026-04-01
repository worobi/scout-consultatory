/**
 * Scout Consultatory – Main Frontend JS
 * Chat widget + Lead form + Nav behavior
 */

(function () {
  'use strict';

  // ── Nav scroll behavior ──────────────────────────────────────
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  // ── Mobile nav toggle ────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('is-open');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('is-open'));
    });
  }

  // ── Load services from API ────────────────────────────────────
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
          </div>
        `).join('');
      })
      .catch(() => {
        // Fallback static services
        servicesGrid.innerHTML = `
          <div class="service-card"><span class="service-card__icon">🖥️</span><h3>IT Consulting</h3><p>Assess, plan, and fix your tech stack. No jargon, just clear recommendations.</p></div>
          <div class="service-card"><span class="service-card__icon">🌐</span><h3>Web Development &amp; Hosting</h3><p>Fast, modern sites built to convert — not just look good.</p></div>
          <div class="service-card"><span class="service-card__icon">⚙️</span><h3>Workflow Automation</h3><p>Eliminate repetitive manual work. Connect your tools so they talk to each other.</p></div>
          <div class="service-card"><span class="service-card__icon">🔗</span><h3>CRM &amp; Integrations</h3><p>Get your CRM, email, calendar, and ops tools working as one unified system.</p></div>
          <div class="service-card"><span class="service-card__icon">📊</span><h3>Fractional CTO</h3><p>Senior tech leadership without the full-time cost. Strategy, oversight, execution.</p></div>
          <div class="service-card"><span class="service-card__icon">🤖</span><h3>AI Adoption</h3><p>Practical AI — not hype. Deploy tools that actually reduce work and improve output.</p></div>
        `;
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

      // Show loading
      btnText.textContent = 'Sending…';
      btnSpinner.hidden   = false;
      submitBtn.disabled  = true;
      formStatus.hidden   = true;

      const payload = {
        name:     form.name.value.trim(),
        email:    form.email.value.trim(),
        phone:    form.phone.value.trim(),
        business: form.business.value.trim(),
        service:  form.service.value,
        message:  form.message.value.trim(),
      };

      try {
        const res  = await fetch('/api/leads', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          formStatus.className   = 'form-status form-status--success';
          formStatus.textContent = data.message || "Got it — I'll be in touch soon.";
          formStatus.hidden      = false;
          form.reset();
        } else {
          const errMsg = data.errors ? data.errors.join(' ') : (data.error || 'Something went wrong. Try again.');
          formStatus.className   = 'form-status form-status--error';
          formStatus.textContent = errMsg;
          formStatus.hidden      = false;
        }
      } catch (_) {
        formStatus.className   = 'form-status form-status--error';
        formStatus.textContent = 'Network error. Please try again or email Brandon@worobi.com directly.';
        formStatus.hidden      = false;
      } finally {
        btnText.textContent = 'Send It';
        btnSpinner.hidden   = true;
        submitBtn.disabled  = false;
      }
    });
  }

  // ── Chat widget ───────────────────────────────────────────────
  const chatToggle  = document.getElementById('chatToggle');
  const chatClose   = document.getElementById('chatClose');
  const chatPanel   = document.getElementById('chatPanel');
  const chatInput   = document.getElementById('chatInput');
  const chatSend    = document.getElementById('chatSend');
  const chatMessages= document.getElementById('chatMessages');
  const chatStatus  = document.getElementById('chatStatus');
  const openIcon    = chatToggle?.querySelector('.chat-toggle__icon--open');
  const closeIcon   = chatToggle?.querySelector('.chat-toggle__icon--close');

  let chatOpen       = false;
  let chatHistory    = [];
  let chatProcessing = false;

  function toggleChat(open) {
    chatOpen = (open !== undefined) ? open : !chatOpen;
    chatPanel.hidden  = !chatOpen;
    if (openIcon)  openIcon.hidden  =  chatOpen;
    if (closeIcon) closeIcon.hidden = !chatOpen;
    if (chatOpen) {
      chatInput.focus();
      scrollToBottom();
    }
  }

  if (chatToggle) chatToggle.addEventListener('click', () => toggleChat());
  if (chatClose)  chatClose.addEventListener('click',  () => toggleChat(false));

  // Auto-resize textarea
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (chatSend) chatSend.addEventListener('click', sendMessage);

  function getProvider() {
    const checked = document.querySelector('input[name="provider"]:checked');
    return checked ? checked.value : 'openai';
  }

  function appendMessage(role, text) {
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'bot'}`;
    el.innerHTML = `<div class="chat-msg__bubble">${escapeHtml(text)}</div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--bot chat-msg--typing';
    el.innerHTML = `<div class="chat-msg__bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  async function sendMessage() {
    if (chatProcessing) return;
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    chatProcessing  = true;
    chatSend.disabled = true;

    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const typing = appendTyping();

    try {
      const res  = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: chatHistory, provider: getProvider() }),
      });
      const data = await res.json();

      typing.remove();

      if (res.ok && data.reply) {
        appendMessage('bot', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
        if (data.provider) {
          chatStatus.textContent = `Online · ${data.provider === 'claude' ? 'Claude' : 'GPT-4'}${data.fallback ? ' (fallback)' : ''}`;
        }
      } else {
        appendMessage('bot', data.error || 'Something went wrong. Try the contact form below.');
      }
    } catch (_) {
      typing.remove();
      appendMessage('bot', 'Network issue — please check your connection or use the contact form.');
    } finally {
      chatProcessing    = false;
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  // ── Check AI status on load ───────────────────────────────────
  fetch('/api/chat/status')
    .then(r => r.json())
    .then(data => {
      if (!data.openai && !data.claude) {
        if (chatStatus) chatStatus.textContent = 'Limited — API keys not configured';
      }
    })
    .catch(() => {});

})();

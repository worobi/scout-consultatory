/**
 * Scout Consultatory – Main Frontend JS
 * Chat widget + Lead form + Nav behavior
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
          ['🔍','Root Cause Audit','AI-assisted analysis that maps your real operations and traces every issue back to why it exists — not just what it looks like.'],
          ['📋','Compliance Gap Analysis','Structured review across OSHA, data privacy, HR documentation, HIPAA, and operational policy — with root cause context for every gap found.'],
          ['⚙️','Process & Workflow Redesign','Rebuild the processes that are slowing you down. SOPs, workflow automation, and tool configuration built around what the audit actually found.'],
          ['🔗','System & Tool Integration','Get your CRM, ops tools, and communications platforms working as one unified system — configured around your real workflows.'],
          ['🤖','AI Adoption','Practical AI implementation — not hype. Deploy tools that accelerate diagnosis, reduce manual work, and improve output in ways you can measure.'],
          ['📊','Fractional CTO','Senior tech and operations leadership without the full-time cost. Strategy, oversight, and execution — scoped to what you actually need.'],
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

  // ── Chat widget ───────────────────────────────────────────────
  const chatToggle   = document.getElementById('chatToggle');
  const chatClose    = document.getElementById('chatClose');
  const chatPanel    = document.getElementById('chatPanel');
  const chatInput    = document.getElementById('chatInput');
  const chatSend     = document.getElementById('chatSend');
  const chatMessages = document.getElementById('chatMessages');

  if (!chatToggle || !chatPanel) return;

  let isOpen         = false;
  let chatHistory    = [];
  let isSending      = false;
  let transcriptSent = false;

  // ── Open / close ──────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    chatPanel.removeAttribute('hidden');
    chatPanel.classList.add('chat-panel--visible');
    chatToggle.classList.add('chat-toggle--open');
    if (chatInput) setTimeout(() => chatInput.focus(), 50);
    scrollBottom();
  }

  function closeChat() {
    isOpen = false;
    chatPanel.setAttribute('hidden', '');
    chatPanel.classList.remove('chat-panel--visible');
    chatToggle.classList.remove('chat-toggle--open');
    sendTranscriptOnClose();
  }

  chatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen ? closeChat() : openChat();
  });

  // Close button inside panel header
  if (chatClose) {
    chatClose.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChat();
    });
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !chatPanel.contains(e.target) && !chatToggle.contains(e.target)) {
      closeChat();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // ── Input handlers ────────────────────────────────────────────
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

  // ── Message rendering ─────────────────────────────────────────
  function appendMessage(role, text) {
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'bot'}`;
    el.innerHTML = `<div class="chat-msg__bubble">${esc(text)}</div>`;
    chatMessages.appendChild(el);
    scrollBottom();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg--bot chat-msg--typing';
    el.id = 'typingIndicator';
    el.innerHTML = `<div class="chat-msg__bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    chatMessages.appendChild(el);
    scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function scrollBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/\n/g,'<br>');
  }

  // ── Send message ──────────────────────────────────────────────
  async function sendMessage() {
    if (isSending) return;
    const text = (chatInput.value || '').trim();
    if (!text) return;

    chatInput.value = '';
    chatInput.style.height = 'auto';
    isSending = true;
    if (chatSend) chatSend.disabled = true;

    appendMessage('user', text);
    chatHistory.push({ role: 'user', content: text });
    showTyping();

    try {
      const res  = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: chatHistory }),
      });
      const data = await res.json();
      hideTyping();

      const reply = data.reply || "Something went wrong on my end. Try the contact form or email Brandon@scoutconsultatory.com directly.";
      appendMessage('bot', reply);
      chatHistory.push({ role: 'assistant', content: reply });

    } catch (_) {
      hideTyping();
      appendMessage('bot', 'Network issue. Try the contact form or email Brandon@scoutconsultatory.com directly.');
    } finally {
      isSending = false;
      if (chatSend) chatSend.disabled = false;
      if (chatInput) chatInput.focus();
    }
  }

  // ── Send transcript when chat closes ──────────────────────────
  function sendTranscriptOnClose() {
    if (transcriptSent || chatHistory.length < 2) return;
    transcriptSent = true;
    fetch('/api/chat/transcript', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages: chatHistory }),
    }).catch(() => {});
  }

  // Also send transcript on page unload
  window.addEventListener('beforeunload', sendTranscriptOnClose);

})();

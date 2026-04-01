/**
 * Scout Consultatory – General API Routes
 * Health check, status, and utility endpoints
 */

const express = require('express');
const router  = express.Router();

// Health check — used by nginx, PM2, uptime monitors
router.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// Services list — can be fetched by the frontend dynamically
router.get('/services', (req, res) => {
  res.json({
    services: [
      {
        id:          'it-consulting',
        title:       'IT Consulting',
        description: 'Assess, plan, and fix your tech stack. No jargon, just clear recommendations.',
        icon:        '🖥️',
      },
      {
        id:          'web-development',
        title:       'Web Development & Hosting',
        description: 'Fast, modern sites built to convert — not just look good. Hosted and maintained.',
        icon:        '🌐',
      },
      {
        id:          'workflow-automation',
        title:       'Workflow Automation',
        description: 'Eliminate repetitive manual work. Connect your tools so they talk to each other.',
        icon:        '⚙️',
      },
      {
        id:          'crm-integrations',
        title:       'CRM & System Integrations',
        description: 'Get your CRM, email, calendar, and ops tools working as one unified system.',
        icon:        '🔗',
      },
      {
        id:          'fractional-cto',
        title:       'Fractional CTO',
        description: 'Senior tech leadership without the full-time cost. Strategy, oversight, execution.',
        icon:        '📊',
      },
      {
        id:          'ai-adoption',
        title:       'AI Adoption for SMBs',
        description: 'Practical AI — not hype. Deploy tools that actually reduce work and improve output.',
        icon:        '🤖',
      },
    ],
  });
});

module.exports = router;

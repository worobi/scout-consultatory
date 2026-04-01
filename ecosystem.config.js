/**
 * PM2 Ecosystem Config
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup
 */

module.exports = {
  apps: [
    {
      name:         'scout-consultatory',
      script:       './server.js',
      instances:    'max',         // cluster mode — uses all CPU cores
      exec_mode:    'cluster',
      watch:        false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'development',
        PORT:     3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      // Logging
      out_file:    './logs/out.log',
      error_file:  './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:  true,

      // Restart policy
      restart_delay:     3000,
      max_restarts:      10,
      min_uptime:        '10s',
      autorestart:       true,
    },
  ],
};

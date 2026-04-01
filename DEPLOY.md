# Scout Consultatory — VPS Deployment Guide

## Stack
- **Runtime:** Node.js 18+
- **Server:** Express
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx
- **SSL:** Let's Encrypt (certbot)
- **AI:** OpenAI GPT + Anthropic Claude (dual support)

---

## 1. Initial VPS Setup (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx, certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

---

## 2. Deploy the App

```bash
# Clone or upload your project
git clone https://github.com/YOUR_USERNAME/scout-consultatory.git /var/www/scout-consultatory
# OR use scp/rsync:
# rsync -avz ./scout-consultatory/ user@your-vps:/var/www/scout-consultatory/

cd /var/www/scout-consultatory

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Set up environment
cp .env.example .env
nano .env   # Fill in your API keys and SMTP settings
```

---

## 3. Configure Environment (.env)

Fill in these critical values:

```
OPENAI_API_KEY=sk-...          # From platform.openai.com
ANTHROPIC_API_KEY=sk-ant-...   # From console.anthropic.com
AI_PROVIDER=openai             # Default AI provider

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password    # Gmail: use App Password, not account password
NOTIFY_EMAIL=Brandon@worobi.com

SITE_URL=https://scoutconsultatory.com
NODE_ENV=production
PORT=3000
```

---

## 4. Start with PM2

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 process list (survives reboots)
pm2 save

# Auto-start PM2 on system boot
pm2 startup
# Run the command it outputs

# Check status
pm2 status
pm2 logs scout-consultatory
```

---

## 5. Configure Nginx

```bash
# Copy config
sudo cp /var/www/scout-consultatory/nginx/scout.conf \
        /etc/nginx/sites-available/scout-consultatory

# Enable site
sudo ln -s /etc/nginx/sites-available/scout-consultatory \
           /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## 6. SSL Certificate (Let's Encrypt)

```bash
# Point your domain's A record to your VPS IP first, then:
sudo certbot --nginx -d scoutconsultatory.com -d www.scoutconsultatory.com

# Auto-renew (runs twice daily via cron — certbot installs this automatically)
sudo certbot renew --dry-run
```

---

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Verify Deployment

```bash
# Health check
curl https://scoutconsultatory.com/api/health

# AI status
curl https://scoutconsultatory.com/api/chat/status

# PM2 logs (live)
pm2 logs scout-consultatory --lines 50
```

---

## 9. Updates / Redeploy

```bash
cd /var/www/scout-consultatory
git pull origin main
npm install --production
pm2 restart scout-consultatory
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 502 Bad Gateway | Check `pm2 status` — app may have crashed. Run `pm2 logs`. |
| Chat returns error | Check `.env` API keys. Run `curl localhost:3000/api/chat/status`. |
| Emails not sending | Use Gmail App Password, not account password. Enable 2FA first. |
| SSL error | Re-run certbot. Check domain DNS points to VPS. |
| Port 3000 in use | Change `PORT` in `.env` and update nginx proxy_pass. |

---

## AI Provider Switching

To switch the default AI provider at runtime without restart:
- Change `AI_PROVIDER=claude` in `.env` and run `pm2 restart scout-consultatory`
- Or: users can switch providers live in the chat widget UI (GPT / Claude radio buttons)

The system automatically falls back to the other provider if one fails.

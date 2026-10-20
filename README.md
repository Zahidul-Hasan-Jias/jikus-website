# JIKUS Business Website

A responsive business website starter with a dark blue visual identity, services, about section, projects, contact form, and login/sign-up.

## Requirements
- Node.js 18 or newer
- npm

## Run locally
1. Extract the ZIP.
2. Open a terminal in the `jikus-website` folder.
3. Install packages:
   ```bash
   npm install
   ```
4. Create your environment file:
   - macOS/Linux: `cp .env.example .env`
   - Windows PowerShell: `Copy-Item .env.example .env`
5. Change `SESSION_SECRET` in `.env` to a long random value.
6. Start the server:
   ```bash
   npm start
   ```
7. Open http://localhost:3000

The SQLite database is created automatically in `data/jikus.sqlite`.

## What's included
- Responsive, mobile-friendly landing page
- Services, company story, project cards, stats, and footer
- Scroll reveal and mobile navigation interactions
- Contact form stored in SQLite
- Sign-up and login using bcrypt password hashing
- Server-side sessions stored in SQLite
- Basic security headers and rate limiting

## Before deploying publicly
- Set `NODE_ENV=production` and use a strong unique `SESSION_SECRET`.
- Serve over HTTPS.
- Configure cookie/security settings for your hosting environment.
- Add email delivery if you want contact form submissions forwarded to an inbox.
- Add password reset, email verification, CSRF protection, backups, and monitoring before using this for a real customer-facing account system.
- Replace demo project content, contact details, and email addresses with your real business information.

This is a starter project, not a fully audited production system.

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('Set SESSION_SECRET to a unique random value of at least 32 characters in production.');
}
const sessionSecret = process.env.SESSION_SECRET || 'local-development-secret-change-before-deploying';

const db = new Database(path.join(dataDir, 'jikus.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  name: 'jikus.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStoreFactory({ db: 'sessions.sqlite', dir: dataDir, concurrentDB: true }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a little and try again.' } });
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many messages submitted. Please try again later.' } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = value => typeof value === 'string' ? value.trim() : '';

app.post('/api/auth/signup', authLimiter, async (req, res, next) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Please enter a name between 2 and 100 characters.' });
    if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash);
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: Number(result.lastInsertRowid), name, email };
      req.session.save(err2 => {
        if (err2) return next(err2);
        res.status(201).json({ message: 'Account created successfully. Welcome to JIKUS!', user: req.session.user });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!emailPattern.test(email) || password.length === 0 || password.length > 128) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const user = db.prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: user.id, name: user.name, email: user.email };
      req.session.save(err2 => {
        if (err2) return next(err2);
        res.json({ message: `Welcome back, ${user.name}!`, user: req.session.user });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('jikus.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.json({ message: 'You have been logged out.' });
  });
});

app.post('/api/contact', contactLimiter, (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const subject = clean(req.body.subject) || 'General enquiry';
  const message = clean(req.body.message);
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Please enter a name between 2 and 100 characters.' });
  if (email.length > 254 || !emailPattern.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (subject.length > 150) return res.status(400).json({ error: 'Please shorten the subject.' });
  if (message.length < 10 || message.length > 5000) return res.status(400).json({ error: 'Your message must be between 10 and 5000 characters.' });
  db.prepare('INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject, message);
  res.status(201).json({ message: 'Thanks for reaching out! Your message has been saved. We will be in touch soon.' });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`JIKUS website running at http://localhost:${PORT}`);
});

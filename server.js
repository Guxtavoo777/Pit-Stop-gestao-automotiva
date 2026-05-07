require('dotenv').config();
const express = require('express');
const session = require('express-session');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const { db, situacao, situacaoRev, gastos } = require('./db');
const CARROS = require('./carros');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── EJS ──────────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new BetterSqlite3Store({ client: db }),
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: variável SESSION_SECRET não definida em produção. Encerrando.');
      process.exit(1);
    }
    return crypto.randomBytes(32).toString('hex');
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

// ─── CSRF TOKEN ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// ─── RATE LIMITER ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, msg: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.post('/api/login', authLimiter);
app.post('/api/cadastro', authLimiter);

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
const PUBLIC_PATHS = new Set(['/', '/api/login', '/api/cadastro', '/logout']);

app.use((req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (!req.session.user) {
    return req.path.startsWith('/api/')
      ? res.status(401).json({ ok: false, msg: 'Não autenticado.' })
      : res.redirect('/');
  }
  next();
});

// ─── CSRF GUARD ───────────────────────────────────────────────────────────────
const SKIP_CSRF = new Set(['/api/login', '/api/cadastro']);

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (SKIP_CSRF.has(req.path)) return next();
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ ok: false, msg: 'Token de segurança inválido. Recarregue a página.' });
  }
  next();
});

// ─── APP LOCALS ───────────────────────────────────────────────────────────────
const brl = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
app.locals.brl = brl;
app.locals.situacao = situacao;
app.locals.situacaoRev = situacaoRev;
app.locals.gastos = gastos;
app.locals.CARROS = CARROS;

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use(require('./routes/auth'));
app.use(require('./routes/veiculos'));
app.use(require('./routes/manutencoes'));
app.use(require('./routes/revisoes'));
app.use(require('./routes/pages'));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { user: req.session.user || null });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(500).render('500', { user: req.session?.user || null });
});

// ─── START ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n  Pit Stop v5.0');
    console.log('  → http://localhost:' + PORT);
    console.log('  → Login: aluno / senha123');
    console.log('  → ' + CARROS.length + ' modelos\n');
  });
}

module.exports = app;

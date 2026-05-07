const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const CARROS = require('./carros');

const SALT_ROUNDS = 10;

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, 'db.json');

// ─── EJS SETUP ────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── DB ───────────────────────────────────────────────────────────────────────
function lerDB() { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
function salvarDB(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'pitstop_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const logado = (q, r, n) => q.session.user ? n() : r.redirect('/');
const brl = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gastos(vid) {
  return lerDB().manutencoes.filter(m => m.veiculo_id === vid).reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
}

function situacao(vid) {
  const ms = lerDB().manutencoes.filter(m => m.veiculo_id === vid);
  if (!ms.length) return { tipo: 'ok', texto: 'Em dia' };
  const hoje = new Date(); const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
  let cr = 0, av = 0;
  for (const m of ms) {
    if (m.proxima_data) {
      const d = new Date(m.proxima_data);
      if (d < hoje) cr++;
      else if (d <= lim30) av++;
    }
  }
  if (cr > 0) return { tipo: 'critico', texto: 'Revisão atrasada' };
  if (av > 0) return { tipo: 'aviso', texto: 'Revisão próxima' };
  return { tipo: 'ok', texto: 'Em dia' };
}

function situacaoRev(rv) {
  if (!rv.proxima_data) return { tipo: 'ok', texto: 'Em dia' };
  const hoje = new Date(); const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
  const d = new Date(rv.proxima_data);
  if (d < hoje) return { tipo: 'critico', texto: 'Revisão atrasada' };
  if (d <= lim30) return { tipo: 'aviso', texto: 'Revisão próxima' };
  return { tipo: 'ok', texto: 'Em dia' };
}

// ─── CHECKLIST ─────────────────────────────────────────────────────────────────
const ITENS_CHECKLIST = [
  { key: 'oleo_filtro', label: 'Óleo e Filtro de Óleo' },
  { key: 'filtro_ar', label: 'Filtro de Ar' },
  { key: 'filtro_combustivel', label: 'Filtro de Combustível' },
  { key: 'freios_dianteiros', label: 'Freios Dianteiros' },
  { key: 'freios_traseiros', label: 'Freios Traseiros' },
  { key: 'pneus', label: 'Pneus e Calibragem' },
  { key: 'alinhamento_balanceamento', label: 'Alinhamento e Balanceamento' },
  { key: 'suspensao_dianteira', label: 'Suspensão Dianteira' },
  { key: 'suspensao_traseira', label: 'Suspensão Traseira' },
  { key: 'bateria', label: 'Bateria' },
  { key: 'correia_dentada', label: 'Correia Dentada' },
  { key: 'sistema_arrefecimento', label: 'Sistema de Arrefecimento' },
  { key: 'fluido_freio', label: 'Fluido de Freio' },
  { key: 'fluido_direcao', label: 'Fluido de Direção' },
  { key: 'ar_condicionado', label: 'Ar-Condicionado' },
  { key: 'luzes_sinalizacao', label: 'Luzes e Sinalização' },
  { key: 'escapamento', label: 'Sistema de Escapamento' },
  { key: 'coxins', label: 'Coxins do Motor' },
  { key: 'velas_ignicao', label: 'Velas de Ignição' },
  { key: 'limpadores', label: 'Limpadores de Para-brisa' },
];

// Make helpers available to all views
app.locals.brl = brl;
app.locals.situacao = situacao;
app.locals.situacaoRev = situacaoRev;
app.locals.gastos = gastos;
app.locals.CARROS = CARROS;
app.locals.ITENS_CHECKLIST = ITENS_CHECKLIST;

// ─── API AUTH ──────────────────────────────────────────────────────────────────
app.post('/api/login', async (q, r) => {
  const { usuario, senha } = q.body;
  if (!usuario || !senha) return r.json({ ok: false });
  const db = lerDB();
  if (!db.usuarios) db.usuarios = [];
  const u = db.usuarios.find(x => x.usuario === usuario);
  if (!u) return r.json({ ok: false });

  const isHash = u.senha.startsWith('$2');
  let valid = false;
  if (isHash) {
    valid = await bcrypt.compare(senha, u.senha);
  } else {
    valid = u.senha === senha;
    if (valid) {
      u.senha = await bcrypt.hash(senha, SALT_ROUNDS);
      salvarDB(db);
    }
  }

  if (!valid) return r.json({ ok: false });
  q.session.user = u.usuario;
  r.json({ ok: true });
});

app.post('/api/cadastro', async (q, r) => {
  const { usuario, senha, senha2, nome } = q.body;
  if (!usuario || !senha) return r.json({ ok: false, msg: 'Preencha todos os campos.' });
  if (senha !== senha2) return r.json({ ok: false, msg: 'As senhas não conferem.' });
  if (senha.length < 6) return r.json({ ok: false, msg: 'A senha deve ter pelo menos 6 caracteres.' });
  const usrRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usrRegex.test(usuario)) return r.json({ ok: false, msg: 'Usuário: 3-20 caracteres, sem espaços ou acentos.' });
  const db = lerDB();
  if (!db.usuarios) db.usuarios = [];
  if (usuario === 'aluno' || db.usuarios.find(x => x.usuario === usuario))
    return r.json({ ok: false, msg: 'Este usuário já está em uso. Escolha outro.' });
  const hash = await bcrypt.hash(senha, SALT_ROUNDS);
  db.usuarios.push({ usuario, senha: hash, nome: nome || usuario });
  salvarDB(db);
  q.session.user = usuario;
  r.json({ ok: true });
});

app.get('/logout', (q, r) => { q.session.destroy(() => r.redirect('/')); });

// ─── API PERFIL ────────────────────────────────────────────────────────────────
app.get('/api/perfil', logado, (q, r) => {
  const db = lerDB();
  const u = db.usuarios?.find(x => x.usuario === q.session.user) || { usuario: q.session.user };
  r.json({ usuario: u.usuario, nome: u.nome || '', email: u.email || '', telefone: u.telefone || '', cidade: u.cidade || '' });
});

app.put('/api/perfil', logado, (q, r) => {
  const db = lerDB();
  if (!db.usuarios) db.usuarios = [];
  let u = db.usuarios.find(x => x.usuario === q.session.user);
  if (!u) { u = { usuario: q.session.user, senha: 'senha123' }; db.usuarios.push(u); }
  const { nome, email, telefone, cidade } = q.body;
  if (nome !== undefined) u.nome = nome.trim();
  if (email !== undefined) u.email = email.trim();
  if (telefone !== undefined) u.telefone = telefone.trim();
  if (cidade !== undefined) u.cidade = cidade.trim();
  salvarDB(db);
  r.json({ ok: true });
});

app.put('/api/perfil/senha', logado, async (q, r) => {
  const db = lerDB();
  if (!db.usuarios) db.usuarios = [];
  let u = db.usuarios.find(x => x.usuario === q.session.user);
  if (!u) { u = { usuario: q.session.user, senha: '' }; db.usuarios.push(u); }
  const { senha_atual, senha_nova } = q.body;
  const isHash = u.senha.startsWith('$2');
  const senhaOk = isHash
    ? await bcrypt.compare(senha_atual, u.senha)
    : u.senha === senha_atual;
  if (!senhaOk) return r.json({ ok: false, msg: 'Senha atual incorreta.' });
  if (!senha_nova || senha_nova.length < 6) return r.json({ ok: false, msg: 'A nova senha deve ter pelo menos 6 caracteres.' });
  u.senha = await bcrypt.hash(senha_nova, SALT_ROUNDS);
  salvarDB(db);
  r.json({ ok: true });
});

// ─── API VEÍCULOS ──────────────────────────────────────────────────────────────
app.get('/api/veiculos', logado, (q, r) => r.json(lerDB().veiculos.filter(v => v.usuario === q.session.user)));

app.post('/api/veiculos', logado, (q, r) => {
  const db = lerDB(); const id = (db.nextV || Date.now());
  db.veiculos.push({ id, ...q.body, usuario: q.session.user });
  db.nextV = (id + 1); salvarDB(db); r.json({ ok: true, id });
});

app.put('/api/veiculos/:id', logado, (q, r) => {
  const db = lerDB(); const id = parseInt(q.params.id);
  const v = db.veiculos.find(x => x.id === id && x.usuario === q.session.user);
  if (!v) return r.json({ ok: false, msg: 'Veículo não encontrado.' });
  const { km, cor, placa, observacoes } = q.body;
  if (km !== undefined) v.km = km;
  if (cor !== undefined) v.cor = cor;
  if (placa !== undefined) v.placa = placa;
  if (observacoes !== undefined) v.observacoes = observacoes;
  salvarDB(db); r.json({ ok: true });
});

app.patch('/api/veiculos/:id/status', logado, (q, r) => {
  const db = lerDB(); const id = parseInt(q.params.id);
  const v = db.veiculos.find(x => x.id === id && x.usuario === q.session.user);
  if (!v) return r.json({ ok: false, msg: 'Veículo não encontrado.' });
  v.ativo = (v.ativo === false) ? true : false;
  salvarDB(db); r.json({ ok: true, ativo: v.ativo });
});

app.delete('/api/veiculos/:id', logado, (q, r) => {
  const db = lerDB(); const id = parseInt(q.params.id);
  db.veiculos = db.veiculos.filter(v => !(v.id === id && v.usuario === q.session.user));
  db.manutencoes = db.manutencoes.filter(m => m.veiculo_id !== id);
  salvarDB(db); r.json({ ok: true });
});

// ─── API MANUTENÇÕES ───────────────────────────────────────────────────────────
app.post('/api/manut/:vid', logado, (q, r) => {
  const db = lerDB(); const vid = parseInt(q.params.vid);
  if (!db.veiculos.find(v => v.id === vid && v.usuario === q.session.user)) return r.json({ ok: false });
  const id = (db.nextM || Date.now());
  db.manutencoes.push({ id, veiculo_id: vid, ...q.body });
  db.nextM = (id + 1); salvarDB(db); r.json({ ok: true });
});

app.delete('/api/manut/:id', logado, (q, r) => {
  const db = lerDB(); db.manutencoes = db.manutencoes.filter(m => m.id !== parseInt(q.params.id));
  salvarDB(db); r.json({ ok: true });
});

// ─── API REVISÕES ──────────────────────────────────────────────────────────────
app.get('/api/revisoes', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user).map(v => v.id);
  r.json((db.revisoes || []).filter(rv => vs.includes(rv.veiculo_id)));
});

app.post('/api/revisoes', logado, (q, r) => {
  const db = lerDB();
  const vid = parseInt(q.body.veiculo_id);
  if (!db.veiculos.find(v => v.id === vid && v.usuario === q.session.user)) return r.json({ ok: false });
  if (!db.revisoes) db.revisoes = [];
  const id = db.nextR || 1;
  const ano = new Date().getFullYear();
  const num = String(id).padStart(3, '0');
  const numero_doc = `REV-${ano}-${num}`;
  db.revisoes.push({ id, veiculo_id: vid, usuario: q.session.user, numero_doc, ...q.body });
  db.nextR = id + 1;
  salvarDB(db);
  r.json({ ok: true, id, numero_doc });
});

app.delete('/api/revisoes/:id', logado, (q, r) => {
  const db = lerDB();
  db.revisoes = (db.revisoes || []).filter(rv => rv.id !== parseInt(q.params.id));
  salvarDB(db); r.json({ ok: true });
});

// ─── LANDING PAGE ──────────────────────────────────────────────────────────────
app.get('/', (q, r) => {
  if (q.session.user) return r.redirect('/dashboard');
  r.render('landing');
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/dashboard', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const ms = db.manutencoes.filter(m => vs.find(v => v.id === m.veiculo_id));
  const totalGasto = ms.reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
  const alertas = vs.filter(v => situacao(v.id).tipo !== 'ok');
  const mmap = {};
  ms.forEach(m => { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (parseFloat(m.custo) || 0); });
  const meses = Object.keys(mmap).sort().slice(-6);

  r.render('dashboard', {
    title: 'Dashboard',
    user: q.session.user,
    activePath: '/dashboard',
    vs, ms, alertas, totalGasto, meses, mmap,
    heroImg: vs[0]?.img || CARROS[0].img,
    heroModel: vs[0]?.modelo || 'Sua Garagem',
    heroBrand: vs[0]?.marca || 'Pit Stop',
    featuredCars: CARROS.slice(0, 3),
  });
});

// ─── GARAGEM ────────────────────────────────────────────────────────────────────
app.get('/garagem', logado, (q, r) => {
  const vs = lerDB().veiculos.filter(v => v.usuario === q.session.user);
  r.render('garagem', {
    title: 'Minha Garagem',
    user: q.session.user,
    activePath: '/garagem',
    vsAtivos: vs.filter(v => v.ativo !== false),
    vsInativos: vs.filter(v => v.ativo === false),
  });
});

// ─── DETALHE VEÍCULO ────────────────────────────────────────────────────────────
app.get('/veiculo/:id', logado, (q, r) => {
  const db = lerDB();
  const v = db.veiculos.find(x => x.id === parseInt(q.params.id) && x.usuario === q.session.user);
  if (!v) return r.redirect('/garagem');
  const ms = db.manutencoes.filter(m => m.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data));
  const totalGasto = gastos(v.id);
  const sit = situacao(v.id);
  const sitCls = sit.tipo === 'ok' ? 's-ok' : sit.tipo === 'critico' ? 's-cr' : 's-av';
  const mmap = {};
  ms.forEach(m => { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (parseFloat(m.custo) || 0); });
  const meses = Object.keys(mmap).sort();
  const specs = [
    ['Motor', v.motor], ['Potência', v.potencia], ['Torque', v.torque], ['Câmbio', v.cambio],
    ['Tração', v.tracao], ['Combustível', v.combustivel], ['Consumo cidade', v.consumo_cidade],
    ['Consumo estrada', v.consumo_estrada], ['Porta-malas', v.porta_malas]
  ].filter(x => x[1]);
  const vRevs = (db.revisoes || []).filter(rv => rv.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data));

  r.render('veiculo', {
    title: v.modelo,
    user: q.session.user,
    activePath: '/garagem',
    v, ms, vRevs, totalGasto, sit, sitCls, meses, mmap, specs,
    inativo: v.ativo === false,
  });
});

// ─── CADASTRO ──────────────────────────────────────────────────────────────────
app.get('/cadastro', logado, (q, r) => {
  r.render('cadastro', {
    title: 'Adicionar Carro',
    user: q.session.user,
    activePath: '/cadastro',
  });
});

// ─── EDITAR VEÍCULO ────────────────────────────────────────────────────────────
app.get('/editar-veiculo/:id', logado, (q, r) => {
  const db = lerDB();
  const v = db.veiculos.find(x => x.id === parseInt(q.params.id) && x.usuario === q.session.user);
  if (!v) return r.redirect('/garagem');
  r.render('editar-veiculo', {
    title: 'Editar Veículo',
    user: q.session.user,
    activePath: '/garagem',
    v,
    inativo: v.ativo === false,
  });
});

// ─── MANUTENÇÃO ────────────────────────────────────────────────────────────────
app.get('/manutencao/:id', logado, (q, r) => {
  const v = lerDB().veiculos.find(x => x.id === parseInt(q.params.id) && x.usuario === q.session.user);
  if (!v) return r.redirect('/garagem');
  r.render('manutencao', {
    title: 'Manutenção',
    user: q.session.user,
    activePath: '/garagem',
    v,
    tipos: ['Troca de Óleo', 'Revisão dos Freios', 'Troca de Pneus', 'Correia Dentada',
      'Alinhamento e Balanceamento', 'Troca de Bateria', 'Filtro de Ar', 'Filtro de Combustível',
      'Suspensão', 'Revisão Geral', 'Outro'],
  });
});

// ─── REVISÕES ─────────────────────────────────────────────────────────────────
app.get('/revisoes', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const vsMap = {};
  vs.forEach(v => { vsMap[v.id] = v; });
  const revs = (db.revisoes || []).filter(rv => vsMap[rv.veiculo_id]).sort((a, b) => b.data.localeCompare(a.data));
  const totCusto = revs.reduce((s, rv) => s + (parseFloat(rv.custo) || 0), 0);
  const hoje = new Date();
  const atrasadas = revs.filter(rv => rv.proxima_data && new Date(rv.proxima_data) < hoje).length;
  const proximas = revs.filter(rv => {
    if (!rv.proxima_data) return false;
    const d = new Date(rv.proxima_data); const lim = new Date(); lim.setDate(hoje.getDate() + 30);
    return d >= hoje && d <= lim;
  }).length;

  r.render('revisoes', {
    title: 'Revisões',
    user: q.session.user,
    activePath: '/revisoes',
    vs, vsMap, revs, totCusto, atrasadas, proximas,
  });
});

// ─── NOVA REVISÃO ──────────────────────────────────────────────────────────────
app.get('/revisao/nova', logado, (q, r) => {
  const vs = lerDB().veiculos.filter(v => v.usuario === q.session.user);
  if (!vs.length) return r.redirect('/cadastro');
  const vid = q.query.vid ? parseInt(q.query.vid) : '';

  r.render('revisao-nova', {
    title: 'Nova Revisão',
    user: q.session.user,
    activePath: '/revisoes',
    vs, vid,
    anoAtual: new Date().getFullYear(),
    tipos: ['Revisão de 10.000 km', 'Revisão de 20.000 km', 'Revisão de 30.000 km',
      'Revisão de 40.000 km', 'Revisão de 60.000 km', 'Revisão de 80.000 km',
      'Revisão de 100.000 km', 'Revisão Simples', 'Revisão Completa', 'Revisão Pré-Viagem',
      'Revisão Anual', 'Revisão Pós-Compra', 'Outro'],
  });
});

// ─── LAUDO ─────────────────────────────────────────────────────────────────────
app.get('/revisao/:id/documento', logado, (q, r) => {
  const db = lerDB();
  const rv = (db.revisoes || []).find(x => x.id === parseInt(q.params.id));
  if (!rv) return r.redirect('/revisoes');
  const v = db.veiculos.find(x => x.id === rv.veiculo_id && x.usuario === q.session.user);
  if (!v) return r.redirect('/revisoes');
  const itens = rv.itens_revisados || {};
  const aprovados = Object.values(itens).filter(x => x === 'aprovado').length;
  const atencoes = Object.values(itens).filter(x => x === 'atencao').length;
  const total = ITENS_CHECKLIST.length;
  const saude = total > 0 ? Math.round(aprovados / total * 100) : 0;

  r.render('laudo', {
    title: `Laudo ${rv.numero_doc}`,
    user: q.session.user,
    activePath: '/revisoes',
    rv, v, itens, itensChecklist: ITENS_CHECKLIST,
    aprovados, atencoes, total, saude,
    dataEmissao: new Date().toLocaleDateString('pt-BR'),
  });
});

// ─── PERFIL ────────────────────────────────────────────────────────────────────
app.get('/perfil', logado, (q, r) => {
  const db = lerDB();
  const u = db.usuarios?.find(x => x.usuario === q.session.user) || { usuario: q.session.user };
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const ms = db.manutencoes.filter(m => vs.find(v => v.id === m.veiculo_id));
  const rvs = (db.revisoes || []).filter(rv => rv.usuario === q.session.user);
  const totalGasto = ms.reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
  const nome = u.nome || q.session.user;

  r.render('perfil', {
    title: 'Meu Perfil',
    user: q.session.user,
    activePath: '/perfil',
    u, vs, ms, rvs, totalGasto, nome,
    ini: nome.charAt(0).toUpperCase(),
  });
});

// ─── EXPLORAR ──────────────────────────────────────────────────────────────────
app.get('/explorar', logado, (q, r) => {
  const cats = ['Todos', ...new Set(CARROS.map(c => c.categoria))].sort((a, b) => a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b));

  r.render('explorar', {
    title: 'Explorar Carros BR',
    user: q.session.user,
    activePath: '/explorar',
    cats,
  });
});

// ─── OFICINAS ──────────────────────────────────────────────────────────────────
app.get('/oficinas', logado, (q, r) => {
  const OFICINAS = [
    { nome: 'Oficina Autorizada VW - Brasília', especialidade: 'Volkswagen', ende: 'SIA Trecho 2, Lote 450 - Brasília/DF', dist: '4.2 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&auto=format', aval: '4.9', map: 'https://maps.google.com' },
    { nome: 'Auto Center Premium', especialidade: 'BMW Premium', ende: 'Setor de Oficinas Sul (SOF Sul) - Brasília/DF', dist: '6.5 km', tipo: 'Especializada', img: 'https://images.unsplash.com/photo-1628178651088-7243c7b3967d?q=80&w=400&auto=format', aval: '4.8', map: 'https://maps.google.com' },
    { nome: 'Mecânica Rápida Multimarcas', especialidade: 'Multimarcas', ende: 'Taguatinga Norte, QNM 34 - Brasília/DF', dist: '12.0 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1504151744883-faad76e0362f?q=80&w=400&auto=format', aval: '4.6', map: 'https://maps.google.com' },
    { nome: 'Concessionária Chevrolet', especialidade: 'Chevrolet', ende: 'W3 Norte 514/515 - Brasília/DF', dist: '2.1 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=400&auto=format', aval: '4.7', map: 'https://maps.google.com' },
    { nome: 'Auto Elétrica e Revisão Geral', especialidade: 'Fiat e Hyundai', ende: 'Guará II, QE 40 - Brasília/DF', dist: '8.3 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=400&auto=format', aval: '4.5', map: 'https://maps.google.com' },
  ];

  r.render('oficinas', {
    title: 'Locais e Oficinas',
    user: q.session.user,
    activePath: '/oficinas',
    OFICINAS,
  });
});

// ─── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  Pit Stop v4.0');
  console.log('  → http://localhost:' + PORT);
  console.log('  → Login: aluno / senha123');
  console.log('  → ' + CARROS.length + ' modelos\n');
});

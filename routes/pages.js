const express = require('express');
const bcrypt = require('bcrypt');
const { stmts, gastos, situacao, situacaoRev } = require('../db');
const CARROS = require('../carros');

const router = express.Router();
const SALT_ROUNDS = 10;

const ITENS_CHECKLIST = [
  { key: 'oleo_filtro',             label: 'Óleo e Filtro de Óleo' },
  { key: 'filtro_ar',               label: 'Filtro de Ar' },
  { key: 'filtro_combustivel',      label: 'Filtro de Combustível' },
  { key: 'freios_dianteiros',       label: 'Freios Dianteiros' },
  { key: 'freios_traseiros',        label: 'Freios Traseiros' },
  { key: 'pneus',                   label: 'Pneus e Calibragem' },
  { key: 'alinhamento_balanceamento', label: 'Alinhamento e Balanceamento' },
  { key: 'suspensao_dianteira',     label: 'Suspensão Dianteira' },
  { key: 'suspensao_traseira',      label: 'Suspensão Traseira' },
  { key: 'bateria',                 label: 'Bateria' },
  { key: 'correia_dentada',         label: 'Correia Dentada' },
  { key: 'sistema_arrefecimento',   label: 'Sistema de Arrefecimento' },
  { key: 'fluido_freio',            label: 'Fluido de Freio' },
  { key: 'fluido_direcao',          label: 'Fluido de Direção' },
  { key: 'ar_condicionado',         label: 'Ar-Condicionado' },
  { key: 'luzes_sinalizacao',       label: 'Luzes e Sinalização' },
  { key: 'escapamento',             label: 'Sistema de Escapamento' },
  { key: 'coxins',                  label: 'Coxins do Motor' },
  { key: 'velas_ignicao',           label: 'Velas de Ignição' },
  { key: 'limpadores',              label: 'Limpadores de Para-brisa' },
];

// ─── PERFIL API ───────────────────────────────────────────────────────────────
router.get('/api/perfil', (req, res) => {
  const u = stmts.getUser.get(req.session.user) || { usuario: req.session.user };
  res.json({
    usuario: u.usuario, nome: u.nome || '', email: u.email || '',
    telefone: u.telefone || '', cidade: u.cidade || '',
  });
});

router.put('/api/perfil', (req, res) => {
  const { nome, email, telefone, cidade } = req.body;
  stmts.updateProfile.run({
    nome: (nome || '').trim(), email: (email || '').trim(),
    telefone: (telefone || '').trim(), cidade: (cidade || '').trim(),
    usuario: req.session.user,
  });
  res.json({ ok: true });
});

router.put('/api/perfil/senha', async (req, res) => {
  const u = stmts.getUser.get(req.session.user);
  if (!u) return res.json({ ok: false, msg: 'Usuário não encontrado.' });
  const { senha_atual, senha_nova } = req.body;
  const isHash = u.senha.startsWith('$2');
  const ok = isHash ? await bcrypt.compare(senha_atual, u.senha) : u.senha === senha_atual;
  if (!ok) return res.json({ ok: false, msg: 'Senha atual incorreta.' });
  if (!senha_nova || senha_nova.length < 6)
    return res.json({ ok: false, msg: 'A nova senha deve ter pelo menos 6 caracteres.' });
  stmts.updatePassword.run(await bcrypt.hash(senha_nova, SALT_ROUNDS), req.session.user);
  res.json({ ok: true });
});

// ─── LANDING ──────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('landing');
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const vs = stmts.getVeiculos.all(req.session.user);
  const ms = stmts.getManutUser.all(req.session.user);
  const totalGasto = ms.reduce((s, m) => s + (m.custo || 0), 0);
  const alertas = vs.filter(v => situacao(v.id).tipo !== 'ok');
  const mmap = {};
  ms.forEach(m => {
    if (m.data) { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (m.custo || 0); }
  });
  const meses = Object.keys(mmap).sort().slice(-6);

  res.render('dashboard', {
    title: 'Dashboard', user: req.session.user, activePath: '/dashboard',
    vs, ms, alertas, totalGasto, meses, mmap,
    heroImg: vs[0]?.foto || vs[0]?.img || CARROS[0].img,
    heroModel: vs[0]?.modelo || 'Sua Garagem',
    heroBrand: vs[0]?.marca || 'Pit Stop',
    featuredCars: CARROS.slice(0, 3),
  });
});

// ─── GARAGEM ──────────────────────────────────────────────────────────────────
router.get('/garagem', (req, res) => {
  const vs = stmts.getVeiculos.all(req.session.user);
  res.render('garagem', {
    title: 'Minha Garagem', user: req.session.user, activePath: '/garagem',
    vsAtivos: vs.filter(v => v.ativo !== 0),
    vsInativos: vs.filter(v => v.ativo === 0),
  });
});

// ─── DETALHE VEÍCULO ──────────────────────────────────────────────────────────
router.get('/veiculo/:id', (req, res) => {
  const v = stmts.getVeiculo.get(parseInt(req.params.id), req.session.user);
  if (!v) return res.redirect('/garagem');
  const ms = stmts.getManutencoes.all(v.id);
  const totalGasto = gastos(v.id);
  const sit = situacao(v.id);
  const sitCls = sit.tipo === 'ok' ? 's-ok' : sit.tipo === 'critico' ? 's-cr' : 's-av';
  const mmap = {};
  ms.forEach(m => { if (m.data) { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (m.custo || 0); } });
  const meses = Object.keys(mmap).sort();
  const specs = [
    ['Motor', v.motor], ['Potência', v.potencia], ['Torque', v.torque],
    ['Câmbio', v.cambio], ['Tração', v.tracao], ['Combustível', v.combustivel],
    ['Consumo cidade', v.consumo_cidade], ['Consumo estrada', v.consumo_estrada],
    ['Porta-malas', v.porta_malas],
  ].filter(x => x[1]);
  const vRevs = stmts.getRevisoes.all(req.session.user)
    .filter(rv => rv.veiculo_id === v.id)
    .map(rv => ({ ...rv, itens_revisados: JSON.parse(rv.itens_revisados || '{}') }))
    .sort((a, b) => b.data.localeCompare(a.data));

  res.render('veiculo', {
    title: v.modelo, user: req.session.user, activePath: '/garagem',
    v, ms, vRevs, totalGasto, sit, sitCls, meses, mmap, specs,
    inativo: v.ativo === 0,
  });
});

// ─── CADASTRO ─────────────────────────────────────────────────────────────────
router.get('/cadastro', (req, res) => {
  res.render('cadastro', {
    title: 'Adicionar Carro', user: req.session.user, activePath: '/cadastro',
  });
});

// ─── EDITAR VEÍCULO ───────────────────────────────────────────────────────────
router.get('/editar-veiculo/:id', (req, res) => {
  const v = stmts.getVeiculo.get(parseInt(req.params.id), req.session.user);
  if (!v) return res.redirect('/garagem');
  res.render('editar-veiculo', {
    title: 'Editar Veículo', user: req.session.user, activePath: '/garagem',
    v, inativo: v.ativo === 0,
  });
});

// ─── MANUTENÇÃO ───────────────────────────────────────────────────────────────
router.get('/manutencao/:id', (req, res) => {
  const v = stmts.getVeiculo.get(parseInt(req.params.id), req.session.user);
  if (!v) return res.redirect('/garagem');
  res.render('manutencao', {
    title: 'Manutenção', user: req.session.user, activePath: '/garagem', v,
    tipos: ['Troca de Óleo', 'Revisão dos Freios', 'Troca de Pneus', 'Correia Dentada',
      'Alinhamento e Balanceamento', 'Troca de Bateria', 'Filtro de Ar',
      'Filtro de Combustível', 'Suspensão', 'Revisão Geral', 'Outro'],
  });
});

// ─── REVISÕES ─────────────────────────────────────────────────────────────────
router.get('/revisoes', (req, res) => {
  const vs = stmts.getVeiculos.all(req.session.user);
  const vsMap = {};
  vs.forEach(v => { vsMap[v.id] = v; });
  const revs = stmts.getRevisoes.all(req.session.user)
    .map(rv => ({ ...rv, itens_revisados: JSON.parse(rv.itens_revisados || '{}') }));
  const totCusto = revs.reduce((s, rv) => s + (rv.custo || 0), 0);
  const hoje = new Date();
  const atrasadas = revs.filter(rv => rv.proxima_data && new Date(rv.proxima_data) < hoje).length;
  const proximas = revs.filter(rv => {
    if (!rv.proxima_data) return false;
    const d = new Date(rv.proxima_data);
    const lim = new Date(); lim.setDate(hoje.getDate() + 30);
    return d >= hoje && d <= lim;
  }).length;

  res.render('revisoes', {
    title: 'Revisões', user: req.session.user, activePath: '/revisoes',
    vs, vsMap, revs, totCusto, atrasadas, proximas,
  });
});

// ─── NOVA REVISÃO ─────────────────────────────────────────────────────────────
router.get('/revisao/nova', (req, res) => {
  const vs = stmts.getVeiculos.all(req.session.user);
  if (!vs.length) return res.redirect('/cadastro');
  const vid = req.query.vid ? parseInt(req.query.vid) : '';
  res.render('revisao-nova', {
    title: 'Nova Revisão', user: req.session.user, activePath: '/revisoes',
    vs, vid, anoAtual: new Date().getFullYear(), ITENS_CHECKLIST,
    tipos: ['Revisão de 10.000 km', 'Revisão de 20.000 km', 'Revisão de 30.000 km',
      'Revisão de 40.000 km', 'Revisão de 60.000 km', 'Revisão de 80.000 km',
      'Revisão de 100.000 km', 'Revisão Simples', 'Revisão Completa', 'Revisão Pré-Viagem',
      'Revisão Anual', 'Revisão Pós-Compra', 'Outro'],
  });
});

// ─── LAUDO ────────────────────────────────────────────────────────────────────
router.get('/revisao/:id/documento', (req, res) => {
  const rv = stmts.getRevisao.get(parseInt(req.params.id));
  if (!rv) return res.redirect('/revisoes');
  const v = stmts.getVeiculo.get(rv.veiculo_id, req.session.user);
  if (!v) return res.redirect('/revisoes');
  const itens = JSON.parse(rv.itens_revisados || '{}');
  const aprovados = Object.values(itens).filter(x => x === 'aprovado').length;
  const atencoes  = Object.values(itens).filter(x => x === 'atencao').length;
  const total = ITENS_CHECKLIST.length;
  const saude = total > 0 ? Math.round(aprovados / total * 100) : 0;

  res.render('laudo', {
    title: `Laudo ${rv.numero_doc}`, user: req.session.user, activePath: '/revisoes',
    rv: { ...rv, itens_revisados: itens }, v, itens, itensChecklist: ITENS_CHECKLIST,
    aprovados, atencoes, total, saude,
    dataEmissao: new Date().toLocaleDateString('pt-BR'),
  });
});

// ─── PERFIL ───────────────────────────────────────────────────────────────────
router.get('/perfil', (req, res) => {
  const u = stmts.getUser.get(req.session.user) || { usuario: req.session.user };
  const vs = stmts.getVeiculos.all(req.session.user);
  const ms = stmts.getManutUser.all(req.session.user);
  const rvs = stmts.getRevisoes.all(req.session.user);
  const totalGasto = ms.reduce((s, m) => s + (m.custo || 0), 0);
  const nome = u.nome || req.session.user;

  res.render('perfil', {
    title: 'Meu Perfil', user: req.session.user, activePath: '/perfil',
    u, vs, ms, rvs, totalGasto, nome,
    ini: nome.charAt(0).toUpperCase(),
  });
});

// ─── EXPLORAR ─────────────────────────────────────────────────────────────────
router.get('/explorar', (req, res) => {
  const cats = ['Todos', ...new Set(CARROS.map(c => c.categoria))]
    .sort((a, b) => a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b));
  res.render('explorar', {
    title: 'Explorar Carros BR', user: req.session.user, activePath: '/explorar', cats,
  });
});

// ─── OFICINAS ─────────────────────────────────────────────────────────────────
router.get('/oficinas', (req, res) => {
  const OFICINAS = [
    { nome: 'Oficina Autorizada VW - Brasília', especialidade: 'Volkswagen', ende: 'SIA Trecho 2, Lote 450 - Brasília/DF', dist: '4.2 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&auto=format', aval: '4.9', map: 'https://maps.google.com' },
    { nome: 'Auto Center Premium', especialidade: 'BMW Premium', ende: 'Setor de Oficinas Sul (SOF Sul) - Brasília/DF', dist: '6.5 km', tipo: 'Especializada', img: 'https://images.unsplash.com/photo-1628178651088-7243c7b3967d?q=80&w=400&auto=format', aval: '4.8', map: 'https://maps.google.com' },
    { nome: 'Mecânica Rápida Multimarcas', especialidade: 'Multimarcas', ende: 'Taguatinga Norte, QNM 34 - Brasília/DF', dist: '12.0 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1504151744883-faad76e0362f?q=80&w=400&auto=format', aval: '4.6', map: 'https://maps.google.com' },
    { nome: 'Concessionária Chevrolet', especialidade: 'Chevrolet', ende: 'W3 Norte 514/515 - Brasília/DF', dist: '2.1 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=400&auto=format', aval: '4.7', map: 'https://maps.google.com' },
    { nome: 'Auto Elétrica e Revisão Geral', especialidade: 'Fiat e Hyundai', ende: 'Guará II, QE 40 - Brasília/DF', dist: '8.3 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=400&auto=format', aval: '4.5', map: 'https://maps.google.com' },
  ];
  res.render('oficinas', {
    title: 'Locais e Oficinas', user: req.session.user, activePath: '/oficinas', OFICINAS,
  });
});

module.exports = router;

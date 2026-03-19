const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const CARROS = require('./carros');

const app = express();
const PORT = 3000;
const DB = path.join(__dirname, 'db.json');

// ─── DB ───────────────────────────────────────────────────────────────────────
function lerDB() { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
function salvarDB(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'pitstop_2026', resave: false, saveUninitialized: false }));

// ─── HELPERS ───────────────────────────────────────────────────────────────────
const logado = (q, r, n) => q.session.user ? n() : r.redirect('/');
const brl = v => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gastos(vid) {
  return lerDB().manutencoes.filter(m => m.veiculo_id === vid).reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
}
function situacao(vid) {
  const ms = lerDB().manutencoes.filter(m => m.veiculo_id === vid);
  if (!ms.length) return { tipo: 'ok', texto: '✓ Em dia' };
  const hoje = new Date(); const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
  let cr = 0, av = 0;
  for (const m of ms) {
    if (m.proxima_data) {
      const d = new Date(m.proxima_data);
      if (d < hoje) cr++;
      else if (d <= lim30) av++;
    }
  }
  if (cr > 0) return { tipo: 'critico', texto: '⚠ Revisão atrasada' };
  if (av > 0) return { tipo: 'aviso', texto: '⏰ Revisão próxima' };
  return { tipo: 'ok', texto: '✓ Em dia' };
}

// ─── HTML HEAD + TOPNAV ────────────────────────────────────────────────────────
const HEAD = (title) => `<!DOCTYPE html><html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pit Stop — ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="/style.css?v=4">
</head>`;

function topnav(user, activePath) {
  const ini = (user || 'U').charAt(0).toUpperCase();
  const links = [
    ['/dashboard', 'Dashboard'],
    ['/garagem', 'Meus Carros'],
    ['/cadastro', 'Adicionar Carro'],
    ['/explorar', 'Explorar BR'],
    ['/oficinas', 'Locais'],
    ['/perfil', 'Perfil'],
  ];
  const items = links.map(([href, label]) =>
    `<li class="nav-item">
      <a href="${href}" class="${activePath === href ? 'active' : ''}">
        ${label}
      </a>
    </li>`).join('');
  const mobileLinks = links.map(([href, label]) =>
    `<a href="${href}" class="${activePath === href ? 'active' : ''}">${label}</a>`).join('');
  return `
  <nav class="topnav" id="topnav">
    <a href="/dashboard" class="nav-logo">
      <div class="nav-logo-dot"></div>
      PIT STOP
    </a>
    <ul class="nav-items">${items}</ul>
    <div class="nav-right">
      <div class="nav-avatar" title="Logado como ${user}">${ini}</div>
      <a href="/logout" class="btn btn-sm btn-ghost" style="color:rgba(255,255,255,.55);border-color:rgba(255,255,255,.15)">Sair</a>
      <button class="nav-btn-menu" id="mobileBtn" onclick="toggleMobile()" aria-label="Menu">
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </nav>
  <div class="mobile-menu" id="mobileMenu">${mobileLinks}<a href="/logout">Sair</a></div>`;
}

function pg(title, user, corpo, extra = '', activePath = '') {
  return `${HEAD(title)}
<body>
${topnav(user, activePath)}
<main class="main">${corpo}</main>
<div id="toasts"></div>
<script src="/main.js?v=4"></script>${extra}
</body></html>`;
}

// ─── API ───────────────────────────────────────────────────────────────────────
app.post('/api/login', (q, r) => {
  const { usuario, senha } = q.body;
  const db = lerDB();
  const u = db.usuarios?.find(x => x.usuario === usuario && x.senha === senha)
    || (usuario === 'aluno' && senha === 'senha123' ? { usuario: 'aluno' } : null);
  if (!u) return r.json({ ok: false });
  q.session.user = u.usuario;
  r.json({ ok: true });
});
app.get('/logout', (q, r) => { q.session.destroy(() => r.redirect('/')); });

app.get('/api/veiculos', logado, (q, r) => r.json(lerDB().veiculos.filter(v => v.usuario === q.session.user)));
app.post('/api/veiculos', logado, (q, r) => {
  const db = lerDB(); const id = (db.nextV || Date.now());
  db.veiculos.push({ id, ...q.body, usuario: q.session.user });
  db.nextV = (id + 1); salvarDB(db); r.json({ ok: true, id });
});
app.delete('/api/veiculos/:id', logado, (q, r) => {
  const db = lerDB(); const id = parseInt(q.params.id);
  db.veiculos = db.veiculos.filter(v => !(v.id === id && v.usuario === q.session.user));
  db.manutencoes = db.manutencoes.filter(m => m.veiculo_id !== id);
  salvarDB(db); r.json({ ok: true });
});

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

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
app.get('/', (q, r) => {
  if (q.session.user) return r.redirect('/dashboard');
  r.send(`${HEAD('Acesso')}
<body class="login-page">
  <div class="login-left">
    <div class="login-left-bg"></div>
    <div class="login-left-overlay"></div>
    <div class="login-left-content">
      <div class="login-left-label">Gestão Automotiva · 2026</div>
      <div class="login-left-title">Sua garagem<br>inteligente.</div>
    </div>
  </div>
  <div class="login-right">
    <div style="width:100%;max-width:360px">
      <div class="login-logo">PIT <span>STOP</span></div>
      <div class="login-tag">Gestão automotiva completa</div>
      <div class="login-hint">🎓 Demo acadêmico — acesse com:<br><b>aluno</b> / <b>senha123</b></div>
      <div class="form-group">
        <label class="form-label">Usuário</label>
        <input class="form-input" id="us" placeholder="aluno" autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label">Senha</label>
        <input class="form-input" type="password" id="pw" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-full" style="height:50px;font-size:1rem" onclick="login()">Entrar →</button>
      <div id="lerr" style="color:#E53030;font-size:.82rem;text-align:center;margin-top:10px"></div>
    </div>
  </div>
  <div id="toasts"></div>
  <script src="/main.js?v=4"></script>
  <script>
  document.getElementById('pw').addEventListener('keydown',function(e){if(e.key==='Enter')login();});
  document.getElementById('us').addEventListener('keydown',function(e){if(e.key==='Enter')login();});
  async function login(){
    var u=document.getElementById('us').value, p=document.getElementById('pw').value;
    if(!u||!p){document.getElementById('lerr').textContent='Preencha usuário e senha.';return;}
    var res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:u,senha:p})});
    var j=await res.json();
    if(j.ok){window.location.href='/dashboard';}
    else{document.getElementById('lerr').textContent='Usuário ou senha incorretos.';}
  }
  </script>
</body></html>`);
});

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
app.get('/dashboard', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const ms = db.manutencoes.filter(m => vs.find(v => v.id === m.veiculo_id));
  const tot = ms.reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
  const alertas = vs.filter(v => situacao(v.id).tipo !== 'ok');
  const mmap = {}; ms.forEach(m => { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (parseFloat(m.custo) || 0); });
  const meses = Object.keys(mmap).sort().slice(-6);

  const alertHtml = alertas.map(v => {
    const s = situacao(v.id);
    return `<div class="alert${s.tipo === 'critico' ? ' critical' : ''}">
      <span style="font-size:1.4rem">${s.tipo === 'critico' ? '🚨' : '⏰'}</span>
      <div style="flex:1"><b>${v.modelo}</b> — ${s.texto}<br>
        <span style="font-size:.78rem;color:var(--gray-600)">${v.placa ? 'Placa: ' + v.placa : ''}</span></div>
      <a href="/veiculo/${v.id}" class="btn btn-sm btn-outline">Ver detalhes</a>
    </div>`;
  }).join('');

  const heroImg = vs[0]?.img || CARROS[0].img;
  const heroModel = vs[0]?.modelo || 'Sua Garagem';
  const heroBrand = vs[0]?.marca || 'Pit Stop';

  const featuredCards = CARROS.slice(0, 3).map(c => `
    <a href="/explorar" class="car-card an an-d${CARROS.indexOf(c) + 3}" style="text-decoration:none">
      <div class="car-photo"><img src="${c.img}" alt="${c.modelo}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=900&auto=format'">
        <div class="car-photo-overlay"></div>
        <span class="tag-brand">${c.marca}</span>
      </div>
      <div class="car-body">
        <div class="car-name">${c.modelo}</div>
        <div class="car-info">${c.motor} · ${c.potencia}</div>
        <div style="margin-top:10px;font-weight:800;color:var(--or)">${c.preco_base}</div>
      </div>
    </a>`).join('');

  r.send(pg('Dashboard', q.session.user, `
  <div class="hero an an-d1">
    <img class="hero-bg" src="${heroImg}" alt="${heroModel}" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1400&auto=format'">
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <div class="hero-label">Bem-vindo ao Pit Stop</div>
      <div class="hero-title">${heroModel}</div>
      <div class="hero-sub">${heroBrand} · Sua garagem digital</div>
      <div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">
        <a href="/garagem" class="btn btn-primary">Minha Garagem →</a>
        <a href="/explorar" class="btn btn-dark" style="border:1.5px solid rgba(255,255,255,.2)">Explorar Carros BR</a>
      </div>
    </div>
  </div>
  <div class="g4 an an-d2">
    <div class="stat-card"><div class="stat-icon">🚗</div><div class="stat-label">Veículos</div><div class="stat-value orange">${vs.length}</div><div class="stat-detail">na garagem</div></div>
    <div class="stat-card"><div class="stat-icon">🔧</div><div class="stat-label">Manutenções</div><div class="stat-value blue">${ms.length}</div><div class="stat-detail">registradas</div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Total investido</div><div class="stat-value orange">R$ ${brl(tot)}</div><div class="stat-detail">em serviços</div></div>
    <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Alertas</div><div class="stat-value ${alertas.length ? 'red' : 'green'}">${alertas.length}</div><div class="stat-detail">pendentes</div></div>
  </div>
  ${alertas.length ? `<div class="section-label an an-d3">Alertas de manutenção</div><div style="margin-bottom:26px" class="an an-d4">${alertHtml}</div>` : ''}
  <div class="gchart an an-d4">
    <div class="chart-card"><div class="section-label">Gastos por mês</div><canvas id="gc" height="130"></canvas></div>
    <div class="chart-card" style="display:flex;flex-direction:column;gap:10px">
      <div class="section-label">Meus veículos</div>
      ${vs.length ? vs.map(v => `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--gray-50);border-radius:var(--r-sm)">
        <img src="${v.img}" style="width:60px;height:40px;object-fit:cover;border-radius:4px" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=200&auto=format'">
        <div style="flex:1"><div style="font-weight:700;font-size:.92rem">${v.modelo}</div><div style="color:var(--gray-400);font-size:.78rem">${v.marca} · ${v.ano}</div></div>
        <a href="/veiculo/${v.id}" class="btn btn-sm btn-ghost">→</a>
      </div>`).join('') : '<div class="no-items">Nenhum veículo. <a href="/cadastro">Adicionar</a></div>'}
    </div>
  </div>
  <div class="section-label an an-d5">Carros em destaque no Brasil</div>
  <div class="cars-grid an an-d6" style="margin-bottom:10px">${featuredCards}</div>
  <div style="text-align:right;margin-bottom:10px"><a href="/explorar" class="btn btn-ghost btn-sm">Ver todos os 27 modelos →</a></div>`,
    `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
var gc=document.getElementById('gc');if(gc)new Chart(gc,{type:'bar',data:{labels:${JSON.stringify(meses)},datasets:[{label:'R$',data:${JSON.stringify(meses.map(m => mmap[m]))},backgroundColor:'rgba(232,96,28,.8)',borderRadius:5,borderSkipped:false}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#9a9a9a'}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#9a9a9a',callback:function(v){return'R$'+v;}}}}}});
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
</script>`, '/dashboard'));
});

// ─── GARAGEM ────────────────────────────────────────────────────────────────────
app.get('/garagem', logado, (q, r) => {
  const vs = lerDB().veiculos.filter(v => v.usuario === q.session.user);
  const cards = vs.map((v, i) => {
    const s = situacao(v.id); const c = gastos(v.id);
    const sitCls = s.tipo === 'ok' ? 's-ok' : s.tipo === 'critico' ? 's-cr' : 's-av';
    return `<div onclick="window.location.href='/veiculo/${v.id}'" style="cursor:pointer" class="car-card an an-d${Math.min(i + 2, 6)}">
      <div class="car-photo">
        <img src="${v.img}" alt="${v.modelo}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=900&auto=format'">
        <div class="car-photo-overlay"></div>
        <span class="tag-brand">${v.marca}</span>
        <span class="tag-status ${sitCls}">${s.texto}</span>
      </div>
      <div class="car-body">
        <div class="car-name">${v.modelo}</div>
        <div class="car-info">${v.ano}${v.cor ? ' · ' + v.cor : ''}${v.motor ? ' · ' + v.motor : ''}</div>
        <div class="car-specs">
          <div><div class="spec-row-label">Quilometragem</div><div class="spec-row-value">${Number(v.km).toLocaleString('pt-BR')} km</div></div>
          <div><div class="spec-row-label">Placa</div><div class="spec-row-value">${v.placa || '—'}</div></div>
          <div><div class="spec-row-label">Total Gasto</div><div class="spec-row-value" style="color:var(--or)">R$ ${brl(c)}</div></div>
          <div><div class="spec-row-label">Potência</div><div class="spec-row-value">${v.potencia || '—'}</div></div>
        </div>
        <div class="car-actions" onclick="event.stopPropagation()">
          <a href="/veiculo/${v.id}" class="btn btn-primary" style="flex:1">Ver detalhes</a>
          <a href="/manutencao/${v.id}" class="btn btn-ghost btn-sm" title="Registrar manutenção">🔧</a>
        </div>
      </div>
    </div>`;
  }).join('');
  r.send(pg('Minha Garagem', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Minha <span>Garagem</span></div><div class="page-subtitle">${vs.length} carro(s) registrado(s)</div></div>
    <a href="/cadastro" class="btn btn-primary">+ Adicionar carro</a>
  </div>
  <div class="cars-grid">${cards || '<div class="no-items" style="grid-column:1/-1">Nenhum carro ainda. <a href="/cadastro">Adicionar meu primeiro carro →</a></div>'}</div>
  `, `<script>function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}</script>`, '/garagem'));
});

// ─── DETALHE ────────────────────────────────────────────────────────────────────
app.get('/veiculo/:id', logado, (q, r) => {
  const db = lerDB();
  const v = db.veiculos.find(x => x.id === parseInt(q.params.id) && x.usuario === q.session.user);
  if (!v) return r.redirect('/garagem');
  const ms = db.manutencoes.filter(m => m.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data));
  const c = gastos(v.id); const s = situacao(v.id);
  const mmap = {}; ms.forEach(m => { const mes = m.data.slice(0, 7); mmap[mes] = (mmap[mes] || 0) + (parseFloat(m.custo) || 0); });
  const meses = Object.keys(mmap).sort();
  const sitCls = s.tipo === 'ok' ? 's-ok' : s.tipo === 'critico' ? 's-cr' : 's-av';
  const specs = [['Motor', v.motor], ['Potência', v.potencia], ['Torque', v.torque], ['Câmbio', v.cambio], ['Tração', v.tracao], ['Combustível', v.combustivel], ['Consumo cidade', v.consumo_cidade], ['Consumo estrada', v.consumo_estrada], ['Porta-malas', v.porta_malas]].filter(x => x[1]);
  const histHtml = ms.map(m => `<tr>
    <td><span class="pill pill-orange">${m.tipo}</span></td><td style="color:var(--gray-600)">${m.descricao || '—'}</td>
    <td style="color:var(--gray-600)">${m.oficina || '—'}</td><td>${m.km_na_revisao ? m.km_na_revisao + ' km' : '—'}</td>
    <td style="font-weight:800;color:var(--or)">R$ ${brl(m.custo)}</td><td style="color:var(--gray-600)">${m.data}</td>
    <td style="color:var(--gray-600)">${m.proxima_data || '—'}</td>
    <td><button class="btn btn-danger btn-sm" onclick="remover(${m.id})">Remover</button></td>
  </tr>`).join('');
  r.send(pg(v.modelo, q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title"><span>${v.modelo}</span></div><div class="page-subtitle">${v.marca} · ${v.ano}${v.cor ? ' · ' + v.cor : ''}</div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a href="/manutencao/${v.id}" class="btn btn-primary">🔧 Registrar manutenção</a>
      <a href="/garagem" class="btn btn-ghost">← Voltar</a>
    </div>
  </div>
  <img class="det-photo an an-d2" src="${v.img}" alt="${v.modelo}" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=900&auto=format'">
  <div class="det-info an an-d3">
    <div style="display:flex;flex-wrap:wrap;gap:28px;align-items:center">
      <div><div class="spec-row-label">Marca</div><div style="font-size:1.3rem;font-weight:900">${v.marca}</div></div>
      <div><div class="spec-row-label">Ano</div><div style="font-size:1.3rem;font-weight:900">${v.ano}</div></div>
      <div><div class="spec-row-label">Placa</div><div style="font-size:1.3rem;font-weight:900">${v.placa || '—'}</div></div>
      <div><div class="spec-row-label">Quilometragem</div><div style="font-size:1.3rem;font-weight:900">${Number(v.km).toLocaleString('pt-BR')} km</div></div>
      <div><div class="spec-row-label">Total gasto</div><div style="font-size:1.3rem;font-weight:900;color:var(--or)">R$ ${brl(c)}</div></div>
      <div><div class="spec-row-label">Situação</div><span class="tag-status ${sitCls}" style="position:static">${s.texto}</span></div>
    </div>
    ${specs.length ? `<div class="det-specs">${specs.map(x => `<div class="spec-item"><div class="spec-r">${x[0]}</div><div class="spec-v">${x[1]}</div></div>`).join('')}</div>` : ''}
  </div>
  <div class="gchart an an-d4">
    <div class="stat-card"><div class="stat-label">Manutenções</div><div class="stat-value blue">${ms.length}</div><div class="stat-detail">registradas</div></div>
    <div class="chart-card"><div class="section-label">Gastos por mês</div><canvas id="gv" height="130"></canvas></div>
  </div>
  <div class="section-label an an-d5">Histórico de manutenções</div>
  <div class="table-wrap an an-d6"><table><thead><tr><th>Serviço</th><th>Descrição</th><th>Oficina</th><th>KM</th><th>Valor</th><th>Data</th><th>Próxima</th><th></th></tr></thead>
  <tbody>${histHtml || '<tr><td colspan="8" class="no-items">Nenhuma manutenção registrada.</td></tr>'}</tbody></table></div>`,
    `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
var gv=document.getElementById('gv');if(gv)new Chart(gv,{type:'line',data:{labels:${JSON.stringify(meses)},datasets:[{label:'R$',data:${JSON.stringify(meses.map(m => mmap[m]))},borderColor:'#E8601C',backgroundColor:'rgba(232,96,28,.1)',tension:.4,fill:true,pointBackgroundColor:'#E8601C',pointRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#9a9a9a'}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#9a9a9a',callback:function(v){return'R$'+v;}}}}}});
async function remover(id){if(!confirm('Remover esta manutenção?'))return;await fetch('/api/manut/'+id,{method:'DELETE'});toast('Manutenção removida','av');setTimeout(function(){location.reload();},900);}
</script>`, '/garagem'));
});

// ─── CADASTRO ──────────────────────────────────────────────────────────────────
app.get('/cadastro', logado, (q, r) => {
  r.send(pg('Adicionar Carro', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Adicionar <span>Carro</span></div><div class="page-subtitle">Busque o modelo para preencher automaticamente</div></div>
  </div>
  <div class="form-card an an-d2">
    <div class="form-group">
      <label class="form-label" style="color:var(--or)">🔍 Passo 1 — Busque o modelo</label>
      <div class="search-input-wrap">
        <svg class="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input class="search-input" id="bc" placeholder="Digite: Onix, Polo, HB20, Tracker...">
      </div>
      <p class="search-info" id="bi">Digite 2 ou mais letras para ver os modelos</p>
      <div class="search-results" id="bg" style="display:none"></div>
    </div>
    <div class="specs-preview" id="sb2">
      <div class="specs-preview-title">✅ Selecionado <button onclick="limpar()" class="btn btn-ghost btn-sm">✕ Limpar</button></div>
      <div class="specs-grid3" id="sg"></div>
    </div>
    <div class="divider"></div>
    <p class="form-label">📝 Passo 2 — Seus dados (Auto-fill ativado via Busca)</p>
    <div class="g2">
      <div class="form-group"><label class="form-label">Quilometragem atual *</label><input class="form-input" id="fk" type="number" placeholder="Ex: 25000"></div>
      <div class="form-group"><label class="form-label">Cor</label><input class="form-input" id="fc" placeholder="Ex: Branco Pérola"></div>
      <div class="form-group"><label class="form-label">Placa</label><input class="form-input" id="fp" placeholder="Ex: ABC-1234"></div>
    </div>
    <div style="display:flex;gap:12px;margin-top:24px">
      <a href="/garagem" class="btn btn-ghost" style="flex:1">Cancelar</a>
      <button class="btn btn-primary" style="flex:2" onclick="salvar()">✅ Salvar na garagem</button>
    </div>
  </div>`,
    `<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
var B=${JSON.stringify(CARROS)},RES=[],SEL=null;
var bc=document.getElementById('bc'),bg=document.getElementById('bg'),bi=document.getElementById('bi');
bc.addEventListener('input',function(){
  var q=this.value.trim().toLowerCase(); bg.style.display='none'; bg.innerHTML='';
  if(q.length<2){bi.textContent='Digite 2 ou mais letras para ver os modelos';return;}
  RES=B.filter(function(c){return(c.marca+' '+c.modelo).toLowerCase().indexOf(q)>=0;}).slice(0,12);
  if(RES.length===0){bi.textContent='Modelo não encontrado. Preencha manualmente abaixo.';return;}
  bi.textContent=RES.length+' modelo(s) — clique para selecionar:';
  var h='';
  for(var i=0;i<RES.length;i++){h+='<button type="button" class="car-option-btn" id="cb'+i+'" onclick="escolher('+i+')">'+'<img class="car-option-img" src="'+RES[i].img+'" alt="'+RES[i].modelo+'" onerror="this.src=\\'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=400&auto=format\\'">'+'<div class="car-option-info"><div class="car-option-name">'+RES[i].marca+' '+RES[i].modelo+'</div><div class="car-option-motor">'+(RES[i].motor||'')+'</div><span class="pill pill-orange" style="margin-top:5px;display:inline-block">'+(RES[i].categoria||'')+'</span></div></button>';}
  bg.innerHTML=h; bg.style.display='grid';
});
function escolher(i){
  SEL=RES[i];
  for(var k=0;k<RES.length;k++){var el=document.getElementById('cb'+k);if(el)el.classList.remove('selected');}
  var el2=document.getElementById('cb'+i);if(el2)el2.classList.add('selected');
  document.getElementById('fk').focus();
  var info=[['Motor',SEL.motor],['Potência',SEL.potencia],['Torque',SEL.torque],['Câmbio',SEL.cambio],['Tração',SEL.tracao],['Combustível',SEL.combustivel],['Consumo cidade',SEL.consumo_cidade],['Consumo estrada',SEL.consumo_estrada],['Porta-malas',SEL.porta_malas],['Preço base',SEL.preco_base]];
  var sg='';for(var j=0;j<info.length;j++){if(info[j][1])sg+='<div><div class="sp-r">'+info[j][0]+'</div><div class="sp-v">'+info[j][1]+'</div></div>';}
  document.getElementById('sg').innerHTML=sg;document.getElementById('sb2').classList.add('visible');
  toast(SEL.marca+' '+SEL.modelo+' selecionado! ✅');
}
function limpar(){
  bc.value='';bg.style.display='none';bg.innerHTML='';document.getElementById('sb2').classList.remove('visible');
  bi.textContent='Digite 2 ou mais letras para ver os modelos';SEL=null;RES=[];
  ['fk','fc','fp'].forEach(function(id){document.getElementById(id).value='';});
}
async function salvar(){
  if(!SEL){toast('Primeiro busque e selecione o modelo no Passo 1!','erro');return;}
  var d=Object.assign({}, SEL, {km:document.getElementById('fk').value.trim(),cor:document.getElementById('fc').value.trim(),placa:document.getElementById('fp').value.trim()});
  if(!d.km){toast('Preencha a Quilometragem para continuar!','erro');return;}
  var res=await fetch('/api/veiculos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
  var j=await res.json();
  if(j.ok){toast('Carro adicionado! 🚗');setTimeout(function(){window.location.href='/garagem';},1000);}
  else toast('Erro ao salvar.','erro');
}
</script>`, '/cadastro'));
});

// ─── MANUTENÇÃO ────────────────────────────────────────────────────────────────
app.get('/manutencao/:id', logado, (q, r) => {
  const v = lerDB().veiculos.find(x => x.id === parseInt(q.params.id) && x.usuario === q.session.user);
  if (!v) return r.redirect('/garagem');
  const tipos = ['Troca de Óleo', 'Revisão dos Freios', 'Troca de Pneus', 'Correia Dentada', 'Alinhamento e Balanceamento', 'Troca de Bateria', 'Filtro de Ar', 'Filtro de Combustível', 'Suspensão', 'Revisão Geral', 'Outro'];
  r.send(pg('Manutenção', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Registrar <span>Manutenção</span></div><div class="page-subtitle">${v.modelo} ${v.ano}</div></div>
    <a href="/veiculo/${v.id}" class="btn btn-ghost">← Voltar</a>
  </div>
  <div class="form-card an an-d2">
    <div class="alert" style="margin-bottom:22px">
      📝 Registrando serviço para o <b>${v.modelo}</b>. Mantenha o histórico completo para alertas automáticos de revisão.
    </div>
    <div class="g2">
      <div class="form-group"><label class="form-label">Tipo de serviço *</label><select class="form-input" id="tp">${tipos.map(t => '<option>' + t + '</option>').join('')}</select></div>
      <div class="form-group"><label class="form-label">Oficina / Mecânico</label><input class="form-input" id="of" placeholder="Ex: AutoCenter Brasília"></div>
      <div class="form-group"><label class="form-label">Data do serviço *</label><input class="form-input" id="dt" type="date"></div>
      <div class="form-group"><label class="form-label">KM no serviço</label><input class="form-input" id="km" type="number" placeholder="Ex: 45000"></div>
      <div class="form-group"><label class="form-label">Valor pago (R$)</label><input class="form-input" id="cu" type="number" step="0.01" placeholder="Ex: 350"></div>
      <div class="form-group"><label class="form-label">Data da próxima revisão</label><input class="form-input" id="pd" type="date"></div>
      <div class="form-group"><label class="form-label">KM da próxima troca</label><input class="form-input" id="pk" type="number" placeholder="Ex: 50000"></div>
    </div>
    <div class="form-group"><label class="form-label">Observações</label><textarea class="form-input" id="de" rows="3" placeholder="Anote qualquer detalhe do serviço..."></textarea></div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <a href="/veiculo/${v.id}" class="btn btn-ghost" style="flex:1">Cancelar</a>
      <button class="btn btn-primary" style="flex:2" onclick="salvar()">✅ Salvar manutenção</button>
    </div>
  </div>`,
    `<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
document.getElementById('dt').valueAsDate=new Date();
async function salvar(){
  var d={tipo:document.getElementById('tp').value,oficina:document.getElementById('of').value,data:document.getElementById('dt').value,km_na_revisao:document.getElementById('km').value,custo:document.getElementById('cu').value||0,proxima_data:document.getElementById('pd').value||null,proxima_km:document.getElementById('pk').value||null,descricao:document.getElementById('de').value};
  if(!d.data){toast('Informe a data do serviço!','erro');return;}
  var res=await fetch('/api/manut/${v.id}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
  var j=await res.json();
  if(j.ok){toast('Manutenção salva! 🔧');setTimeout(function(){window.location.href='/veiculo/${v.id}';},900);}
  else toast('Erro ao salvar.','erro');
}
</script>`, '/garagem'));
});

// ─── EXPLORAR ──────────────────────────────────────────────────────────────────
app.get('/explorar', logado, (q, r) => {
  const cats = ['Todos', ...new Set(CARROS.map(c => c.categoria))].sort((a, b) => a === 'Todos' ? -1 : b === 'Todos' ? 1 : a.localeCompare(b));
  const filterBtns = cats.map(c => `<button class="filter-btn${c === 'Todos' ? ' active' : ''}" data-cat="${c}" onclick="catalogFilter('${c}')">${c}</button>`).join('');
  const cards = CARROS.map((c, i) => `
    <div class="catalog-card an an-d${Math.min((i % 6) + 1, 6)}" data-category="${c.categoria}" data-name="${c.modelo}" data-brand="${c.marca}">
      <div class="catalog-photo">
        <img src="${c.img}" alt="${c.modelo}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=900&auto=format'">
        <div class="catalog-photo-overlay"></div>
        <span class="catalog-category">${c.categoria}</span>
      </div>
      <div class="catalog-body">
        <div class="catalog-name">${c.modelo}</div>
        <div class="catalog-brand">${c.marca} · ${c.ano}</div>
        <div class="catalog-specs-mini">
          <div><div class="csm-l">Motor</div><div class="csm-v">${c.motor || '—'}</div></div>
          <div><div class="csm-l">Potência</div><div class="csm-v">${c.potencia || '—'}</div></div>
          <div><div class="csm-l">Consumo</div><div class="csm-v">${c.consumo_cidade || '—'}</div></div>
          <div><div class="csm-l">Porta-malas</div><div class="csm-v">${c.porta_malas || '—'}</div></div>
        </div>
        <div class="catalog-price">
          <div><div class="catalog-price-label">Preço base</div><div class="catalog-price-value">${c.preco_base || 'Consulte'}</div></div>
          <span class="pill pill-${c.combustivel === 'Flex' ? 'green' : c.combustivel === 'Diesel' ? 'blue' : 'orange'}">${c.combustivel || 'Flex'}</span>
        </div>
        <div class="catalog-actions">
          <a href="/cadastro" class="btn btn-primary btn-sm" style="flex:1">+ Adicionar à garagem</a>
        </div>
      </div>
    </div>`).join('');
  r.send(pg('Explorar Carros BR', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Explorar <span>Carros BR</span></div><div class="page-subtitle">${CARROS.length} modelos populares do mercado brasileiro</div></div>
    <a href="/cadastro" class="btn btn-primary">+ Adicionar à garagem</a>
  </div>
  <div class="catalog-hero an an-d2">
    <div class="catalog-hero-title">🇧🇷 Os carros mais populares do Brasil</div>
    <div class="catalog-hero-sub">Explore especificações, consumo, preço e mais. Clique em "Adicionar" para registrar na sua garagem.</div>
  </div>
  <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;flex-wrap:wrap" class="an an-d3">
    <div class="search-input-wrap" style="flex:1;min-width:220px">
      <svg class="search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input class="search-input" id="catalog-search" placeholder="Buscar por marca ou modelo...">
    </div>
    <div style="color:var(--gray-400);font-size:.83rem;white-space:nowrap" id="catalog-count">${CARROS.length} modelo(s)</div>
  </div>
  <div class="filter-bar an an-d4">${filterBtns}</div>
  <div class="car-catalog-grid an an-d5">${cards}</div>`,
    `<script>function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}</script>`, '/explorar'));
});

// ─── PERFIL ────────────────────────────────────────────────────────────────────
app.get('/perfil', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const ms = db.manutencoes.filter(m => vs.find(v => v.id === m.veiculo_id));
  const tot = ms.reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
  const marcas = [...new Set(vs.map(v => v.marca))];
  const nome = q.session.user === 'aluno' ? 'Gustavo Pereira de Sousa' : q.session.user;
  const ini = nome.charAt(0).toUpperCase();
  r.send(pg('Meu Perfil', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Meu <span>Perfil</span></div><div class="page-subtitle">Conta e estatísticas</div></div>
  </div>
  <div class="profile-hero an an-d2">
    <div class="profile-avatar">${ini}</div>
    <div style="flex:1">
      <div style="font-size:1.8rem;font-weight:900;color:var(--white)">${nome}</div>
      <div style="color:rgba(255,255,255,.55);margin-top:4px">Ciência da Computação · CEUB · Gerente de Projeto</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <span class="pill pill-orange">5º Semestre</span>
        <span class="pill pill-blue">Projeto Integrador</span>
        <span class="pill pill-green">Sprint 01 · 2026</span>
      </div>
    </div>
  </div>
  <div class="g4 an an-d3">
    <div class="stat-card"><div class="stat-icon">🚗</div><div class="stat-label">Carros</div><div class="stat-value orange">${vs.length}</div><div class="stat-detail">na garagem</div></div>
    <div class="stat-card"><div class="stat-icon">🔧</div><div class="stat-label">Manutenções</div><div class="stat-value blue">${ms.length}</div><div class="stat-detail">registradas</div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Total investido</div><div class="stat-value orange">R$ ${brl(tot)}</div><div class="stat-detail">em serviços</div></div>
    <div class="stat-card"><div class="stat-icon">🇧🇷</div><div class="stat-label">Catálogo</div><div class="stat-value blue">${CARROS.length}</div><div class="stat-detail">modelos</div></div>
  </div>
  <div class="section-label an an-d4">Marcas na garagem</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px" class="an an-d5">
    ${marcas.length ? marcas.map(m => `<span class="pill pill-orange" style="padding:7px 18px">${m}</span>`).join('') : '<span style="color:var(--gray-400)">Nenhum veículo ainda.</span>'}
  </div>
  <div class="section-label an an-d5">Marcas disponíveis no catálogo</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap" class="an an-d6">
    ${[...new Set(CARROS.map(c => c.marca))].sort().map(m => `<span class="pill pill-blue">${m}</span>`).join('')}
  </div>`,
    `<script>function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}</script>`, '/perfil'));
});

// ─── OFICINAS E LOCAIS ───────────────────────────────────────────────────────────
app.get('/oficinas', logado, (q, r) => {
  const OFICINAS = [
    { nome: 'Oficina Autorizada VW - Brasília', especialidade: 'Volkswagen', ende: 'SIA Trecho 2, Lote 450 - Brasília/DF', dist: '4.2 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&auto=format', aval: '4.9', map: 'https://maps.google.com' },
    { nome: 'Auto Center Premium', especialidade: 'BMW Premium', ende: 'Setor de Oficinas Sul (SOF Sul) - Brasília/DF', dist: '6.5 km', tipo: 'Especializada', img: 'https://images.unsplash.com/photo-1628178651088-7243c7b3967d?q=80&w=400&auto=format', aval: '4.8', map: 'https://maps.google.com' },
    { nome: 'Mecânica Rápida Multimarcas', especialidade: 'Multimarcas', ende: 'Taguatinga Norte, QNM 34 - Brasília/DF', dist: '12.0 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1504151744883-faad76e0362f?q=80&w=400&auto=format', aval: '4.6', map: 'https://maps.google.com' },
    { nome: 'Concessionária Chevrolet', especialidade: 'Chevrolet', ende: 'W3 Norte 514/515 - Brasília/DF', dist: '2.1 km', tipo: 'Autorizada', img: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=400&auto=format', aval: '4.7', map: 'https://maps.google.com' },
    { nome: 'Auto Elétrica e Revisão Geral', especialidade: 'Fiat e Hyundai', ende: 'Guará II, QE 40 - Brasília/DF', dist: '8.3 km', tipo: 'Oficina Independente', img: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=400&auto=format', aval: '4.5', map: 'https://maps.google.com' }
  ];

  const cards = OFICINAS.map((o, i) => `
    <div class="catalog-card an an-d${Math.min((i % 6) + 1, 6)}">
      <div class="catalog-photo" style="height:140px">
        <img src="${o.img}" alt="${o.nome}" loading="lazy" style="object-position:center">
        <div class="catalog-photo-overlay"></div>
        <span class="catalog-category">${o.tipo}</span>
      </div>
      <div class="catalog-body">
        <div class="catalog-name" style="font-size:1.1rem">${o.nome}</div>
        <div class="catalog-brand" style="margin-bottom:8px">⭐ ${o.aval} · Esp: ${o.especialidade}</div>
        <div style="font-size:0.85rem;color:var(--gray-600);margin-bottom:12px;line-height:1.4">
          📍 ${o.ende}<br>🚗 Aprox. ${o.dist}
        </div>
        <div class="catalog-actions">
          <a href="#" class="btn btn-outline btn-sm" style="flex:1" onclick="toast('Abrindo Google Maps para rota...'); event.preventDefault();">Ver Rota</a>
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="toast('Horário ${o.nome} solicitado com sucesso!', 'av')">Agendar</button>
        </div>
      </div>
    </div>`).join('');

  r.send(pg('Locais e Oficinas', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Locais e <span>Oficinas</span></div><div class="page-subtitle">Encontre pontos de manutenção parceiros do Pit Stop</div></div>
  </div>
  <div style="display:flex;gap:12px;margin-bottom:18px" class="an an-d2">
    <button class="filter-btn active">Todas</button>
    <button class="filter-btn">Autorizadas</button>
    <button class="filter-btn">Independentes</button>
  </div>
  <div class="car-catalog-grid an an-d3">
    ${cards}
  </div>`,
    `<script>function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}</script>`, '/oficinas'));
});

// ─── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n  🏁 Pit Stop v4.0 — BMW Style');
  console.log('  → http://localhost:' + PORT);
  console.log('  → Login: aluno / senha123');
  console.log('  → ' + CARROS.length + ' modelos\n');
});
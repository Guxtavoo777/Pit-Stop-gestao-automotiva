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
    ['/revisoes', 'Revisões'],
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

app.post('/api/cadastro', (q, r) => {
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
  db.usuarios.push({ usuario, senha, nome: nome || usuario });
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

app.put('/api/perfil/senha', logado, (q, r) => {
  const db = lerDB();
  if (!db.usuarios) db.usuarios = [];
  let u = db.usuarios.find(x => x.usuario === q.session.user);
  if (!u) { u = { usuario: q.session.user, senha: 'senha123' }; db.usuarios.push(u); }
  const { senha_atual, senha_nova } = q.body;
  // usuario demo "aluno" aceita senha123 mesmo que não esteja no array
  const senhaOk = u.senha === senha_atual || (q.session.user === 'aluno' && senha_atual === 'senha123');
  if (!senhaOk) return r.json({ ok: false, msg: 'Senha atual incorreta.' });
  if (!senha_nova || senha_nova.length < 6) return r.json({ ok: false, msg: 'A nova senha deve ter pelo menos 6 caracteres.' });
  u.senha = senha_nova;
  salvarDB(db);
  r.json({ ok: true });
});

// ─── PÁGINA PERFIL ─────────────────────────────────────────────────────────────
app.get('/perfil', logado, (q, r) => {
  const db = lerDB();
  const u = db.usuarios?.find(x => x.usuario === q.session.user) || { usuario: q.session.user };
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const ms = db.manutencoes.filter(m => vs.find(v => v.id === m.veiculo_id));
  const rvs = (db.revisoes || []).filter(rv => rv.usuario === q.session.user);
  const totalGasto = ms.reduce((s, m) => s + (parseFloat(m.custo) || 0), 0);
  const nome = u.nome || q.session.user;
  const ini = nome.charAt(0).toUpperCase();

  r.send(pg('Meu Perfil', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Meu <span>Perfil</span></div><div class="page-subtitle">Gerencie seus dados pessoais e senha</div></div>
  </div>

  <div class="perfil-layout">

    <!-- CARD AVATAR / RESUMO -->
    <div class="perfil-sidebar an an-d2">
      <div class="perfil-avatar-wrap">
        <div class="perfil-avatar" id="avatarCircle">${ini}</div>
        <div class="perfil-avatar-name" id="avatarName">${nome}</div>
        <div class="perfil-avatar-user">@${q.session.user}</div>
      </div>
      <div class="perfil-stats">
        <div class="perfil-stat">
          <div class="perfil-stat-val">${vs.length}</div>
          <div class="perfil-stat-label">Veículos</div>
        </div>
        <div class="perfil-stat">
          <div class="perfil-stat-val">${ms.length}</div>
          <div class="perfil-stat-label">Manutenções</div>
        </div>
        <div class="perfil-stat">
          <div class="perfil-stat-val">${rvs.length}</div>
          <div class="perfil-stat-label">Revisões</div>
        </div>
        <div class="perfil-stat" style="grid-column:1/-1">
          <div class="perfil-stat-val orange">R$ ${brl(totalGasto)}</div>
          <div class="perfil-stat-label">Total investido</div>
        </div>
      </div>
      <a href="/garagem" class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%;text-align:center">← Minha Garagem</a>
    </div>

    <!-- FORMULÁRIOS -->
    <div class="perfil-content">

      <!-- DADOS PESSOAIS -->
      <div class="form-card an an-d3">
        <div class="perfil-section-title">👤 Dados Pessoais</div>
        <div class="g2" style="margin-top:20px">
          <div class="form-group">
            <label class="form-label">Nome completo</label>
            <input class="form-input" id="pf-nome" placeholder="Ex: João da Silva" value="${u.nome || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Usuário</label>
            <input class="form-input" value="${q.session.user}" disabled style="opacity:.5;cursor:not-allowed">
          </div>
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input class="form-input" id="pf-email" type="email" placeholder="Ex: joao@email.com" value="${u.email || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Telefone / WhatsApp</label>
            <input class="form-input" id="pf-tel" placeholder="Ex: (61) 99999-9999" value="${u.telefone || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Cidade / Estado</label>
            <input class="form-input" id="pf-cidade" placeholder="Ex: Brasília / DF" value="${u.cidade || ''}">
          </div>
        </div>
        <div style="margin-top:24px;display:flex;gap:10px">
          <button class="btn btn-primary" style="flex:1" onclick="salvarPerfil()">✅ Salvar dados</button>
        </div>
        <div class="perfil-feedback" id="pf-msg"></div>
      </div>

      <!-- TROCAR SENHA -->
      <div class="form-card an an-d4" style="margin-top:20px">
        <div class="perfil-section-title">🔒 Alterar Senha</div>
        <div class="g2" style="margin-top:20px">
          <div class="form-group" style="grid-column:1/-1">
            <label class="form-label">Senha atual</label>
            <div class="input-pw-wrap">
              <input class="form-input" id="pw-atual" type="password" placeholder="Digite sua senha atual" autocomplete="current-password">
              <button type="button" class="btn-eye" onclick="togglePw('pw-atual',this)">👁</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Nova senha</label>
            <div class="input-pw-wrap">
              <input class="form-input" id="pw-nova" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
              <button type="button" class="btn-eye" onclick="togglePw('pw-nova',this)">👁</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar nova senha</label>
            <div class="input-pw-wrap">
              <input class="form-input" id="pw-conf" type="password" placeholder="Repita a nova senha" autocomplete="new-password">
              <button type="button" class="btn-eye" onclick="togglePw('pw-conf',this)">👁</button>
            </div>
          </div>
        </div>
        <div style="margin-top:4px">
          <div class="pw-strength-bar"><div id="pw-strength-fill"></div></div>
          <div class="pw-strength-label" id="pw-strength-label"></div>
        </div>
        <div style="margin-top:20px;display:flex;gap:10px">
          <button class="btn btn-primary" style="flex:1" onclick="trocarSenha()">🔒 Alterar senha</button>
        </div>
        <div class="perfil-feedback" id="pw-msg"></div>
      </div>

      <!-- ZONA DE PERIGO -->
      <div class="form-card an an-d5" style="margin-top:20px;border-color:rgba(229,48,48,.25)">
        <div class="perfil-section-title" style="color:#E53030">⚠️ Zona de Perigo</div>
        <p style="font-size:.88rem;color:var(--gray-400);margin:14px 0 20px;line-height:1.7">Sair da plataforma encerrará sua sessão atual. Todos os seus dados permanecem salvos.</p>
        <a href="/logout" class="btn btn-danger" style="display:inline-flex;gap:8px;align-items:center">🚪 Sair da conta</a>
      </div>

    </div>
  </div>
  `, `<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}

// ── Força de senha
document.getElementById('pw-nova').addEventListener('input', function(){
  var v=this.value, s=0;
  if(v.length>=6)s++;
  if(v.length>=10)s++;
  if(/[A-Z]/.test(v))s++;
  if(/[0-9]/.test(v))s++;
  if(/[^A-Za-z0-9]/.test(v))s++;
  var fill=document.getElementById('pw-strength-fill');
  var lbl=document.getElementById('pw-strength-label');
  var cols=['','#E53030','#E8601C','#f0b429','#4caf50','#2e7d32'];
  var txts=['','Muito fraca','Fraca','Média','Forte','Muito forte'];
  fill.style.width=(s*20)+'%';
  fill.style.background=cols[s]||cols[1];
  lbl.textContent=txts[s]||'';
  lbl.style.color=cols[s]||cols[1];
});

// ── Toggle visualizar senha
function togglePw(id, btn){
  var inp=document.getElementById(id);
  inp.type=inp.type==='password'?'text':'password';
  btn.textContent=inp.type==='password'?'👁':'🙈';
}

// ── Salvar dados pessoais
async function salvarPerfil(){
  var d={nome:document.getElementById('pf-nome').value.trim(),email:document.getElementById('pf-email').value.trim(),telefone:document.getElementById('pf-tel').value.trim(),cidade:document.getElementById('pf-cidade').value.trim()};
  var msg=document.getElementById('pf-msg');
  var res=await fetch('/api/perfil',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
  var j=await res.json();
  if(j.ok){
    toast('Perfil atualizado com sucesso! ✅');
    msg.className='perfil-feedback ok'; msg.textContent='✓ Dados salvos!';
    // Atualiza avatar ao vivo
    var n=d.nome||'${q.session.user}';
    document.getElementById('avatarCircle').textContent=n.charAt(0).toUpperCase();
    document.getElementById('avatarName').textContent=n;
    setTimeout(function(){msg.textContent='';},3000);
  } else {
    msg.className='perfil-feedback err'; msg.textContent='✗ Erro ao salvar.';
  }
}

// ── Trocar senha
async function trocarSenha(){
  var atual=document.getElementById('pw-atual').value;
  var nova=document.getElementById('pw-nova').value;
  var conf=document.getElementById('pw-conf').value;
  var msg=document.getElementById('pw-msg');
  if(!atual||!nova||!conf){msg.className='perfil-feedback err';msg.textContent='✗ Preencha todos os campos.';return;}
  if(nova!==conf){msg.className='perfil-feedback err';msg.textContent='✗ As senhas não conferem.';return;}
  if(nova.length<6){msg.className='perfil-feedback err';msg.textContent='✗ A nova senha deve ter pelo menos 6 caracteres.';return;}
  var res=await fetch('/api/perfil/senha',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({senha_atual:atual,senha_nova:nova})});
  var j=await res.json();
  if(j.ok){
    toast('Senha alterada com sucesso! 🔒');
    msg.className='perfil-feedback ok'; msg.textContent='✓ Senha alterada!';
    ['pw-atual','pw-nova','pw-conf'].forEach(function(id){document.getElementById(id).value='';});
    document.getElementById('pw-strength-fill').style.width='0';
    document.getElementById('pw-strength-label').textContent='';
    setTimeout(function(){msg.textContent='';},3000);
  } else {
    msg.className='perfil-feedback err'; msg.textContent='✗ '+(j.msg||'Erro ao alterar senha.');
  }
}
</script>`, '/perfil'));
});

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
  r.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Pit Stop — Plataforma digital de gestão automotiva. Controle sua garagem, histórico de revisões e manutenções em um só lugar.">
<title>Pit Stop — Gestão Automotiva Inteligente</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="/style.css?v=4">
<style>
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:0 48px;height:68px;background:rgba(10,10,10,.92);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.06);transition:all .3s;}
.lp-nav.scrolled{background:rgba(10,10,10,.98);box-shadow:0 4px 32px rgba(0,0,0,.4);}
.lp-logo{font-size:1.15rem;font-weight:900;letter-spacing:4px;color:#fff;display:flex;align-items:center;gap:10px;text-decoration:none;}
.lp-logo-dot{width:8px;height:8px;border-radius:50%;background:#E8601C;box-shadow:0 0 12px #E8601C;animation:dot-pulse 2.5s ease-in-out infinite;}
.lp-nav-links{display:flex;align-items:center;gap:28px;}
.lp-nav-links a{color:rgba(255,255,255,.6);font-size:.82rem;font-weight:500;letter-spacing:.5px;text-decoration:none;transition:.2s;}
.lp-nav-links a:hover{color:#fff;}
.lp-btn-login{background:#E8601C;color:#fff;border:none;padding:10px 24px;border-radius:4px;font-family:'Inter',sans-serif;font-size:.83rem;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:all .2s;box-shadow:0 2px 12px rgba(232,96,28,.3);}
.lp-btn-login:hover{background:#C94E0E;transform:translateY(-1px);box-shadow:0 4px 20px rgba(232,96,28,.45);}
@media(max-width:768px){.lp-nav{padding:0 20px;}.lp-nav-links{display:none;}}
.lp-hero{min-height:100vh;background:#0a0a0a;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:120px 24px 80px;}
.lp-hero-bg{position:absolute;inset:0;background:url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=1600&auto=format') center/cover no-repeat;opacity:.18;}
.lp-hero-glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:800px;height:400px;background:radial-gradient(ellipse at center,rgba(232,96,28,.15) 0%,transparent 70%);pointer-events:none;}
.lp-hero-content{position:relative;z-index:2;text-align:center;max-width:820px;}
.lp-hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(232,96,28,.12);border:1px solid rgba(232,96,28,.3);color:#E8601C;padding:6px 16px;border-radius:99px;font-size:.72rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px;}
.lp-hero-title{font-size:clamp(2.6rem,7vw,5rem);font-weight:900;color:#fff;line-height:1.05;letter-spacing:-2px;margin-bottom:22px;}
.lp-hero-title span{color:#E8601C;}
.lp-hero-sub{font-size:1.1rem;color:rgba(255,255,255,.55);line-height:1.7;max-width:580px;margin:0 auto 40px;}
.lp-hero-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.lp-hero-cta .btn-main{background:#E8601C;color:#fff;padding:15px 36px;border-radius:4px;font-weight:700;font-size:1rem;border:none;cursor:pointer;font-family:'Inter',sans-serif;letter-spacing:.3px;transition:all .25s;box-shadow:0 4px 24px rgba(232,96,28,.4);}
.lp-hero-cta .btn-main:hover{background:#C94E0E;transform:translateY(-2px);box-shadow:0 8px 32px rgba(232,96,28,.5);}
.lp-hero-cta .btn-sec{background:transparent;color:rgba(255,255,255,.7);padding:15px 36px;border-radius:4px;font-weight:600;font-size:1rem;border:1.5px solid rgba(255,255,255,.18);cursor:pointer;font-family:'Inter',sans-serif;transition:all .25s;text-decoration:none;display:inline-flex;align-items:center;}
.lp-hero-cta .btn-sec:hover{border-color:rgba(255,255,255,.4);color:#fff;}
.lp-hero-stats{display:flex;gap:48px;justify-content:center;margin-top:60px;flex-wrap:wrap;}
.lp-stat{text-align:center;}
.lp-stat-num{font-size:2.2rem;font-weight:900;color:#E8601C;letter-spacing:-1px;}
.lp-stat-label{font-size:.72rem;color:rgba(255,255,255,.4);letter-spacing:2px;text-transform:uppercase;margin-top:4px;}
.lp-section{padding:96px 24px;}
.lp-section-light{background:#f9f9f9;}
.lp-section-dark{background:#0a0a0a;}
.lp-container{max-width:1100px;margin:0 auto;}
.lp-section-tag{font-size:.65rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#E8601C;margin-bottom:14px;}
.lp-section-title{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:900;letter-spacing:-1px;line-height:1.15;margin-bottom:18px;}
.lp-section-sub{font-size:1rem;line-height:1.75;color:#5a5a5a;max-width:600px;}
.lp-story-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center;margin-top:56px;}
.lp-story-img{border-radius:12px;overflow:hidden;position:relative;}
.lp-story-img img{width:100%;height:420px;object-fit:cover;display:block;}
.lp-story-img::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(232,96,28,.15),transparent);}
.lp-story-text .large{font-size:1.15rem;font-weight:700;color:#0a0a0a;line-height:1.65;margin-bottom:18px;}
.lp-story-text p{font-size:.95rem;color:#5a5a5a;line-height:1.8;margin-bottom:14px;}
.lp-story-year{display:flex;align-items:center;gap:16px;margin-top:28px;padding-top:24px;border-top:1px solid #e2e2e2;}
.lp-story-year-num{font-size:2.5rem;font-weight:900;color:#E8601C;letter-spacing:-2px;}
.lp-story-year-label{font-size:.9rem;color:#5a5a5a;line-height:1.4;}
@media(max-width:768px){.lp-story-grid{grid-template-columns:1fr;gap:36px;}}
.lp-features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;margin-top:52px;}
.lp-feature-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:32px;transition:all .3s;position:relative;overflow:hidden;}
.lp-feature-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#E8601C,#FF7A3A);opacity:0;transition:.3s;}
.lp-feature-card:hover{border-color:rgba(232,96,28,.3);background:rgba(232,96,28,.04);transform:translateY(-3px);}
.lp-feature-card:hover::before{opacity:1;}
.lp-feature-icon{font-size:2rem;margin-bottom:18px;}
.lp-feature-title{font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:10px;}
.lp-feature-desc{font-size:.88rem;color:rgba(255,255,255,.5);line-height:1.7;}
.lp-purpose{background:linear-gradient(135deg,#0a0a0a 0%,#1a0f0a 100%);padding:96px 24px;position:relative;overflow:hidden;}
.lp-purpose-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:300px;background:radial-gradient(ellipse,rgba(232,96,28,.1),transparent 70%);pointer-events:none;}
.lp-purpose-inner{max-width:760px;margin:0 auto;text-align:center;position:relative;z-index:1;}
.lp-purpose-quote{font-size:clamp(1.5rem,4vw,2.2rem);font-weight:900;color:#fff;line-height:1.35;letter-spacing:-.5px;margin-bottom:24px;}
.lp-purpose-quote em{color:#E8601C;font-style:normal;}
.lp-purpose-text{font-size:.95rem;color:rgba(255,255,255,.5);line-height:1.8;}
.lp-testimonials-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px;margin-top:52px;}
.lp-tcard{background:#fff;border:1px solid #e2e2e2;border-radius:12px;padding:28px;transition:all .25s;}
.lp-tcard:hover{border-color:rgba(232,96,28,.3);box-shadow:0 12px 36px rgba(0,0,0,.08);transform:translateY(-2px);}
.lp-tcard-stars{color:#E8601C;font-size:1rem;margin-bottom:14px;letter-spacing:2px;}
.lp-tcard-text{font-size:.92rem;color:#2a2a2a;line-height:1.75;font-style:italic;margin-bottom:20px;}
.lp-tcard-author{display:flex;align-items:center;gap:12px;}
.lp-tcard-avatar{width:40px;height:40px;border-radius:50%;background:rgba(232,96,28,.12);border:2px solid rgba(232,96,28,.3);display:flex;align-items:center;justify-content:center;font-weight:800;color:#E8601C;font-size:.9rem;flex-shrink:0;}
.lp-tcard-name{font-weight:700;font-size:.88rem;}
.lp-tcard-role{font-size:.75rem;color:#9a9a9a;margin-top:2px;}
.lp-cta{background:#E8601C;padding:80px 24px;text-align:center;}
.lp-cta-title{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;color:#fff;letter-spacing:-1px;margin-bottom:14px;}
.lp-cta-sub{font-size:1rem;color:rgba(255,255,255,.75);margin-bottom:36px;}
.lp-cta-btn{background:#fff;color:#E8601C;padding:14px 40px;border-radius:4px;font-family:'Inter',sans-serif;font-size:1rem;font-weight:800;border:none;cursor:pointer;transition:all .25s;letter-spacing:.3px;}
.lp-cta-btn:hover{background:#f9f9f9;transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.2);}
.lp-footer{background:#0a0a0a;padding:32px 48px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,.06);flex-wrap:wrap;gap:16px;}
.lp-footer-logo{font-size:.95rem;font-weight:900;letter-spacing:4px;color:rgba(255,255,255,.4);}
.lp-footer-logo span{color:#E8601C;}
.lp-footer-copy{font-size:.72rem;color:rgba(255,255,255,.25);letter-spacing:.5px;}
.lp-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);z-index:500;display:none;align-items:center;justify-content:center;padding:20px;}
.lp-modal-overlay.open{display:flex;}
.lp-modal{background:#fff;border-radius:16px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.5);animation:modal-in .25s cubic-bezier(.4,0,.2,1);}
@keyframes modal-in{from{opacity:0;transform:scale(.95) translateY(16px);}to{opacity:1;transform:none;}}
.lp-modal-header{background:#0a0a0a;padding:28px 32px 24px;position:relative;}
.lp-modal-header::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#E8601C,#FF7A3A);}
.lp-modal-logo{font-size:1.1rem;font-weight:900;letter-spacing:4px;color:#fff;margin-bottom:4px;}
.lp-modal-logo span{color:#E8601C;}
.lp-modal-subtitle{font-size:.75rem;color:rgba(255,255,255,.4);letter-spacing:1px;}
.lp-modal-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.5);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.2s;}
.lp-modal-close:hover{background:rgba(255,255,255,.15);color:#fff;}
.lp-modal-body{padding:28px 32px 32px;}
.lp-modal-hint{background:rgba(232,96,28,.07);border:1px solid rgba(232,96,28,.2);border-radius:6px;padding:10px 14px;font-size:.78rem;color:#5a5a5a;margin-bottom:20px;line-height:1.5;}
.lp-modal-hint b{color:#E8601C;}
.lp-modal-err{color:#E53030;font-size:.78rem;text-align:center;margin-top:10px;min-height:20px;}
.lp-modal-tabs{display:flex;border-bottom:1px solid #e2e2e2;}
.lp-modal-tab{flex:1;padding:13px;background:none;border:none;font-family:'Inter',sans-serif;font-size:.85rem;font-weight:600;color:#9a9a9a;cursor:pointer;transition:.2s;position:relative;}
.lp-modal-tab.active{color:#E8601C;}
.lp-modal-tab.active::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:2px;background:#E8601C;}
.lp-modal-tab:hover{color:#0a0a0a;}
.lp-modal-switch{margin-top:16px;font-size:.78rem;color:#9a9a9a;text-align:center;}
.lp-modal-switch a{color:#E8601C;font-weight:600;text-decoration:none;}
.lp-modal-switch a:hover{text-decoration:underline;}
.lp-pw-bar{height:4px;background:#f0f0f0;border-radius:99px;overflow:hidden;margin-top:8px;}
.lp-pw-bar>div{height:100%;width:0;border-radius:99px;transition:width .3s,background .3s;}
.fade-up{opacity:0;transform:translateY(30px);transition:opacity .6s cubic-bezier(.4,0,.2,1),transform .6s cubic-bezier(.4,0,.2,1);}
.fade-up.visible{opacity:1;transform:none;}
</style>
</head>
<body style="margin:0;padding:0;font-family:'Inter',system-ui,sans-serif;background:#0a0a0a">

<nav class="lp-nav" id="lp-nav">
  <a href="/" class="lp-logo"><div class="lp-logo-dot"></div>PIT STOP</a>
  <div class="lp-nav-links">
    <a href="#sobre">Sobre</a>
    <a href="#funcionalidades">Funcionalidades</a>
    <a href="#proposito">Propósito</a>
    <a href="#avaliacoes">Avaliações</a>
  </div>
  <button class="lp-btn-login" onclick="abrirLogin()">Entrar na plataforma →</button>
</nav>

<section class="lp-hero">
  <div class="lp-hero-bg"></div>
  <div class="lp-hero-glow"></div>
  <div class="lp-hero-content">
    <div class="lp-hero-badge">🏁 Gestão Automotiva · 2026</div>
    <h1 class="lp-hero-title">Sua garagem,<br><span>digital e inteligente.</span></h1>
    <p class="lp-hero-sub">Controle o histórico completo de revisões, manutenções e gastos de todos os seus veículos em um único lugar — com laudos digitais e alertas automáticos.</p>
    <div class="lp-hero-cta">
      <button class="btn-main" onclick="abrirLogin()">Acessar minha garagem →</button>
      <a href="#sobre" class="btn-sec">Saiba mais ↓</a>
    </div>
    <div class="lp-hero-stats">
      <div class="lp-stat"><div class="lp-stat-num">27+</div><div class="lp-stat-label">Modelos catalogados</div></div>
      <div class="lp-stat"><div class="lp-stat-num">100%</div><div class="lp-stat-label">Digital e gratuito</div></div>
      <div class="lp-stat"><div class="lp-stat-num">5 ⭐</div><div class="lp-stat-label">Avaliação dos usuários</div></div>
    </div>
  </div>
</section>

<section class="lp-section lp-section-light" id="sobre">
  <div class="lp-container">
    <div class="lp-story-grid">
      <div class="lp-story-img fade-up">
        <img src="https://images.unsplash.com/photo-1625047509248-ec889cbff17f?q=80&w=800&auto=format" alt="Pit Stop — nascemos nas oficinas">
      </div>
      <div class="lp-story-text fade-up">
        <div class="lp-section-tag">Nossa história</div>
        <h2 class="lp-section-title" style="color:#0a0a0a">Como surgimos</h2>
        <p class="large">Nascemos de uma frustração real: a dificuldade de manter o histórico de manutenção dos carros organizado.</p>
        <p>Cadernos perdidos, recibos rasgados, datas esquecidas. Quantas vezes você foi trocar o óleo sem saber exatamente quando foi a última vez? Ou perdeu a garantia por não ter o comprovante?</p>
        <p>O <strong>Pit Stop</strong> surgiu como um projeto do CEUB para resolver exatamente isso — transformar a gestão automotiva em algo simples, digital e acessível para qualquer pessoa.</p>
        <div class="lp-story-year">
          <div class="lp-story-year-num">2026</div>
          <div class="lp-story-year-label">Ano de fundação<br><span style="color:#9a9a9a">Projeto Integrador · Ciência da Computação · CEUB</span></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="lp-section lp-section-dark" id="funcionalidades">
  <div class="lp-container">
    <div class="fade-up" style="text-align:center;margin-bottom:52px">
      <div class="lp-section-tag" style="display:inline-block">O que fazemos</div>
      <h2 class="lp-section-title" style="color:#fff;margin-bottom:12px">Tudo que sua garagem precisa</h2>
      <p class="lp-section-sub" style="color:rgba(255,255,255,.45);margin:0 auto">Uma plataforma completa para quem leva a sério o cuidado com seus veículos.</p>
    </div>
    <div class="lp-features-grid">
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">🏎️</div><div class="lp-feature-title">Garagem Digital</div><div class="lp-feature-desc">Cadastre todos os seus veículos com dados completos: motor, potência, câmbio, quilometragem e foto. Tudo num só lugar.</div></div>
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">📋</div><div class="lp-feature-title">Laudos de Revisão</div><div class="lp-feature-desc">Registre revisões com checklist de 20 itens. Cada revisão gera um documento digital numerado (REV-AAAA-NNN) para imprimir ou compartilhar.</div></div>
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">🔧</div><div class="lp-feature-title">Histórico de Manutenções</div><div class="lp-feature-desc">Registre troca de óleo, freios, pneus e qualquer serviço. Acompanhe o gasto total e a próxima manutenção.</div></div>
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">⚠️</div><div class="lp-feature-title">Alertas Inteligentes</div><div class="lp-feature-desc">Receba alertas automáticos quando uma revisão estiver atrasada ou próxima do prazo. Nunca mais esqueça a manutenção.</div></div>
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">📊</div><div class="lp-feature-title">Dashboard com Gráficos</div><div class="lp-feature-desc">Visualize seus gastos por mês em gráficos interativos. Saiba exatamente quanto investiu em cada veículo.</div></div>
      <div class="lp-feature-card fade-up"><div class="lp-feature-icon">🇧🇷</div><div class="lp-feature-title">Catálogo Brasileiro</div><div class="lp-feature-desc">Explore 27 modelos dos carros mais populares do Brasil com specs completas: motor, consumo, preço e mais.</div></div>
    </div>
  </div>
</section>

<section class="lp-purpose" id="proposito">
  <div class="lp-purpose-glow"></div>
  <div class="lp-purpose-inner">
    <div class="lp-section-tag" style="display:inline-block;margin-bottom:24px">Nosso propósito</div>
    <p class="lp-purpose-quote fade-up">"Acreditamos que <em>cuidar bem do seu carro</em> começa com ter as informações certas, no momento certo."</p>
    <p class="lp-purpose-text fade-up">O Pit Stop existe para democratizar o acesso a uma gestão automotiva profissional. Não importa se você tem um carro popular ou um premium — você merece saber o histórico completo do seu veículo, evitar surpresas mecânicas e ter controle total dos seus gastos. Simples assim.</p>
  </div>
</section>

<section class="lp-section lp-section-light" id="avaliacoes">
  <div class="lp-container">
    <div class="fade-up" style="text-align:center">
      <div class="lp-section-tag" style="display:inline-block">Depoimentos</div>
      <h2 class="lp-section-title" style="color:#0a0a0a">O que nossos usuários dizem</h2>
      <p class="lp-section-sub" style="margin:0 auto 52px">Pessoas reais que transformaram a forma como cuidam dos seus carros.</p>
    </div>
    <div class="lp-testimonials-grid">
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Finalmente consigo saber quando foi a última troca de óleo do meu Polo. O laudo digital é incrível — imprimo e deixo na luva do carro."</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">M</div><div><div class="lp-tcard-name">Marcos Oliveira</div><div class="lp-tcard-role">VW Polo 2019 · Brasília/DF</div></div></div></div>
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Os alertas automáticos me salvaram! Recebi o aviso de revisão atrasada da minha BMW antes de uma viagem longa. Evitei um problema sério."</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">A</div><div><div class="lp-tcard-name">Ana Carolina</div><div class="lp-tcard-role">BMW X1 2015 · São Paulo/SP</div></div></div></div>
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Tenho 3 carros e controlava tudo em planilha. O Pit Stop simplificou completamente minha vida. O dashboard de gastos por mês é excelente."</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">R</div><div><div class="lp-tcard-name">Roberto Santos</div><div class="lp-tcard-role">3 veículos · Goiânia/GO</div></div></div></div>
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Comprei um carro usado e não sabia o histórico. Comecei a registrar tudo desde o dia da compra. Agora tenho um histórico completo e organizado."</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">F</div><div><div class="lp-tcard-name">Fernanda Lima</div><div class="lp-tcard-role">HB20 2022 · Cuiabá/MT</div></div></div></div>
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Mostrei o Pit Stop pro meu mecânico e ele adorou. Agora ele registra as revisões na plataforma e eu recebo o laudo digital na hora."</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">G</div><div><div class="lp-tcard-name">Gabriel Mendes</div><div class="lp-tcard-role">Tracker 2023 · BH/MG</div></div></div></div>
      <div class="lp-tcard fade-up"><div class="lp-tcard-stars">★★★★★</div><p class="lp-tcard-text">"Interface bonita, rápida e fácil. Em 5 minutos já tinha meu carro cadastrado e o histórico preenchido. Recomendo demais!"</p><div class="lp-tcard-author"><div class="lp-tcard-avatar">J</div><div><div class="lp-tcard-name">Juliana Costa</div><div class="lp-tcard-role">Onix 2021 · Porto Alegre/RS</div></div></div></div>
    </div>
  </div>
</section>

<section class="lp-cta">
  <div class="lp-container">
    <h2 class="lp-cta-title fade-up">Pronto para organizar sua garagem?</h2>
    <p class="lp-cta-sub fade-up">Acesso gratuito. Sem complicação. Comece agora.</p>
    <button class="lp-cta-btn" onclick="abrirLogin()">Criar minha conta gratuita →</button>
  </div>
</section>

<footer class="lp-footer">
  <div class="lp-footer-logo">PIT <span>STOP</span></div>
  <div class="lp-footer-copy">© 2026 Pit Stop — Gestão Automotiva · Projeto Integrador CEUB</div>
</footer>

<div class="lp-modal-overlay" id="loginModal" onclick="fecharLogin(event)">
  <div class="lp-modal" onclick="event.stopPropagation()">
    <div class="lp-modal-header">
      <div class="lp-modal-logo">PIT <span>STOP</span></div>
      <div class="lp-modal-subtitle" id="lp-modal-sub">Acesse sua garagem digital</div>
      <button class="lp-modal-close" onclick="fecharLogin(null)">✕</button>
    </div>
    <!-- Abas -->
    <div class="lp-modal-tabs">
      <button class="lp-modal-tab active" id="tab-login" onclick="mudarAba('login')">Entrar</button>
      <button class="lp-modal-tab" id="tab-cadastro" onclick="mudarAba('cadastro')">Criar conta</button>
    </div>
    <!-- Painel Login -->
    <div class="lp-modal-body" id="painel-login">
      <div class="lp-modal-hint">🎓 Demo acadêmico · Acesse com <b>aluno</b> / <b>senha123</b></div>
      <div class="form-group">
        <label class="form-label">Usuário</label>
        <input class="form-input" id="lp-us" placeholder="aluno" autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label">Senha</label>
        <input class="form-input" type="password" id="lp-pw" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-full" id="lp-loginbtn" style="height:48px;font-size:.95rem;margin-top:4px" onclick="fazerLogin()">Entrar na plataforma →</button>
      <div class="lp-modal-err" id="lp-err"></div>
      <p class="lp-modal-switch">Não tem conta? <a href="#" onclick="mudarAba('cadastro');return false;">Criar conta grátis →</a></p>
    </div>
    <!-- Painel Cadastro -->
    <div class="lp-modal-body" id="painel-cadastro" style="display:none">
      <div class="form-group">
        <label class="form-label">Nome completo</label>
        <input class="form-input" id="cad-nome" placeholder="Ex: João da Silva" autocomplete="name">
      </div>
      <div class="form-group">
        <label class="form-label">Usuário <span style="color:var(--gray-400);font-weight:400;text-transform:none">(sem espaços, 3-20 chars)</span></label>
        <input class="form-input" id="cad-us" placeholder="Ex: joaosilva" autocomplete="username">
      </div>
      <div class="form-group">
        <label class="form-label">Senha <span style="color:var(--gray-400);font-weight:400;text-transform:none">(mín. 6 caracteres)</span></label>
        <input class="form-input" type="password" id="cad-pw" placeholder="••••••••" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmar senha</label>
        <input class="form-input" type="password" id="cad-pw2" placeholder="••••••••" autocomplete="new-password">
      </div>
      <div class="lp-pw-bar"><div id="lp-pw-fill"></div></div>
      <button class="btn btn-primary btn-full" id="lp-cadbtn" style="height:48px;font-size:.95rem;margin-top:12px" onclick="fazerCadastro()">Criar minha conta →</button>
      <div class="lp-modal-err" id="cad-err"></div>
      <p class="lp-modal-switch">Já tem conta? <a href="#" onclick="mudarAba('login');return false;">← Entrar</a></p>
    </div>
  </div>
</div>

<div id="toasts"></div>
<script src="/main.js?v=4"></script>
<script>
window.addEventListener('scroll',function(){document.getElementById('lp-nav').classList.toggle('scrolled',window.scrollY>40);});
var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('visible');});},{threshold:.12});
document.querySelectorAll('.fade-up').forEach(function(el){obs.observe(el);});
document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var t=document.querySelector(this.getAttribute('href'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});});});

function abrirLogin(aba){
  document.getElementById('loginModal').classList.add('open');
  mudarAba(aba||'login');
  setTimeout(function(){document.getElementById(aba==='cadastro'?'cad-nome':'lp-us').focus();},200);
}
function fecharLogin(e){if(!e||e.target===document.getElementById('loginModal'))document.getElementById('loginModal').classList.remove('open');}
document.addEventListener('keydown',function(e){if(e.key==='Escape')fecharLogin(null);});

function mudarAba(aba){
  var isLogin=aba==='login';
  document.getElementById('painel-login').style.display=isLogin?'block':'none';
  document.getElementById('painel-cadastro').style.display=isLogin?'none':'block';
  document.getElementById('tab-login').classList.toggle('active',isLogin);
  document.getElementById('tab-cadastro').classList.toggle('active',!isLogin);
  document.getElementById('lp-modal-sub').textContent=isLogin?'Acesse sua garagem digital':'Crie sua conta gratuita';
  document.getElementById('lp-err').textContent='';
  document.getElementById('cad-err').textContent='';
}

document.addEventListener('DOMContentLoaded',function(){
  document.getElementById('lp-pw').addEventListener('keydown',function(e){if(e.key==='Enter')fazerLogin();});
  document.getElementById('lp-us').addEventListener('keydown',function(e){if(e.key==='Enter')fazerLogin();});
  document.getElementById('cad-pw2').addEventListener('keydown',function(e){if(e.key==='Enter')fazerCadastro();});
  document.getElementById('cad-pw').addEventListener('input',function(){
    var v=this.value,s=0;
    if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
    var fill=document.getElementById('lp-pw-fill');
    var cols=['','#E53030','#E8601C','#f0b429','#4caf50','#2e7d32'];
    fill.style.width=(s*20)+'%';fill.style.background=cols[s]||cols[1];
  });
});

async function fazerLogin(){
  var u=document.getElementById('lp-us').value.trim(),p=document.getElementById('lp-pw').value.trim();
  var err=document.getElementById('lp-err'),btn=document.getElementById('lp-loginbtn');
  if(!u||!p){err.textContent='Preencha usuário e senha.';return;}
  err.textContent='';btn.textContent='Entrando...';btn.disabled=true;
  var res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:u,senha:p})});
  var j=await res.json();
  if(j.ok){window.location.href='/dashboard';}
  else{err.textContent='Usuário ou senha incorretos.';btn.textContent='Entrar na plataforma →';btn.disabled=false;}
}

async function fazerCadastro(){
  var nome=document.getElementById('cad-nome').value.trim();
  var u=document.getElementById('cad-us').value.trim();
  var p=document.getElementById('cad-pw').value;
  var p2=document.getElementById('cad-pw2').value;
  var err=document.getElementById('cad-err'),btn=document.getElementById('lp-cadbtn');
  if(!u||!p||!p2){err.textContent='Preencha todos os campos obrigatórios.';return;}
  if(p!==p2){err.textContent='As senhas não conferem.';return;}
  err.textContent='';btn.textContent='Criando conta...';btn.disabled=true;
  var res=await fetch('/api/cadastro',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:u,senha:p,senha2:p2,nome:nome})});
  var j=await res.json();
  if(j.ok){window.location.href='/dashboard';}
  else{err.textContent=j.msg||'Erro ao criar conta.';btn.textContent='Criar minha conta →';btn.disabled=false;}
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
  const vRevs = (db.revisoes || []).filter(rv => rv.veiculo_id === v.id).sort((a, b) => b.data.localeCompare(a.data));
  const revCardsHtml = vRevs.length ? vRevs.map(rv => {
    const sr = situacaoRev(rv);
    const sitCls2 = sr.tipo === 'ok' ? 'rev-ok' : sr.tipo === 'critico' ? 'rev-cr' : 'rev-av';
    const itensR = rv.itens_revisados || {};
    const totalR = Object.keys(itensR).length;
    const aprovR = Object.values(itensR).filter(x => x === 'aprovado').length;
    const atencR = Object.values(itensR).filter(x => x === 'atencao').length;
    return `<div class="rev-card" style="margin-bottom:12px">
      <div class="rev-card-header">
        <div>
          <div class="rev-doc-num">${rv.numero_doc}</div>
          <div class="rev-card-title">${rv.tipo}</div>
          <div class="rev-card-sub">${rv.data} · ${rv.oficina || '—'} · Mec: ${rv.mecanico || '—'}</div>
        </div>
        <span class="rev-status ${sitCls2}">${sr.texto}</span>
      </div>
      <div class="rev-card-body">
        <div class="rev-mini-stats">
          <div><span class="rev-mini-val" style="color:var(--ok)">${aprovR}</span><span class="rev-mini-label">Aprovados</span></div>
          <div><span class="rev-mini-val" style="color:var(--av)">${atencR}</span><span class="rev-mini-label">Atenção</span></div>
          <div><span class="rev-mini-val" style="color:var(--or)">${totalR > 0 ? Math.round(aprovR/totalR*100) : 0}%</span><span class="rev-mini-label">Saúde</span></div>
          <div><span class="rev-mini-val" style="color:var(--or)">R$ ${brl(rv.custo)}</span><span class="rev-mini-label">Custo</span></div>
        </div>
        <div class="rev-card-actions">
          <a href="/revisao/${rv.id}/documento" class="btn btn-outline btn-sm">📄 Ver Laudo</a>
          <button class="btn btn-danger btn-sm" onclick="removerRev(${rv.id})">Remover</button>
        </div>
      </div>
    </div>`;}).join('') : `<div class="no-items" style="padding:32px;text-align:center">Nenhuma revisão registrada para este veículo.</div>`;

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
  <div class="veiculo-tabs an an-d5">
    <button class="vtab-btn vtab-active" onclick="showTab('manut')">🔧 Manutenções (${ms.length})</button>
    <button class="vtab-btn" onclick="showTab('revisoes')">📋 Revisões (${vRevs.length})</button>
  </div>
  <div id="tab-manut">
    <div class="table-wrap"><table><thead><tr><th>Serviço</th><th>Descrição</th><th>Oficina</th><th>KM</th><th>Valor</th><th>Data</th><th>Próxima</th><th></th></tr></thead>
    <tbody>${histHtml || '<tr><td colspan="8" class="no-items">Nenhuma manutenção registrada.</td></tr>'}</tbody></table></div>
    <div style="margin-top:12px;text-align:right"><a href="/manutencao/${v.id}" class="btn btn-ghost btn-sm">+ Registrar manutenção</a></div>
  </div>
  <div id="tab-revisoes" style="display:none">
    ${revCardsHtml}
    <div style="margin-top:12px;text-align:right"><a href="/revisao/nova?vid=${v.id}" class="btn btn-primary btn-sm">+ Nova revisão</a></div>
  </div>`,
    `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
var gv=document.getElementById('gv');if(gv)new Chart(gv,{type:'line',data:{labels:${JSON.stringify(meses)},datasets:[{label:'R$',data:${JSON.stringify(meses.map(m => mmap[m]))},borderColor:'#E8601C',backgroundColor:'rgba(232,96,28,.1)',tension:.4,fill:true,pointBackgroundColor:'#E8601C',pointRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#9a9a9a'}},y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#9a9a9a',callback:function(v){return'R$'+v;}}}}}});
async function remover(id){if(!confirm('Remover esta manutenção?'))return;await fetch('/api/manut/'+id,{method:'DELETE'});toast('Manutenção removida','av');setTimeout(function(){location.reload();},900);}
async function removerRev(id){if(!confirm('Remover esta revisão?'))return;await fetch('/api/revisoes/'+id,{method:'DELETE'});toast('Revisão removida','av');setTimeout(function(){location.reload();},900);}
function showTab(t){
  document.getElementById('tab-manut').style.display=t==='manut'?'block':'none';
  document.getElementById('tab-revisoes').style.display=t==='revisoes'?'block':'none';
  document.querySelectorAll('.vtab-btn').forEach(function(b){b.classList.remove('vtab-active');});
  event.target.classList.add('vtab-active');
}
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

// ─── REVISÕES ─────────────────────────────────────────────────────────────────
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

function statusRevIcon(s) {
  if (s === 'aprovado') return '<span class="rev-check aprovado">✓ Aprovado</span>';
  if (s === 'atencao') return '<span class="rev-check atencao">⚠ Atenção</span>';
  return '<span class="rev-check nao_verificado">— Não verificado</span>';
}

function situacaoRev(rv) {
  if (!rv.proxima_data) return { tipo: 'ok', texto: '✓ Em dia' };
  const hoje = new Date(); const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
  const d = new Date(rv.proxima_data);
  if (d < hoje) return { tipo: 'critico', texto: '⚠ Revisão atrasada' };
  if (d <= lim30) return { tipo: 'aviso', texto: '⏰ Revisão próxima' };
  return { tipo: 'ok', texto: '✓ Em dia' };
}

app.get('/revisoes', logado, (q, r) => {
  const db = lerDB();
  const vs = db.veiculos.filter(v => v.usuario === q.session.user);
  const vsMap = {}; vs.forEach(v => { vsMap[v.id] = v; });
  const revs = (db.revisoes || []).filter(rv => vsMap[rv.veiculo_id]).sort((a, b) => b.data.localeCompare(a.data));
  const totCusto = revs.reduce((s, rv) => s + (parseFloat(rv.custo) || 0), 0);
  const hoje = new Date();
  const atrasadas = revs.filter(rv => rv.proxima_data && new Date(rv.proxima_data) < hoje).length;
  const proximas = revs.filter(rv => {
    if (!rv.proxima_data) return false;
    const d = new Date(rv.proxima_data); const lim = new Date(); lim.setDate(hoje.getDate() + 30);
    return d >= hoje && d <= lim;
  }).length;

  const timelineHtml = revs.length ? revs.map((rv, i) => {
    const v = vsMap[rv.veiculo_id] || {};
    const s = situacaoRev(rv);
    const sitCls = s.tipo === 'ok' ? 'rev-ok' : s.tipo === 'critico' ? 'rev-cr' : 'rev-av';
    const itens = rv.itens_revisados || {};
    const total = Object.keys(itens).length;
    const aprovados = Object.values(itens).filter(x => x === 'aprovado').length;
    const atencoes = Object.values(itens).filter(x => x === 'atencao').length;
    return `
    <div class="rev-timeline-item an an-d${Math.min(i + 2, 6)}">
      <div class="rev-timeline-dot ${sitCls}-dot"></div>
      <div class="rev-card">
        <div class="rev-card-header">
          <div>
            <div class="rev-doc-num">${rv.numero_doc}</div>
            <div class="rev-card-title">${rv.tipo}</div>
            <div class="rev-card-sub">${v.modelo || '—'} · ${v.placa || '—'} · ${rv.data}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span class="rev-status ${sitCls}">${s.texto}</span>
            <div style="font-size:.82rem;color:var(--gray-600)">Oficina: <b>${rv.oficina || '—'}</b></div>
          </div>
        </div>
        <div class="rev-card-body">
          <div class="rev-mini-stats">
            <div><span class="rev-mini-val" style="color:var(--ok)">${aprovados}</span><span class="rev-mini-label">Aprovados</span></div>
            <div><span class="rev-mini-val" style="color:var(--av)">${atencoes}</span><span class="rev-mini-label">Atenção</span></div>
            <div><span class="rev-mini-val" style="color:var(--or)">${total > 0 ? Math.round(aprovados/total*100) : 0}%</span><span class="rev-mini-label">Saúde</span></div>
            <div><span class="rev-mini-val">${rv.km_na_revisao ? Number(rv.km_na_revisao).toLocaleString('pt-BR') + ' km' : '—'}</span><span class="rev-mini-label">KM</span></div>
            <div><span class="rev-mini-val" style="color:var(--or)">R$ ${brl(rv.custo)}</span><span class="rev-mini-label">Custo</span></div>
          </div>
          <div class="rev-card-actions">
            <a href="/revisao/${rv.id}/documento" class="btn btn-outline btn-sm">📄 Ver Laudo</a>
            <button class="btn btn-danger btn-sm" onclick="removerRev(${rv.id})">Remover</button>
          </div>
        </div>
        ${rv.proxima_data ? `<div class="rev-proxima">📅 Próxima revisão: <b>${rv.proxima_data}</b>${rv.proxima_km ? ' · KM: <b>' + Number(rv.proxima_km).toLocaleString('pt-BR') + '</b>' : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('') : `<div class="no-items" style="padding:48px;text-align:center;border:1px solid var(--gray-200);border-radius:var(--r);background:var(--white)">Nenhuma revisão registrada ainda.<br><a href="/revisao/nova" class="btn btn-primary" style="margin-top:16px;display:inline-flex">+ Registrar primeira revisão</a></div>`;

  r.send(pg('Revisões', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Revisões <span>Digitais</span></div><div class="page-subtitle">${revs.length} revisão(ões) registrada(s) em ${vs.length} veículo(s)</div></div>
    <a href="/revisao/nova" class="btn btn-primary">+ Nova Revisão</a>
  </div>
  <div class="g4 an an-d2">
    <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">Total de Revisões</div><div class="stat-value blue">${revs.length}</div><div class="stat-detail">documentos emitidos</div></div>
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Em dia</div><div class="stat-value green">${revs.length - atrasadas - proximas}</div><div class="stat-detail">revisões ok</div></div>
    <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-label">Atrasadas</div><div class="stat-value ${atrasadas ? 'red' : 'green'}">${atrasadas}</div><div class="stat-detail">precisam de atenção</div></div>
    <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Total investido</div><div class="stat-value orange">R$ ${brl(totCusto)}</div><div class="stat-detail">em revisões</div></div>
  </div>
  <div class="section-label an an-d3">Histórico de revisões</div>
  <div class="rev-timeline an an-d4">${timelineHtml}</div>`,
    `<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
async function removerRev(id){
  if(!confirm('Remover esta revisão?'))return;
  await fetch('/api/revisoes/'+id,{method:'DELETE'});
  toast('Revisão removida','av');
  setTimeout(function(){location.reload();},900);
}
</script>`, '/revisoes'));
});

app.get('/revisao/nova', logado, (q, r) => {
  const vs = lerDB().veiculos.filter(v => v.usuario === q.session.user);
  if (!vs.length) return r.redirect('/cadastro');
  const vid = q.query.vid ? parseInt(q.query.vid) : '';
  const tipos = ['Revisão de 10.000 km', 'Revisão de 20.000 km', 'Revisão de 30.000 km', 'Revisão de 40.000 km', 'Revisão de 60.000 km', 'Revisão de 80.000 km', 'Revisão de 100.000 km', 'Revisão Simples', 'Revisão Completa', 'Revisão Pré-Viagem', 'Revisão Anual', 'Revisão Pós-Compra', 'Outro'];
  const checklistHtml = ITENS_CHECKLIST.map(item => `
    <div class="checklist-item" id="wrap_${item.key}">
      <div class="checklist-label"><span class="checklist-icon" id="icon_${item.key}">⬜</span>${item.label}</div>
      <div class="checklist-btns">
        <button type="button" class="chk-btn chk-aprovado" onclick="setItem('${item.key}','aprovado')">✓ Ok</button>
        <button type="button" class="chk-btn chk-atencao" onclick="setItem('${item.key}','atencao')">⚠ Atenção</button>
        <button type="button" class="chk-btn chk-skip" onclick="setItem('${item.key}','nao_verificado')">— Pular</button>
      </div>
    </div>`).join('');
  const veicOpts = vs.map(v => `<option value="${v.id}" ${v.id === vid ? 'selected' : ''}>${v.marca} ${v.modelo} (${v.ano}) — ${v.placa || 'sem placa'}</option>`).join('');
  r.send(pg('Nova Revisão', q.session.user, `
  <div class="page-header an an-d1">
    <div><div class="page-title">Nova <span>Revisão</span></div><div class="page-subtitle">Preencha o formulário e o checklist de inspeção</div></div>
    <a href="/revisoes" class="btn btn-ghost">← Voltar</a>
  </div>
  <div class="form-card an an-d2" style="max-width:900px">
    <div class="alert" style="margin-bottom:22px">
      📋 O documento de revisão será gerado automaticamente com número único (<b>REV-${new Date().getFullYear()}-NNN</b>) ao salvar.
    </div>
    <div class="section-label">Dados da revisão</div>
    <div class="g2">
      <div class="form-group"><label class="form-label">Veículo *</label><select class="form-input" id="rv_vid">${veicOpts}</select></div>
      <div class="form-group"><label class="form-label">Tipo de revisão *</label><select class="form-input" id="rv_tipo">${tipos.map(t => '<option>' + t + '</option>').join('')}</select></div>
      <div class="form-group"><label class="form-label">Data da revisão *</label><input class="form-input" type="date" id="rv_data"></div>
      <div class="form-group"><label class="form-label">KM no momento</label><input class="form-input" type="number" id="rv_km" placeholder="Ex: 45000"></div>
      <div class="form-group"><label class="form-label">Oficina / Centro automotivo</label><input class="form-input" id="rv_oficina" placeholder="Ex: AutoCenter Brasília"></div>
      <div class="form-group"><label class="form-label">Mecânico responsável</label><input class="form-input" id="rv_mecanico" placeholder="Ex: João Silva"></div>
      <div class="form-group"><label class="form-label">Valor total (R$)</label><input class="form-input" type="number" step="0.01" id="rv_custo" placeholder="Ex: 890"></div>
      <div class="form-group"><label class="form-label">Data da próxima revisão</label><input class="form-input" type="date" id="rv_proxdata"></div>
      <div class="form-group"><label class="form-label">KM da próxima revisão</label><input class="form-input" type="number" id="rv_proxkm" placeholder="Ex: 55000"></div>
    </div>
    <div class="form-group" style="grid-column:1/-1"><label class="form-label">Observações gerais</label><textarea class="form-input" id="rv_obs" rows="2" placeholder="Anote qualquer observação sobre o estado do veículo..."></textarea></div>
    <div class="divider"></div>
    <div class="section-label">Checklist de inspeção <span style="font-weight:400;font-size:.75rem;color:var(--gray-400);letter-spacing:0">— marque cada item abaixo</span></div>
    <div id="chk_progress" style="margin-bottom:16px;font-size:.83rem;color:var(--gray-600)">0 / ${ITENS_CHECKLIST.length} itens marcados</div>
    <div class="checklist-grid">${checklistHtml}</div>
    <div style="display:flex;gap:12px;margin-top:28px">
      <a href="/revisoes" class="btn btn-ghost" style="flex:1">Cancelar</a>
      <button class="btn btn-primary" style="flex:2" onclick="salvarRev()">📋 Salvar e Gerar Documento</button>
    </div>
  </div>`,
    `<script>
function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}
document.getElementById('rv_data').valueAsDate=new Date();
var ITENS=${JSON.stringify(ITENS_CHECKLIST)};
var estado={};
for(var i=0;i<ITENS.length;i++){estado[ITENS[i].key]='nao_verificado';}
function setItem(key,val){
  estado[key]=val;
  var wrap=document.getElementById('wrap_'+key);
  var icon=document.getElementById('icon_'+key);
  wrap.className='checklist-item chk-state-'+val;
  icon.textContent=val==='aprovado'?'✅':val==='atencao'?'⚠️':'⬜';
  atualizarProgresso();
}
function atualizarProgresso(){
  var marcados=Object.values(estado).filter(function(v){return v!=='nao_verificado';}).length;
  document.getElementById('chk_progress').textContent=marcados+' / '+ITENS.length+' itens marcados';
}
async function salvarRev(){
  var vid=document.getElementById('rv_vid').value;
  var tipo=document.getElementById('rv_tipo').value;
  var data=document.getElementById('rv_data').value;
  if(!vid||!tipo||!data){toast('Preencha veículo, tipo e data!','erro');return;}
  var body={
    veiculo_id:parseInt(vid),
    tipo:tipo,
    data:data,
    km_na_revisao:document.getElementById('rv_km').value||null,
    oficina:document.getElementById('rv_oficina').value,
    mecanico:document.getElementById('rv_mecanico').value,
    custo:parseFloat(document.getElementById('rv_custo').value)||0,
    proxima_data:document.getElementById('rv_proxdata').value||null,
    proxima_km:document.getElementById('rv_proxkm').value||null,
    descricao:document.getElementById('rv_obs').value,
    itens_revisados:estado,
    status:'aprovado'
  };
  var res=await fetch('/api/revisoes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var j=await res.json();
  if(j.ok){toast('Revisão salva! Documento '+j.numero_doc+' gerado ✅');setTimeout(function(){window.location.href='/revisao/'+j.id+'/documento';},1200);}
  else toast('Erro ao salvar.','erro');
}
</script>`, '/revisoes'));
});

app.get('/revisao/:id/documento', logado, (q, r) => {
  const db = lerDB();
  const rv = (db.revisoes || []).find(x => x.id === parseInt(q.params.id));
  if (!rv) return r.redirect('/revisoes');
  const v = db.veiculos.find(x => x.id === rv.veiculo_id && x.usuario === q.session.user);
  if (!v) return r.redirect('/revisoes');
  const itens = rv.itens_revisados || {};
  const checkHtml = ITENS_CHECKLIST.map(item => {
    const s = itens[item.key] || 'nao_verificado';
    const icon = s === 'aprovado' ? '✅' : s === 'atencao' ? '⚠️' : '—';
    const cls = s === 'aprovado' ? 'doc-item-ok' : s === 'atencao' ? 'doc-item-av' : 'doc-item-skip';
    return `<div class="doc-check-item ${cls}"><span class="doc-check-icon">${icon}</span><span>${item.label}</span></div>`;
  }).join('');
  const aprovados = Object.values(itens).filter(x => x === 'aprovado').length;
  const atencoes = Object.values(itens).filter(x => x === 'atencao').length;
  const total = ITENS_CHECKLIST.length;
  const saude = total > 0 ? Math.round(aprovados / total * 100) : 0;
  r.send(`<!DOCTYPE html><html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Laudo ${rv.numero_doc} — Pit Stop</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="/style.css?v=4">
<style>
.doc-wrap{max-width:820px;margin:0 auto;padding:40px 20px;}
.doc-header{background:var(--black);color:var(--white);border-radius:var(--r-lg) var(--r-lg) 0 0;padding:36px 40px;position:relative;overflow:hidden;}
.doc-header::after{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--or),var(--or3));}
.doc-logo{font-size:1.5rem;font-weight:900;letter-spacing:5px;color:var(--white);margin-bottom:4px;}
.doc-logo span{color:var(--or);}
.doc-num{font-size:2rem;font-weight:900;color:var(--or);letter-spacing:-1px;margin-bottom:4px;}
.doc-tipo{font-size:1rem;color:rgba(255,255,255,.7);letter-spacing:1px;}
.doc-body{background:var(--white);border:1px solid var(--gray-200);border-top:none;border-radius:0 0 var(--r-lg) var(--r-lg);padding:36px 40px;}
.doc-section{margin-bottom:28px;}
.doc-section-title{font-size:.62rem;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid var(--gray-200);display:flex;align-items:center;gap:10px;}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;}
.doc-field{background:var(--gray-50);border:1px solid var(--gray-100);border-radius:var(--r-sm);padding:12px 16px;}
.doc-field-label{font-size:.58rem;letter-spacing:2px;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px;font-weight:700;}
.doc-field-value{font-weight:700;font-size:.95rem;}
.doc-checks{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;}
.doc-check-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--r-sm);border:1px solid var(--gray-100);font-size:.88rem;font-weight:500;}
.doc-item-ok{background:rgba(29,185,84,.06);border-color:rgba(29,185,84,.2);}
.doc-item-av{background:rgba(232,96,28,.07);border-color:rgba(232,96,28,.25);}
.doc-item-skip{background:var(--gray-50);color:var(--gray-400);}
.doc-check-icon{font-size:1rem;flex-shrink:0;}
.doc-saude{display:flex;align-items:center;gap:24px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:var(--r);padding:18px 22px;margin-bottom:20px;flex-wrap:wrap;}
.doc-saude-num{font-size:2.5rem;font-weight:900;color:var(--or);letter-spacing:-2px;}
.doc-assinatura{border-top:1px solid var(--gray-200);margin-top:28px;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;}
.doc-assin-box{text-align:center;}
.doc-assin-line{width:160px;border-bottom:1.5px solid var(--black);margin:0 auto 6px;padding-bottom:4px;height:32px;display:flex;align-items:flex-end;justify-content:center;font-size:.8rem;color:var(--gray-400);}
.doc-assin-label{font-size:.62rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);}
.doc-actions{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;}
@media print{
  .doc-actions,.topnav,.mobile-menu{display:none!important;}
  .doc-wrap{padding:0;}
  body{background:white!important;}
}
</style>
</head><body>
${topnav(q.session.user, '/revisoes')}
<main class="main">
<div class="doc-wrap">
  <div class="doc-actions an an-d1">
    <a href="/revisoes" class="btn btn-ghost">← Voltar às revisões</a>
    <button onclick="window.print()" class="btn btn-primary">🖨️ Imprimir / Salvar PDF</button>
  </div>
  <div class="doc-header an an-d2">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:18px">
      <div>
        <div class="doc-logo">PIT <span>STOP</span></div>
        <div style="font-size:.68rem;letter-spacing:2px;color:rgba(255,255,255,.45);text-transform:uppercase;margin-bottom:18px">Gestão Automotiva · Documento Digital</div>
        <div class="doc-num">${rv.numero_doc}</div>
        <div class="doc-tipo">${rv.tipo}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-bottom:4px">Data</div>
        <div style="font-size:1.3rem;font-weight:700">${rv.data}</div>
        <div style="font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.4);text-transform:uppercase;margin-top:10px;margin-bottom:4px">Oficina</div>
        <div style="font-weight:700;color:rgba(255,255,255,.85)">${rv.oficina || '—'}</div>
      </div>
    </div>
  </div>
  <div class="doc-body an an-d3">
    <div class="doc-section">
      <div class="doc-section-title">🚗 Dados do veículo</div>
      <div class="doc-grid">
        <div class="doc-field"><div class="doc-field-label">Modelo</div><div class="doc-field-value">${v.modelo}</div></div>
        <div class="doc-field"><div class="doc-field-label">Marca</div><div class="doc-field-value">${v.marca}</div></div>
        <div class="doc-field"><div class="doc-field-label">Ano</div><div class="doc-field-value">${v.ano}</div></div>
        <div class="doc-field"><div class="doc-field-label">Placa</div><div class="doc-field-value">${v.placa || '—'}</div></div>
        <div class="doc-field"><div class="doc-field-label">Motor</div><div class="doc-field-value">${v.motor || '—'}</div></div>
        <div class="doc-field"><div class="doc-field-label">KM na revisão</div><div class="doc-field-value" style="color:var(--or)">${rv.km_na_revisao ? Number(rv.km_na_revisao).toLocaleString('pt-BR') + ' km' : '—'}</div></div>
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">📊 Resultado da inspeção</div>
      <div class="doc-saude">
        <div><div class="doc-saude-num">${saude}%</div><div style="font-size:.75rem;color:var(--gray-600)">Saúde geral</div></div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div style="text-align:center"><div style="font-size:1.5rem;font-weight:900;color:var(--ok)">${aprovados}</div><div style="font-size:.75rem;color:var(--gray-600)">✅ Aprovados</div></div>
          <div style="text-align:center"><div style="font-size:1.5rem;font-weight:900;color:var(--av)">${atencoes}</div><div style="font-size:.75rem;color:var(--gray-600)">⚠ Atenção</div></div>
          <div style="text-align:center"><div style="font-size:1.5rem;font-weight:900;color:var(--gray-400)">${total - aprovados - atencoes}</div><div style="font-size:.75rem;color:var(--gray-600)">— Não verificado</div></div>
        </div>
        ${rv.proxima_data ? `<div style="margin-left:auto"><div style="font-size:.65rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--gray-400);margin-bottom:4px">Próxima revisão</div><div style="font-weight:700;font-size:1.1rem">${rv.proxima_data}</div>${rv.proxima_km ? '<div style="font-size:.82rem;color:var(--gray-400)">' + Number(rv.proxima_km).toLocaleString('pt-BR') + ' km</div>' : ''}</div>` : ''}
      </div>
    </div>
    <div class="doc-section">
      <div class="doc-section-title">🔧 Checklist de itens inspecionados</div>
      <div class="doc-checks">${checkHtml}</div>
    </div>
    ${rv.descricao ? `<div class="doc-section"><div class="doc-section-title">📝 Observações</div><div style="background:var(--gray-50);border:1px solid var(--gray-100);border-radius:var(--r-sm);padding:16px 20px;font-size:.9rem;line-height:1.6;color:var(--gray-800)">${rv.descricao}</div></div>` : ''}
    <div class="doc-section">
      <div class="doc-section-title">👤 Responsável técnico</div>
      <div class="doc-grid">
        <div class="doc-field"><div class="doc-field-label">Mecânico</div><div class="doc-field-value">${rv.mecanico || '—'}</div></div>
        <div class="doc-field"><div class="doc-field-label">Oficina</div><div class="doc-field-value">${rv.oficina || '—'}</div></div>
        <div class="doc-field"><div class="doc-field-label">Custo total</div><div class="doc-field-value" style="color:var(--or)">R$ ${brl(rv.custo)}</div></div>
        <div class="doc-field"><div class="doc-field-label">Documento</div><div class="doc-field-value">${rv.numero_doc}</div></div>
      </div>
    </div>
    <div class="doc-assinatura">
      <div style="font-size:.72rem;color:var(--gray-400);max-width:360px;line-height:1.5">
        Este documento é gerado digitalmente pela plataforma <b>Pit Stop — Gestão Automotiva</b>.
        Emitido em ${new Date().toLocaleDateString('pt-BR')} · ${rv.numero_doc}
      </div>
      <div class="doc-assin-box">
        <div class="doc-assin-line">${rv.mecanico ? '<span style="font-size:.9rem;font-weight:600;color:var(--black)">' + rv.mecanico + '</span>' : ''}</div>
        <div class="doc-assin-label">Mecânico responsável</div>
      </div>
    </div>
  </div>
</div>
</main>
<div id="toasts"></div>
<script src="/main.js?v=4"></script>
<script>function toggleMobile(){document.getElementById('mobileMenu').classList.toggle('open');}</script>
</body></html>`);
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
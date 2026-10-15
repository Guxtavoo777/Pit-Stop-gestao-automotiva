const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'pitstop.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    usuario  TEXT PRIMARY KEY,
    senha    TEXT NOT NULL,
    nome     TEXT DEFAULT '',
    email    TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    cidade   TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS veiculos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario          TEXT NOT NULL,
    marca            TEXT,
    modelo           TEXT,
    ano              TEXT,
    km               TEXT DEFAULT '0',
    img              TEXT DEFAULT '',
    foto             TEXT,
    cor              TEXT DEFAULT '',
    placa            TEXT DEFAULT '',
    motor            TEXT,
    potencia         TEXT,
    torque           TEXT,
    cambio           TEXT,
    tracao           TEXT,
    combustivel      TEXT,
    consumo_cidade   TEXT,
    consumo_estrada  TEXT,
    porta_malas      TEXT,
    categoria        TEXT,
    observacoes      TEXT DEFAULT '',
    preco_base       TEXT,
    ativo            INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS manutencoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo_id     INTEGER NOT NULL,
    tipo           TEXT,
    descricao      TEXT DEFAULT '',
    oficina        TEXT DEFAULT '',
    km_na_revisao  TEXT DEFAULT '',
    custo          REAL  DEFAULT 0,
    data           TEXT,
    proxima_km     TEXT,
    proxima_data   TEXT
  );

  CREATE TABLE IF NOT EXISTS revisoes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo_id       INTEGER NOT NULL,
    usuario          TEXT    NOT NULL,
    numero_doc       TEXT,
    tipo             TEXT,
    descricao        TEXT DEFAULT '',
    oficina          TEXT DEFAULT '',
    mecanico         TEXT DEFAULT '',
    data             TEXT,
    km_na_revisao    TEXT DEFAULT '',
    custo            REAL  DEFAULT 0,
    proxima_data     TEXT,
    proxima_km       TEXT,
    status           TEXT DEFAULT 'aprovado',
    observacoes      TEXT DEFAULT '',
    itens_revisados  TEXT DEFAULT '{}'
  );
`);

// ─── MIGRATION from db.json ───────────────────────────────────────────────────
const JSON_PATH = path.join(__dirname, 'db.json');
const alreadyMigrated = db.prepare('SELECT COUNT(*) AS c FROM veiculos').get().c > 0;

if (!alreadyMigrated && fs.existsSync(JSON_PATH)) {
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO usuarios (usuario, senha, nome, email, telefone, cidade)
    VALUES (@usuario, @senha, @nome, @email, @telefone, @cidade)
  `);
  const insertVeiculo = db.prepare(`
    INSERT INTO veiculos (id, usuario, marca, modelo, ano, km, img, cor, placa,
      motor, potencia, torque, cambio, tracao, combustivel, consumo_cidade,
      consumo_estrada, porta_malas, categoria, observacoes, preco_base, ativo)
    VALUES (@id, @usuario, @marca, @modelo, @ano, @km, @img, @cor, @placa,
      @motor, @potencia, @torque, @cambio, @tracao, @combustivel, @consumo_cidade,
      @consumo_estrada, @porta_malas, @categoria, @observacoes, @preco_base, @ativo)
  `);
  const insertManut = db.prepare(`
    INSERT INTO manutencoes (id, veiculo_id, tipo, descricao, oficina, km_na_revisao,
      custo, data, proxima_km, proxima_data)
    VALUES (@id, @veiculo_id, @tipo, @descricao, @oficina, @km_na_revisao,
      @custo, @data, @proxima_km, @proxima_data)
  `);
  const insertRev = db.prepare(`
    INSERT INTO revisoes (id, veiculo_id, usuario, numero_doc, tipo, descricao, oficina,
      mecanico, data, km_na_revisao, custo, proxima_data, proxima_km, status,
      observacoes, itens_revisados)
    VALUES (@id, @veiculo_id, @usuario, @numero_doc, @tipo, @descricao, @oficina,
      @mecanico, @data, @km_na_revisao, @custo, @proxima_data, @proxima_km, @status,
      @observacoes, @itens_revisados)
  `);

  db.transaction(() => {
    for (const u of (raw.usuarios || [])) {
      insertUser.run({
        usuario: u.usuario, senha: u.senha, nome: u.nome || '',
        email: u.email || '', telefone: u.telefone || '', cidade: u.cidade || ''
      });
    }
    for (const v of (raw.veiculos || [])) {
      insertVeiculo.run({
        id: v.id, usuario: v.usuario || '', marca: v.marca || '',
        modelo: v.modelo || '', ano: v.ano || '', km: v.km || '0',
        img: v.img || '', cor: v.cor || '', placa: v.placa || '',
        motor: v.motor || null, potencia: v.potencia || null, torque: v.torque || null,
        cambio: v.cambio || null, tracao: v.tracao || null, combustivel: v.combustivel || null,
        consumo_cidade: v.consumo_cidade || null, consumo_estrada: v.consumo_estrada || null,
        porta_malas: v.porta_malas || null, categoria: v.categoria || null,
        observacoes: v.observacoes || '', preco_base: v.preco_base || null,
        ativo: v.ativo === false ? 0 : 1
      });
    }
    for (const m of (raw.manutencoes || [])) {
      insertManut.run({
        id: m.id, veiculo_id: m.veiculo_id, tipo: m.tipo || '',
        descricao: m.descricao || '', oficina: m.oficina || '',
        km_na_revisao: m.km_na_revisao || '', custo: parseFloat(m.custo) || 0,
        data: m.data || '', proxima_km: m.proxima_km || null,
        proxima_data: m.proxima_data || null
      });
    }
    for (const rv of (raw.revisoes || [])) {
      insertRev.run({
        id: rv.id, veiculo_id: rv.veiculo_id, usuario: rv.usuario || '',
        numero_doc: rv.numero_doc || '', tipo: rv.tipo || '',
        descricao: rv.descricao || '', oficina: rv.oficina || '',
        mecanico: rv.mecanico || '', data: rv.data || '',
        km_na_revisao: rv.km_na_revisao || '', custo: parseFloat(rv.custo) || 0,
        proxima_data: rv.proxima_data || null, proxima_km: rv.proxima_km || null,
        status: rv.status || 'aprovado', observacoes: rv.observacoes || '',
        itens_revisados: JSON.stringify(rv.itens_revisados || {})
      });
    }

    // Fix AUTOINCREMENT sequences to continue from existing data
    const maxV = db.prepare('SELECT MAX(id) AS m FROM veiculos').get().m || 0;
    const maxM = db.prepare('SELECT MAX(id) AS m FROM manutencoes').get().m || 0;
    const maxR = db.prepare('SELECT MAX(id) AS m FROM revisoes').get().m || 0;
    if (maxV > 0) db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run('veiculos', maxV);
    if (maxM > 0) db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run('manutencoes', maxM);
    if (maxR > 0) db.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run('revisoes', maxR);
  })();

  console.log('  → Migrated db.json → pitstop.db');
}

// ─── SEED: usuário demo se banco estiver vazio ────────────────────────────────
const semUsuarios = db.prepare('SELECT COUNT(*) AS c FROM usuarios').get().c === 0;
if (semUsuarios) {
  const bcrypt = require('bcrypt');
  const hash = bcrypt.hashSync('senha123', 10);
  db.prepare("INSERT OR IGNORE INTO usuarios (usuario, senha, nome) VALUES ('aluno', ?, 'Aluno Demo')").run(hash);
  console.log('  → Usuário demo criado: aluno / senha123');
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
const stmts = {
  getUser:    db.prepare('SELECT * FROM usuarios WHERE usuario = ?'),
  createUser: db.prepare('INSERT INTO usuarios (usuario, senha, nome) VALUES (@usuario, @senha, @nome)'),
  userExists: db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?'),
  updateUserHash: db.prepare('UPDATE usuarios SET senha = ? WHERE usuario = ?'),
  updateProfile:  db.prepare(`
    UPDATE usuarios SET nome = @nome, email = @email, telefone = @telefone, cidade = @cidade
    WHERE usuario = @usuario
  `),
  updatePassword: db.prepare('UPDATE usuarios SET senha = ? WHERE usuario = ?'),

  // Veículos
  getVeiculos:   db.prepare('SELECT * FROM veiculos WHERE usuario = ?'),
  getVeiculo:    db.prepare('SELECT * FROM veiculos WHERE id = ? AND usuario = ?'),
  insertVeiculo: db.prepare(`
    INSERT INTO veiculos (usuario, marca, modelo, ano, km, img, cor, placa,
      motor, potencia, torque, cambio, tracao, combustivel, consumo_cidade,
      consumo_estrada, porta_malas, categoria, observacoes, preco_base)
    VALUES (@usuario, @marca, @modelo, @ano, @km, @img, @cor, @placa,
      @motor, @potencia, @torque, @cambio, @tracao, @combustivel, @consumo_cidade,
      @consumo_estrada, @porta_malas, @categoria, @observacoes, @preco_base)
  `),
  updateVeiculo: db.prepare(`
    UPDATE veiculos SET km = @km, cor = @cor, placa = @placa, observacoes = @observacoes
    WHERE id = @id AND usuario = @usuario
  `),
  updateVeiculoFoto: db.prepare('UPDATE veiculos SET foto = ? WHERE id = ? AND usuario = ?'),
  toggleAtivo:   db.prepare('UPDATE veiculos SET ativo = CASE WHEN ativo = 1 THEN 0 ELSE 1 END WHERE id = ? AND usuario = ?'),
  deleteVeiculo: db.prepare('DELETE FROM veiculos WHERE id = ? AND usuario = ?'),

  // Manutenções
  getManutencoes:     db.prepare('SELECT * FROM manutencoes WHERE veiculo_id = ? ORDER BY data DESC'),
  getManutUser:       db.prepare('SELECT m.* FROM manutencoes m JOIN veiculos v ON v.id = m.veiculo_id WHERE v.usuario = ?'),
  insertManutencao:   db.prepare(`
    INSERT INTO manutencoes (veiculo_id, tipo, descricao, oficina, km_na_revisao, custo, data, proxima_km, proxima_data)
    VALUES (@veiculo_id, @tipo, @descricao, @oficina, @km_na_revisao, @custo, @data, @proxima_km, @proxima_data)
  `),
  deleteManutencao:   db.prepare('DELETE FROM manutencoes WHERE id = ?'),
  deleteManutVeiculo: db.prepare('DELETE FROM manutencoes WHERE veiculo_id = ?'),

  // Revisões
  getRevisoes:    db.prepare(`
    SELECT r.* FROM revisoes r JOIN veiculos v ON v.id = r.veiculo_id
    WHERE v.usuario = ? ORDER BY r.data DESC
  `),
  getRevisao:     db.prepare('SELECT * FROM revisoes WHERE id = ?'),
  insertRevisao:  db.prepare(`
    INSERT INTO revisoes (veiculo_id, usuario, numero_doc, tipo, descricao, oficina, mecanico,
      data, km_na_revisao, custo, proxima_data, proxima_km, status, observacoes, itens_revisados)
    VALUES (@veiculo_id, @usuario, @numero_doc, @tipo, @descricao, @oficina, @mecanico,
      @data, @km_na_revisao, @custo, @proxima_data, @proxima_km, @status, @observacoes, @itens_revisados)
  `),
  deleteRevisao:       db.prepare('DELETE FROM revisoes WHERE id = ?'),
  countRevisoes:       db.prepare('SELECT COUNT(*) AS c FROM revisoes'),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function gastos(vid) {
  return stmts.getManutencoes.all(vid).reduce((s, m) => s + (m.custo || 0), 0);
}

function situacao(vid) {
  const ms = stmts.getManutencoes.all(vid);
  if (!ms.length) return { tipo: 'ok', texto: 'Em dia' };
  const hoje = new Date();
  const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
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
  const hoje = new Date();
  const lim30 = new Date(); lim30.setDate(hoje.getDate() + 30);
  const d = new Date(rv.proxima_data);
  if (d < hoje) return { tipo: 'critico', texto: 'Revisão atrasada' };
  if (d <= lim30) return { tipo: 'aviso', texto: 'Revisão próxima' };
  return { tipo: 'ok', texto: 'Em dia' };
}

module.exports = { db, stmts, gastos, situacao, situacaoRev };

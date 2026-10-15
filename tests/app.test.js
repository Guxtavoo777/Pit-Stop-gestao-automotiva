process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-pitstop-jest';

const request = require('supertest');
const app = require('../server');
const { db, stmts, gastos, situacao } = require('../db');

// ─── Usuário de teste ─────────────────────────────────────────────────────────
const TEST_USER = 'jest_testuser';
const TEST_PASS = 'testpass123';

function limparUsuarioTeste() {
  // Remove veículos e manutenções do usuário de teste
  const veiculos = db.prepare('SELECT id FROM veiculos WHERE usuario = ?').all(TEST_USER);
  for (const v of veiculos) {
    db.prepare('DELETE FROM manutencoes WHERE veiculo_id = ?').run(v.id);
  }
  db.prepare('DELETE FROM veiculos WHERE usuario = ?').run(TEST_USER);
  db.prepare('DELETE FROM usuarios WHERE usuario = ?').run(TEST_USER);
}

beforeAll(() => {
  limparUsuarioTeste();
});

afterAll(() => {
  limparUsuarioTeste();
});

// ─── Helper: cria sessão autenticada ─────────────────────────────────────────
async function criarSessao() {
  const agent = request.agent(app);
  await agent
    .post('/api/cadastro')
    .send({ usuario: TEST_USER, senha: TEST_PASS, senha2: TEST_PASS, nome: 'Usuário Teste' });
  return agent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUTENTICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
describe('Autenticação', () => {
  it('POST /api/login — credenciais erradas retorna 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ usuario: 'aluno', senha: 'senha_errada' });
    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/login — campos faltando retorna 400', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ usuario: 'aluno' });
    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/cadastro — cria novo usuário e retorna 201', async () => {
    limparUsuarioTeste();
    const res = await request(app)
      .post('/api/cadastro')
      .send({ usuario: TEST_USER, senha: TEST_PASS, senha2: TEST_PASS, nome: 'Teste' });
    expect(res.statusCode).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/cadastro — usuário duplicado retorna 409', async () => {
    const res = await request(app)
      .post('/api/cadastro')
      .send({ usuario: TEST_USER, senha: TEST_PASS, senha2: TEST_PASS, nome: 'Teste' });
    expect(res.statusCode).toBe(409);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/cadastro — senhas diferentes retorna 400', async () => {
    const res = await request(app)
      .post('/api/cadastro')
      .send({ usuario: 'outro_user', senha: 'abc123', senha2: 'abc321', nome: 'Outro' });
    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/cadastro — senha muito curta retorna 400', async () => {
    const res = await request(app)
      .post('/api/cadastro')
      .send({ usuario: 'usutest2', senha: '123', senha2: '123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/login — login bem-sucedido retorna ok:true', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ usuario: 'aluno', senha: 'senha123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /logout — redireciona para /', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ usuario: 'aluno', senha: 'senha123' });
    const res = await agent.get('/logout');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROTAS PROTEGIDAS (sem sessão)
// ─────────────────────────────────────────────────────────────────────────────
describe('Rotas protegidas — sem sessão', () => {
  it('GET /garagem redireciona para /', async () => {
    const res = await request(app).get('/garagem');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('GET /api/veiculos retorna 401', async () => {
    const res = await request(app).get('/api/veiculos');
    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/veiculos retorna 401', async () => {
    const res = await request(app)
      .post('/api/veiculos')
      .send({ marca: 'Toyota', modelo: 'Corolla', ano: '2020' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /perfil redireciona para /', async () => {
    const res = await request(app).get('/perfil');
    expect(res.statusCode).toBe(302);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CRUD DE VEÍCULOS
// ─────────────────────────────────────────────────────────────────────────────
describe('CRUD de Veículos', () => {
  let agent;
  let veiculoId;

  beforeAll(async () => {
    limparUsuarioTeste();
    agent = await criarSessao();
  });

  it('GET /api/veiculos — lista vazia para novo usuário', async () => {
    const res = await agent.get('/api/veiculos');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('POST /api/veiculos — cria veículo e retorna id', async () => {
    const res = await agent.post('/api/veiculos').send({
      marca: 'Honda', modelo: 'Civic', ano: '2021',
      km: '30000', cor: 'Prata', placa: 'ABC1234',
      motor: '2.0', potencia: '155cv', torque: '19.5kgfm',
      cambio: 'Automático', tracao: 'Dianteira',
      combustivel: 'Flex', consumo_cidade: '11', consumo_estrada: '14',
      porta_malas: '519', categoria: 'Sedan', observacoes: 'Teste',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBeDefined();
    veiculoId = res.body.id;
  });

  it('GET /api/veiculos — lista retorna o veículo criado', async () => {
    const res = await agent.get('/api/veiculos');
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].modelo).toBe('Civic');
    expect(res.body[0].ativo).toBe(1);
  });

  it('PUT /api/veiculos/:id — atualiza km e cor', async () => {
    const res = await agent.put(`/api/veiculos/${veiculoId}`).send({
      km: '35000', cor: 'Azul', placa: 'ABC1234', observacoes: 'Atualizado',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // Verifica persistência
    const lista = await agent.get('/api/veiculos');
    expect(lista.body[0].km).toBe('35000');
    expect(lista.body[0].cor).toBe('Azul');
  });

  it('PUT /api/veiculos/:id — id inexistente retorna ok:false', async () => {
    const res = await agent.put('/api/veiculos/99999').send({
      km: '1000', cor: 'Verde', placa: 'XYZ9999',
    });
    expect(res.body.ok).toBe(false);
  });

  it('PATCH /api/veiculos/:id/status — alterna ativo para inativo', async () => {
    const res = await agent.patch(`/api/veiculos/${veiculoId}/status`);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ativo).toBe(false);
  });

  it('PATCH /api/veiculos/:id/status — alterna de volta para ativo', async () => {
    const res = await agent.patch(`/api/veiculos/${veiculoId}/status`);
    expect(res.body.ativo).toBe(true);
  });

  it('DELETE /api/veiculos/:id — remove o veículo', async () => {
    const res = await agent.delete(`/api/veiculos/${veiculoId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    // Confirma remoção
    const lista = await agent.get('/api/veiculos');
    expect(lista.body.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MANUTENÇÕES
// ─────────────────────────────────────────────────────────────────────────────
describe('Manutenções', () => {
  let agent;
  let veiculoId;
  let manutId;

  beforeAll(async () => {
    limparUsuarioTeste();
    agent = await criarSessao();
    // Cria um veículo para as manutenções
    const res = await agent.post('/api/veiculos').send({
      marca: 'VW', modelo: 'Gol', ano: '2019', km: '60000',
      combustivel: 'Flex', cambio: 'Manual', tracao: 'Dianteira',
    });
    veiculoId = res.body.id;
  });

  it('POST /api/manut/:vid — cria manutenção', async () => {
    const res = await agent.post(`/api/manut/${veiculoId}`).send({
      tipo: 'Troca de óleo',
      descricao: 'Óleo 5W30',
      oficina: 'Auto Center',
      km_na_revisao: '60000',
      custo: '250',
      data: '2024-01-15',
      proxima_km: '65000',
      proxima_data: '2025-01-15',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBeDefined();
    manutId = res.body.id;
  });

  it('POST /api/manut/:vid — veículo de outro usuário retorna ok:false', async () => {
    const res = await agent.post('/api/manut/99999').send({
      tipo: 'Teste', data: '2024-01-01', custo: '0',
    });
    expect(res.body.ok).toBe(false);
  });

  it('DELETE /api/manut/:id — remove manutenção', async () => {
    const res = await agent.delete(`/api/manut/${manutId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PÁGINAS (renderização EJS)
// ─────────────────────────────────────────────────────────────────────────────
describe('Páginas', () => {
  let agent;

  beforeAll(async () => {
    limparUsuarioTeste();
    agent = await criarSessao();
  });

  it('GET / — página inicial retorna 200', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
  });

  it('GET /garagem — dashboard retorna 200 após login', async () => {
    const res = await agent.get('/garagem');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Pit Stop');
  });

  it('GET /perfil — página de perfil retorna 200', async () => {
    const res = await agent.get('/perfil');
    expect(res.statusCode).toBe(200);
  });

  it('GET /rota-inexistente — retorna 404 para usuário autenticado', async () => {
    const res = await agent.get('/pagina-que-nao-existe-xyz');
    expect(res.statusCode).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. HELPER: gastos()
// ─────────────────────────────────────────────────────────────────────────────
describe('Helper gastos()', () => {
  let veiculoId;

  beforeAll(() => {
    limparUsuarioTeste();
    // Cria usuário e veículo direto no banco para testes unitários
    db.prepare("INSERT OR IGNORE INTO usuarios (usuario, senha, nome) VALUES (?, 'x', 'Teste')")
      .run(TEST_USER);
    const info = db.prepare(
      "INSERT INTO veiculos (usuario, marca, modelo, ano, km, img, cor, placa, motor, potencia, torque, cambio, tracao, combustivel, consumo_cidade, consumo_estrada, porta_malas, categoria, observacoes) VALUES (?, 'Toyota', 'Yaris', '2022', '10000', '', '', '', null, null, null, null, null, null, null, null, null, null, '')"
    ).run(TEST_USER);
    veiculoId = info.lastInsertRowid;
  });

  afterAll(() => {
    limparUsuarioTeste();
  });

  it('retorna 0 para veículo sem manutenções', () => {
    expect(gastos(veiculoId)).toBe(0);
  });

  it('retorna soma correta de custos', () => {
    stmts.insertManutencao.run({
      veiculo_id: veiculoId, tipo: 'Revisão', descricao: '', oficina: '',
      km_na_revisao: '', custo: 300, data: '2024-01-01',
      proxima_km: null, proxima_data: null,
    });
    stmts.insertManutencao.run({
      veiculo_id: veiculoId, tipo: 'Pneu', descricao: '', oficina: '',
      km_na_revisao: '', custo: 700, data: '2024-02-01',
      proxima_km: null, proxima_data: null,
    });
    expect(gastos(veiculoId)).toBe(1000);
  });

  it('trata custo nulo como zero', () => {
    stmts.insertManutencao.run({
      veiculo_id: veiculoId, tipo: 'Lavagem', descricao: '', oficina: '',
      km_na_revisao: '', custo: null, data: '2024-03-01',
      proxima_km: null, proxima_data: null,
    });
    expect(gastos(veiculoId)).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. HELPER: situacao()
// ─────────────────────────────────────────────────────────────────────────────
describe('Helper situacao()', () => {
  let veiculoId;

  function addManut(proxima_data) {
    stmts.insertManutencao.run({
      veiculo_id: veiculoId, tipo: 'Revisão', descricao: '', oficina: '',
      km_na_revisao: '', custo: 0, data: '2024-01-01',
      proxima_km: null, proxima_data,
    });
  }

  beforeEach(() => {
    // Cria veículo limpo para cada teste
    db.prepare("INSERT OR IGNORE INTO usuarios (usuario, senha, nome) VALUES (?, 'x', 'Teste')")
      .run(TEST_USER);
    const info = db.prepare(
      "INSERT INTO veiculos (usuario, marca, modelo, ano, km, img, cor, placa, motor, potencia, torque, cambio, tracao, combustivel, consumo_cidade, consumo_estrada, porta_malas, categoria, observacoes) VALUES (?, 'Fiat', 'Uno', '2020', '50000', '', '', '', null, null, null, null, null, null, null, null, null, null, '')"
    ).run(TEST_USER);
    veiculoId = info.lastInsertRowid;
  });

  afterAll(() => {
    limparUsuarioTeste();
  });

  it('retorna tipo "ok" para veículo sem manutenções', () => {
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('ok');
    expect(s.texto).toBe('Em dia');
  });

  it('retorna tipo "ok" para manutenção sem proxima_data', () => {
    addManut(null);
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('ok');
  });

  it('retorna tipo "critico" para revisão atrasada', () => {
    addManut('2020-01-01'); // data passada
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('critico');
    expect(s.texto).toBe('Revisão atrasada');
  });

  it('retorna tipo "aviso" para revisão nos próximos 30 dias', () => {
    const em15dias = new Date();
    em15dias.setDate(em15dias.getDate() + 15);
    addManut(em15dias.toISOString().split('T')[0]);
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('aviso');
    expect(s.texto).toBe('Revisão próxima');
  });

  it('retorna tipo "ok" para revisão além de 30 dias', () => {
    const em60dias = new Date();
    em60dias.setDate(em60dias.getDate() + 60);
    addManut(em60dias.toISOString().split('T')[0]);
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('ok');
  });

  it('"critico" tem prioridade sobre "aviso"', () => {
    addManut('2020-01-01'); // atrasada
    const em10dias = new Date();
    em10dias.setDate(em10dias.getDate() + 10);
    addManut(em10dias.toISOString().split('T')[0]); // aviso
    const s = situacao(veiculoId);
    expect(s.tipo).toBe('critico');
  });
});

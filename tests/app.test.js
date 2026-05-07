const request = require('supertest');
const app = require('../server');

describe('Auth', () => {
  it('POST /api/login with wrong credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({ usuario: 'aluno', senha: 'senha_errada' });
    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/login with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({ usuario: 'aluno' });
    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
  });
});

describe('Protected routes', () => {
  it('GET /garagem without session redirects to /', async () => {
    const res = await request(app).get('/garagem');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('GET /api/veiculos without session returns 401', async () => {
    const res = await request(app).get('/api/veiculos');
    expect(res.statusCode).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});

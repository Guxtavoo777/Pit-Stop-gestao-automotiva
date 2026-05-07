# Pit Stop — Gestão Automotiva

![Testes](https://github.com/Guxtavoo777/Pit-Stop-gestao-automotiva/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Licença](https://img.shields.io/badge/licen%C3%A7a-BSD--3--Clause-blue)

Plataforma web para gerenciamento de veículos, manutenções e revisões. Construída com Node.js + Express + EJS, banco SQLite, autenticação com bcrypt e proteção CSRF.

---

## Funcionalidades

- **Garagem digital** — cadastre veículos com dados do catálogo (27 modelos), fotos e KM atual
- **Histórico de manutenções** — tipo, oficina, custo, data, próxima revisão
- **Revisões com laudo** — checklist de 20 itens, número de documento único (`REV-YYYY-NNN`)
- **Dashboard** — gráfico de gastos, alertas de revisão atrasada, total investido
- **Alertas automáticos** — status por veículo (Em dia / Revisão próxima / Atrasada)
- **Perfil de usuário** — troca de senha, dados pessoais

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Servidor | Node.js 18+ · Express 4 |
| Templates | EJS 5 |
| Banco de dados | SQLite via `better-sqlite3` |
| Autenticação | `express-session` + `better-sqlite3-session-store` + bcrypt |
| Segurança | Helmet · CSRF (Double Submit) · Rate limiting |
| Logs | Morgan |
| Upload | Multer (até 5 MB) |
| Testes | Jest + Supertest |

---

## Setup local

```bash
# 1. Clone o repositório
git clone https://github.com/Guxtavoo777/Pit-Stop-gestao-automotiva.git
cd Pit-Stop-gestao-automotiva

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env
# Edite .env e defina SESSION_SECRET

# 4. Inicie o servidor
npm start
# ou em modo dev (hot-reload):
npm run dev
```

Acesse: `http://localhost:3000`

> **Conta de demonstração** (apenas ambiente local): `aluno` / `senha123`

Na primeira execução o banco `pitstop.db` é criado automaticamente com dados de demonstração.

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SESSION_SECRET` | **Sim em produção** | String aleatória longa para assinar sessões |
| `NODE_ENV` | Não | `development` (padrão) ou `production` |
| `PORT` | Não | Porta do servidor (padrão: 3000) |

---

## Testes

```bash
npm test
```

Cobre: autenticação com credenciais inválidas (401/400), rotas protegidas sem sessão (302/401).

---

## Estrutura do projeto

```
pit-stop/
├── routes/
│   ├── auth.js          # Login, cadastro, logout
│   ├── veiculos.js      # CRUD de veículos + upload de foto
│   ├── manutencoes.js   # Registro e exclusão de manutenções
│   ├── revisoes.js      # CRUD de revisões com laudo
│   └── pages.js         # Rotas de renderização EJS + API de perfil
├── views/
│   ├── partials/        # head, topnav, scripts
│   └── *.ejs            # dashboard, garagem, veiculo, perfil…
├── public/
│   ├── style.css
│   ├── main.js          # Fetch interceptor CSRF, animações, toasts
│   └── uploads/         # Fotos enviadas pelo usuário
├── tests/
│   └── app.test.js
├── db.js                # Schema SQLite + migração + queries
├── server.js            # Express app, middleware, wiring
└── carros.js            # Catálogo de 27 modelos brasileiros
```

---

## Deploy (Railway)

1. Faça o push do código para o GitHub
2. Crie um projeto no [Railway](https://railway.app) apontando para o repositório
3. Adicione a variável `SESSION_SECRET` no painel de variáveis
4. O Railway detecta automaticamente `npm start` via `package.json`

> O `pitstop.db` é recriado a cada deploy efêmero. Para persistência em produção, use um volume Railway montado em `/app` ou migre para PostgreSQL com `better-sqlite3` trocado por `pg`.

---

## Segurança

- Senhas armazenadas com bcrypt (salt rounds 10)
- Migração transparente de senhas em texto plano para hash no próximo login
- Proteção CSRF via header `x-csrf-token` em todas as requisições de estado
- Rate limiting em rotas de autenticação (20 req / 15 min)
- Headers HTTP seguros via Helmet
- Sessões com `httpOnly`, `sameSite: lax`, `secure` em produção
- Extração explícita de campos no body (sem `...req.body` nas inserções)

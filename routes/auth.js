const express = require('express');
const bcrypt = require('bcrypt');
const { stmts } = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;

router.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha)
    return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });

  const u = stmts.getUser.get(usuario);
  if (!u) return res.status(401).json({ ok: false });

  const isHash = u.senha.startsWith('$2');
  let valid = false;

  if (isHash) {
    valid = await bcrypt.compare(senha, u.senha);
  } else {
    valid = u.senha === senha;
    if (valid) {
      stmts.updateUserHash.run(await bcrypt.hash(senha, SALT_ROUNDS), usuario);
    }
  }

  if (!valid) return res.status(401).json({ ok: false });
  req.session.user = u.usuario;
  res.json({ ok: true });
});

router.post('/api/cadastro', async (req, res) => {
  const { usuario, senha, senha2, nome } = req.body;
  if (!usuario || !senha)
    return res.status(400).json({ ok: false, msg: 'Preencha todos os campos.' });
  if (senha !== senha2)
    return res.status(400).json({ ok: false, msg: 'As senhas não conferem.' });
  if (senha.length < 6)
    return res.status(400).json({ ok: false, msg: 'A senha deve ter pelo menos 6 caracteres.' });

  const usrRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usrRegex.test(usuario))
    return res.status(400).json({ ok: false, msg: 'Usuário: 3-20 caracteres, sem espaços ou acentos.' });
  if (usuario === 'aluno' || stmts.userExists.get(usuario))
    return res.status(409).json({ ok: false, msg: 'Este usuário já está em uso. Escolha outro.' });

  const hash = await bcrypt.hash(senha, SALT_ROUNDS);
  stmts.createUser.run({ usuario, senha: hash, nome: nome || usuario });
  req.session.user = usuario;
  res.status(201).json({ ok: true });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;

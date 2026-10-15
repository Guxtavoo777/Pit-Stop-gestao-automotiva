const express = require('express');
const { stmts } = require('../db');

const router = express.Router();

router.get('/api/revisoes', (req, res) => {
  const revs = stmts.getRevisoes.all(req.session.user).map(rv => ({
    ...rv,
    itens_revisados: JSON.parse(rv.itens_revisados || '{}'),
  }));
  res.json(revs);
});

router.post('/api/revisoes', (req, res) => {
  const { veiculo_id, tipo, descricao, oficina, mecanico, data, km_na_revisao,
          custo, proxima_data, proxima_km, status, observacoes, itens_revisados } = req.body;

  const vid = parseInt(veiculo_id);
  const v = stmts.getVeiculo.get(vid, req.session.user);
  if (!v) return res.json({ ok: false });

  const count = stmts.countRevisoes.get().c + 1;
  const ano = new Date().getFullYear();
  const numero_doc = `REV-${ano}-${String(count).padStart(3, '0')}`;

  const info = stmts.insertRevisao.run({
    veiculo_id: vid, usuario: req.session.user, numero_doc,
    tipo, descricao: descricao || '', oficina: oficina || '',
    mecanico: mecanico || '', data, km_na_revisao: km_na_revisao || '',
    custo: parseFloat(custo) || 0, proxima_data: proxima_data || null,
    proxima_km: proxima_km || null, status: status || 'aprovado',
    observacoes: observacoes || '',
    itens_revisados: JSON.stringify(itens_revisados || {}),
  });

  res.json({ ok: true, id: info.lastInsertRowid, numero_doc });
});

router.delete('/api/revisoes/:id', (req, res) => {
  stmts.deleteRevisao.run(parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;

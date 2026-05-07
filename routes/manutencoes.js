const express = require('express');
const { stmts } = require('../db');

const router = express.Router();

router.post('/api/manut/:vid', (req, res) => {
  const vid = parseInt(req.params.vid);
  const v = stmts.getVeiculo.get(vid, req.session.user);
  if (!v) return res.json({ ok: false });

  const { tipo, descricao, oficina, km_na_revisao, custo, data, proxima_km, proxima_data } = req.body;
  const info = stmts.insertManutencao.run({
    veiculo_id: vid, tipo, descricao: descricao || '', oficina: oficina || '',
    km_na_revisao: km_na_revisao || '', custo: parseFloat(custo) || 0,
    data, proxima_km: proxima_km || null, proxima_data: proxima_data || null,
  });
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.delete('/api/manut/:id', (req, res) => {
  stmts.deleteManutencao.run(parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;

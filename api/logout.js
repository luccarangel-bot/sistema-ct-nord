import { rota, fecharSessao } from './_lib.js';

export default rota(['POST'], async (req, res) => {
  fecharSessao(req, res);
  res.status(200).json({ ok: true });
});

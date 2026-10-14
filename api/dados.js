import { rota, exigirLogin, redis, um, chaveCol, parHash, corpo, bumpRev, COLECOES, CHAVES, publico, ErroApi } from './_lib.js';

const ID_OK = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_DOC = 200 * 1024;

// GET            → todos os dados + revisão + usuário logado
// GET ?rev=1     → só a revisão (para saber se algo mudou)
// POST {col,id,doc} → grava um registro
// DELETE ?col=&id=  → apaga um registro
export default rota(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'GET' && req.query.rev) {
    await exigirLogin(req, { leve: true });
    const rev = await um('GET', CHAVES.rev);
    return res.status(200).json({ rev: Number(rev || 0) });
  }
  const usuario = await exigirLogin(req);

  if (req.method === 'GET') {
    const out = await redis([...COLECOES.map((c) => ['HGETALL', chaveCol(c)]), ['GET', CHAVES.rev]]);
    const dados = {};
    COLECOES.forEach((c, i) => { dados[c] = Object.values(parHash(out[i])).map((v) => JSON.parse(v)); });
    return res.status(200).json({ dados, rev: Number(out[COLECOES.length] || 0), usuario: publico(usuario) });
  }

  const col = String((req.method === 'POST' ? corpo(req).col : req.query.col) || '');
  if (!COLECOES.includes(col)) throw new ErroApi(400, 'Tipo de registro desconhecido.');

  if (req.method === 'POST') {
    const { id, doc } = corpo(req);
    if (!ID_OK.test(String(id || ''))) throw new ErroApi(400, 'Identificador inválido.');
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new ErroApi(400, 'Registro inválido.');
    const txt = JSON.stringify({ ...doc, id });
    if (txt.length > MAX_DOC) throw new ErroApi(413, 'Este registro ficou grande demais para salvar.');
    await redis([['HSET', chaveCol(col), id, txt]]);
  } else {
    const id = String(req.query.id || '');
    if (!ID_OK.test(id)) throw new ErroApi(400, 'Identificador inválido.');
    await redis([['HDEL', chaveCol(col), id]]);
  }
  const rev = await bumpRev();
  res.status(200).json({ ok: true, rev: Number(rev) });
});

import crypto from 'node:crypto';
import { rota, corpo, ip, limitar, banco, um, chaveCol, parHash, bumpRev, semear, ErroApi } from './_lib.js';

// Rota pública da ficha de matrícula.
// GET  → nome do CT e planos à venda (para montar a ficha)
// POST → recebe a ficha preenchida e coloca na fila "Fichas recebidas" do sistema
const CAMPOS = { n: 120, nas: 10, cpf: 14, tel: 20, em: 120, end: 200, mod: 30, exp: 30, fx: 40, gr: 2, sau: 600, ctn: 120, ctt: 20, ori: 40, ok: 30, rc: 30, rcv: 10, rn: 120, rcpf: 14, rtel: 20, pl: 80, pln: 120, fp: 40, dv: 2, fam: 600, ht: 400, hor: 600, hro: 120, bio: 30 };
const MAX_FILA = 300;

export default rota(['GET', 'POST'], async (req, res) => {
  if (req.method === 'GET') {
    await semear();
    const [cfg, planos, turmas] = await banco([['HGET', chaveCol('config'), 'geral'], ['HGETALL', chaveCol('planos')], ['HGETALL', chaveCol('turmas')]]);
    const ct = (cfg && JSON.parse(cfg).ct) || {};
    const lista = Object.values(parHash(planos)).map((v) => JSON.parse(v)).filter((p) => p.ativo !== false)
      .sort((a, b) => a.meses - b.meses || b.valor - a.valor)
      .map((p) => ({ i: p.id, n: p.nome, v: p.valor, m: p.meses, f: p.formaPadrao || 'mensal', a: p.pagamentos || [] }));
    // Grade das turmas ativas, para o aluno marcar os horários que prefere.
    const grade = Object.values(parHash(turmas)).map((v) => JSON.parse(v)).filter((t) => t.ativa !== false)
      .map((t) => ({ i: t.id, n: t.nome, m: t.modalidade, d: t.dias || [], h: t.inicio }));
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ n: ct.nome || 'CT NORD', w: ct.whatsapp || '', p: lista, t: grade });
  }

  await limitar('ficha:' + ip(req), 6, 3600);
  const b = corpo(req);
  const d = {};
  for (const [k, max] of Object.entries(CAMPOS)) {
    if (b[k] == null || b[k] === '') continue;
    d[k] = typeof b[k] === 'number' ? b[k] : String(b[k]).trim().slice(0, max);
  }
  if (!d.n || String(d.n).split(/\s+/).length < 2) throw new ErroApi(400, 'Informe o nome completo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.nas || ''))) throw new ErroApi(400, 'Informe a data de nascimento.');
  if (String(d.tel || '').replace(/\D/g, '').length < 10) throw new ErroApi(400, 'Informe um celular com DDD.');
  if (!d.rc || !d.ok) throw new ErroApi(400, 'É preciso aceitar o Regimento e a declaração dos dados.');
  if ((await um('HLEN', chaveCol('fichas'))) >= MAX_FILA) throw new ErroApi(503, 'O CT recebeu muitas fichas e ainda não conferiu. Tente de novo mais tarde ou fale com o CT pelo WhatsApp.');

  const id = 'fi_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
  // Selfie para o reconhecimento facial: só de quem autorizou o uso do rosto; JPG em base64 de até ~250 KB.
  // Fica em fotos/<id da ficha> (fora da carga geral) até a recepção conferir e cadastrar o aluno.
  const cmds = [];
  const sf = typeof b.sf === 'string' ? b.sf.replace(/^data:image\/jpeg;base64,/, '') : '';
  // A entrada é pela catraca com reconhecimento facial: autorização e selfie são obrigatórias.
  if (!d.bio || d.bio === 'nao') throw new ErroApi(400, 'A entrada é pela catraca com reconhecimento facial: autorize o uso do rosto para concluir.');
  if (!sf) throw new ErroApi(400, 'Tire a selfie para concluir a matrícula.');
  {
    if (sf.length > 340000 || !/^[A-Za-z0-9+/=]+$/.test(sf) || !sf.startsWith('/9j/')) throw new ErroApi(400, 'A selfie não pôde ser lida. Tire a foto de novo.');
    d.sf = 1;
    cmds.push(['HSET', chaveCol('fotos'), id, JSON.stringify({ id, jpg: sf, em: new Date().toISOString(), daFicha: true })]);
  }
  const ficha = { ...d, id, recebidaEm: new Date().toISOString() };
  await banco([...cmds, ['HSET', chaveCol('fichas'), id, JSON.stringify(ficha)]]);
  await bumpRev();
  res.status(200).json({ ok: true });
});

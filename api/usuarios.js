import { rota, exigirLogin, redis, um, corpo, gerarHash, conferirSenha, validarSenhaNova, normEmail, publico, abrirSessao, CHAVES, ErroApi } from './_lib.js';

// GET                      → lista da equipe (administradores)
// POST {acao:'criar', nome, email, senha, papel}     → novo usuário (administradores)
// POST {acao:'senha', atual, nova}                   → troca a própria senha
// POST {acao:'redefinir', email, senha}              → define nova senha de outra pessoa (administradores)
// DELETE ?email=           → remove o acesso (administradores)
export default rota(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') {
    await exigirLogin(req, { admin: true });
    const todos = await um('HGETALL', CHAVES.usuarios);
    const lista = [];
    for (let i = 1; i < (todos || []).length; i += 2) lista.push(publico(JSON.parse(todos[i])));
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return res.status(200).json({ usuarios: lista });
  }

  if (req.method === 'DELETE') {
    const eu = await exigirLogin(req, { admin: true });
    const email = normEmail(req.query.email);
    if (email === eu.email) throw new ErroApi(400, 'Você não pode remover o seu próprio acesso.');
    await redis([['HDEL', CHAVES.usuarios, email]]);
    return res.status(200).json({ ok: true });
  }

  const b = corpo(req);
  if (b.acao === 'senha') {
    const eu = await exigirLogin(req);
    if (!(await conferirSenha(String(b.atual || ''), eu.hash))) throw new ErroApi(400, 'A senha atual não confere.');
    validarSenhaNova(b.nova);
    const novo = { ...eu, hash: await gerarHash(b.nova), versao: (eu.versao || 1) + 1 };
    await redis([['HSET', CHAVES.usuarios, eu.email, JSON.stringify(novo)]]);
    await abrirSessao(req, res, novo);
    return res.status(200).json({ ok: true });
  }

  await exigirLogin(req, { admin: true });
  const email = normEmail(b.email);
  if (b.acao === 'criar') {
    const nome = String(b.nome || '').trim().slice(0, 80);
    if (!nome) throw new ErroApi(400, 'Informe o nome.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroApi(400, 'Informe um e-mail válido.');
    if (await um('HGET', CHAVES.usuarios, email)) throw new ErroApi(409, 'Já existe um acesso com este e-mail.');
    validarSenhaNova(b.senha);
    const u = { email, nome, papel: b.papel === 'admin' ? 'admin' : 'equipe', hash: await gerarHash(b.senha), versao: 1, criadoEm: new Date().toISOString() };
    await redis([['HSET', CHAVES.usuarios, email, JSON.stringify(u)]]);
    return res.status(200).json({ usuario: publico(u) });
  }
  if (b.acao === 'redefinir') {
    const bruto = await um('HGET', CHAVES.usuarios, email);
    if (!bruto) throw new ErroApi(404, 'Usuário não encontrado.');
    validarSenhaNova(b.senha);
    const u = JSON.parse(bruto);
    const novo = { ...u, hash: await gerarHash(b.senha), versao: (u.versao || 1) + 1 };
    await redis([['HSET', CHAVES.usuarios, email, JSON.stringify(novo)]]);
    return res.status(200).json({ ok: true });
  }
  throw new ErroApi(400, 'Ação desconhecida.');
});

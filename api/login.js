import { rota, corpo, ip, limitar, um, redis, conferirSenha, abrirSessao, normEmail, publico, semear, CHAVES, ErroApi } from './_lib.js';

// POST {email, senha}. No primeiro acesso, o administrador vem das variáveis ADMIN_EMAIL e ADMIN_SENHA_HASH.
export default rota(['POST'], async (req, res) => {
  const b = corpo(req);
  const email = normEmail(b.email);
  const senha = String(b.senha || '');
  if (!email || !senha) throw new ErroApi(400, 'Informe e-mail e senha.');
  await limitar('login:' + ip(req), 10, 900);

  let bruto = await um('HGET', CHAVES.usuarios, email);
  let usuario = bruto ? JSON.parse(bruto) : null;

  if (!usuario && (await um('HLEN', CHAVES.usuarios)) === 0) {
    const adm = normEmail(process.env.ADMIN_EMAIL);
    const hash = process.env.ADMIN_SENHA_HASH;
    if (!adm || !hash) throw new ErroApi(500, 'O primeiro acesso ainda não foi configurado. No Vercel, preencha ADMIN_EMAIL e ADMIN_SENHA_HASH e publique de novo.');
    if (email === adm && (await conferirSenha(senha, hash))) {
      usuario = { email, nome: process.env.ADMIN_NOME || 'Administrador', papel: 'admin', hash, versao: 1, criadoEm: new Date().toISOString() };
      await redis([['HSET', CHAVES.usuarios, email, JSON.stringify(usuario)]]);
      await semear();
    }
  } else if (usuario && !(await conferirSenha(senha, usuario.hash))) {
    usuario = null;
  }
  if (!usuario) throw new ErroApi(401, 'E-mail ou senha incorretos.');
  await abrirSessao(req, res, usuario);
  res.status(200).json({ usuario: publico(usuario) });
});

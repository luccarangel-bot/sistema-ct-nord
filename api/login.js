import { rota, corpo, ip, limitar, um, banco, conferirSenha, lerHash, abrirSessao, normEmail, publico, semear, CHAVES, ErroApi } from './_lib.js';

// POST {email, senha}. O administrador vem das variáveis ADMIN_EMAIL e ADMIN_SENHA_HASH:
// no primeiro acesso, e também sempre que ADMIN_SENHA_HASH mudar no Vercel. Uma variável nova vale
// para um login; depois disso, quem troca a senha em Ajustes deixa de depender dela.
export default rota(['POST'], async (req, res) => {
  const b = corpo(req);
  const email = normEmail(b.email);
  const senha = String(b.senha || '');
  if (!email || !senha) throw new ErroApi(400, 'Informe e-mail e senha.');
  await limitar('login:' + ip(req), 10, 900);

  let bruto = await um('HGET', CHAVES.usuarios, email);
  let usuario = bruto ? JSON.parse(bruto) : null;

  const adm = normEmail(String(process.env.ADMIN_EMAIL || '').replace(/["']/g, ''));
  const brutoEnv = process.env.ADMIN_SENHA_HASH;
  const lido = lerHash(brutoEnv);
  const hashEnv = lido ? lido.texto : '';
  if (!usuario && (!adm || !brutoEnv) && (await um('HLEN', CHAVES.usuarios)) === 0) {
    throw new ErroApi(500, 'O primeiro acesso ainda não foi configurado. No Vercel, preencha ADMIN_EMAIL e ADMIN_SENHA_HASH e publique de novo.');
  }
  const variavelNova = adm && hashEnv && email === adm && (!usuario || usuario.hashEnv !== hashEnv);
  if (variavelNova && (await conferirSenha(senha, hashEnv))) {
    // Cria o administrador, ou redefine a senha dele com a variável nova (derruba as sessões antigas).
    usuario = {
      email, nome: process.env.ADMIN_NOME || 'Administrador', criadoEm: new Date().toISOString(), ...(usuario || {}),
      papel: 'admin', hash: hashEnv, hashEnv, versao: ((usuario && usuario.versao) || 0) + 1,
    };
    await banco([['HSET', CHAVES.usuarios, email, JSON.stringify(usuario)]]);
    await semear();
  } else if (usuario && !(await conferirSenha(senha, usuario.hash))) {
    usuario = null;
  }
  if (!usuario && email === adm && brutoEnv && !lido) {
    // A variável existe mas veio quebrada (por exemplo, cortada ao colar): avisa em vez de dizer "senha incorreta".
    console.error('ADMIN_SENHA_HASH com formato inválido (tamanho ' + String(brutoEnv).length + ', começo "' + String(brutoEnv).slice(0, 7) + '").');
    throw new ErroApi(500, 'A senha do administrador no Vercel (ADMIN_SENHA_HASH) está com formato inválido. Cole o valor de novo, sem aspas, e faça Redeploy.');
  }
  if (!usuario) throw new ErroApi(401, 'E-mail ou senha incorretos.');
  await abrirSessao(req, res, usuario);
  res.status(200).json({ usuario: publico(usuario) });
});

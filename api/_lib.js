// Funções compartilhadas pelas rotas da API (arquivos com "_" não viram rotas no Vercel).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { SEED } from './_seed.js';

const scrypt = promisify(crypto.scrypt);

export const COLECOES = ['alunos', 'planos', 'contratos', 'lancamentos', 'leads', 'tarefas', 'turmas', 'aulas', 'config', 'fichas'];
const P = 'ct:';
const COOKIE = 'ct_sessao';
const DIAS_SESSAO = 30;

/* ---------- Banco (Postgres do Neon via HTTP) ----------
   O resto do código fala em comandos no estilo Redis (GET, SET, INCR, HSET...).
   Aqui cada comando vira SQL sobre duas tabelas: ct_hash (chave, campo → valor) e
   ct_str (chave → valor, com expiração opcional). Vários comandos juntos rodam numa transação. */
let conexao = null;
function sqlNeon() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new ErroApi(500, 'O banco de dados não está conectado. No Vercel, conecte o Neon ao projeto e publique de novo.');
  return (conexao = conexao || neon(url));
}
const TABELAS = [
  'CREATE TABLE IF NOT EXISTS ct_hash (chave text NOT NULL, campo text NOT NULL, valor text NOT NULL, PRIMARY KEY (chave, campo))',
  'CREATE TABLE IF NOT EXISTS ct_str (chave text PRIMARY KEY, valor text NOT NULL, expira timestamptz)',
];
let tabelasProntas = null;
function criarTabelas(sql) {
  tabelasProntas = tabelasProntas || sql.transaction(TABELAS.map((t) => sql.query(t))).catch((e) => { tabelasProntas = null; throw e; });
  return tabelasProntas;
}
const VIVO = '(expira IS NULL OR expira > now())';
const VENCIDO = '(ct_str.expira IS NOT NULL AND ct_str.expira <= now())';
const primeiro = (rows) => (rows[0] ? rows[0].v : null);
const numero = (rows) => Number(rows[0] ? rows[0].v : 0);
// Traduz um comando em { text, params, ler(rows) }, com o mesmo retorno que o Redis daria.
export function traduzir([c, k, ...a]) {
  switch (String(c).toUpperCase()) {
    case 'GET': return { text: 'SELECT valor AS v FROM ct_str WHERE chave = $1 AND ' + VIVO, params: [k], ler: primeiro };
    case 'SET': {
      const nx = a.slice(1).some((x) => String(x).toUpperCase() === 'NX');
      const text = 'INSERT INTO ct_str (chave, valor) VALUES ($1, $2) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, expira = NULL' +
        (nx ? ' WHERE ' + VENCIDO : '') + ' RETURNING 1 AS v';
      return { text, params: [k, String(a[0])], ler: (rows) => (rows.length ? 'OK' : null) };
    }
    case 'INCR': return {
      text: "INSERT INTO ct_str (chave, valor) VALUES ($1, '1') ON CONFLICT (chave) DO UPDATE SET " +
        'valor = CASE WHEN ' + VENCIDO + " THEN '1' ELSE (ct_str.valor::bigint + 1)::text END, " +
        'expira = CASE WHEN ' + VENCIDO + ' THEN NULL ELSE ct_str.expira END RETURNING valor AS v',
      params: [k], ler: numero,
    };
    case 'EXPIRE': return {
      // Aproveita para apagar chaves vencidas (limites de tentativas antigos).
      text: 'WITH limpa AS (DELETE FROM ct_str WHERE expira <= now() AND chave <> $1) ' +
        'UPDATE ct_str SET expira = now() + make_interval(secs => $2::int) WHERE chave = $1 RETURNING 1 AS v',
      params: [k, Number(a[0])], ler: (rows) => rows.length,
    };
    case 'HGET': return { text: 'SELECT valor AS v FROM ct_hash WHERE chave = $1 AND campo = $2', params: [k, String(a[0])], ler: primeiro };
    case 'HSET': {
      const campos = [], valores = [];
      for (let i = 0; i < a.length; i += 2) { campos.push(String(a[i])); valores.push(String(a[i + 1])); }
      return {
        text: 'INSERT INTO ct_hash (chave, campo, valor) SELECT $1, c, v FROM unnest($2::text[], $3::text[]) AS t(c, v) ' +
          'ON CONFLICT (chave, campo) DO UPDATE SET valor = EXCLUDED.valor',
        params: [k, campos, valores], ler: () => 1,
      };
    }
    case 'HDEL': return {
      text: 'WITH d AS (DELETE FROM ct_hash WHERE chave = $1 AND campo = ANY($2::text[]) RETURNING 1) SELECT count(*)::int AS v FROM d',
      params: [k, a.map(String)], ler: numero,
    };
    case 'HLEN': return { text: 'SELECT count(*)::int AS v FROM ct_hash WHERE chave = $1', params: [k], ler: numero };
    case 'HGETALL': return {
      text: 'SELECT campo, valor FROM ct_hash WHERE chave = $1', params: [k],
      ler: (rows) => rows.flatMap((r) => [r.campo, r.valor]),
    };
    default: throw new Error('Comando de banco não suportado: ' + c);
  }
}
// Para testes locais: um banco em memória com os mesmos comandos usados aqui.
let memoria = null;
function bancoMemoria(cmds) {
  memoria = memoria || new Map();
  const m = memoria;
  const h = (k) => { if (!m.has(k)) m.set(k, new Map()); return m.get(k); };
  return cmds.map(([c, k, ...a]) => {
    switch (c.toUpperCase()) {
      case 'GET': return m.has(k) ? m.get(k) : null;
      case 'SET': { if (a.includes('NX') && m.has(k)) return null; m.set(k, String(a[0])); return 'OK'; }
      case 'INCR': { const v = Number(m.get(k) || 0) + 1; m.set(k, String(v)); return v; }
      case 'EXPIRE': return 1;
      case 'HGET': return m.has(k) ? (h(k).get(a[0]) ?? null) : null;
      case 'HSET': { const x = h(k); for (let i = 0; i < a.length; i += 2) x.set(a[i], a[i + 1]); return 1; }
      case 'HDEL': { const x = h(k); let n = 0; for (const f of a) n += x.delete(f) ? 1 : 0; return n; }
      case 'HLEN': return m.has(k) ? h(k).size : 0;
      case 'HGETALL': { if (!m.has(k)) return []; const r = []; for (const [f, v] of h(k)) r.push(f, v); return r; }
      default: throw new Error('Comando não suportado no modo local: ' + c);
    }
  });
}
export async function banco(cmds) {
  if (process.env.CT_BANCO_MEMORIA === '1') return bancoMemoria(cmds);
  const sql = sqlNeon();
  const qs = cmds.map(traduzir);
  try {
    await criarTabelas(sql);
    const res = qs.length === 1
      ? [await sql.query(qs[0].text, qs[0].params)]
      : await sql.transaction(qs.map((q) => sql.query(q.text, q.params)));
    return res.map((rows, i) => qs[i].ler(rows));
  } catch (e) {
    console.error('Erro no banco de dados:', e);
    throw new ErroApi(502, 'O banco de dados não respondeu. Tente de novo em instantes.');
  }
}
export const um = async (...cmd) => (await banco([cmd]))[0];
export const chaveCol = (c) => P + 'c:' + c;
export const parHash = (arr) => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

/* ---------- Erros e respostas ---------- */
export class ErroApi extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export function rota(metodos, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!metodos.includes(req.method)) throw new ErroApi(405, 'Método não permitido.');
      await fn(req, res);
    } catch (e) {
      const status = e instanceof ErroApi ? e.status : 500;
      if (status === 500 && !(e instanceof ErroApi)) console.error(e);
      res.status(status).json({ erro: e instanceof ErroApi ? e.message : 'Erro inesperado no servidor.' });
    }
  };
}
export function corpo(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { throw new ErroApi(400, 'Dados inválidos.'); } }
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ErroApi(400, 'Dados inválidos.');
  return b;
}
export function ip(req) {
  const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return f || req.headers['x-real-ip'] || 'local';
}
export async function limitar(chave, max, segundos) {
  const [n] = await banco([['INCR', P + 'rl:' + chave], ['EXPIRE', P + 'rl:' + chave, String(segundos)]]);
  if (n > max) throw new ErroApi(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
}

/* ---------- Senhas ---------- */
export async function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const k = await scrypt(String(senha), sal, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + sal.toString('base64url') + '$' + Buffer.from(k).toString('base64url');
}
export async function conferirSenha(senha, hash) {
  const [alg, s, h] = String(hash || '').split('$');
  if (alg !== 'scrypt' || !s || !h) return false;
  const esperado = Buffer.from(h, 'base64url');
  const k = Buffer.from(await scrypt(String(senha), Buffer.from(s, 'base64url'), esperado.length, { N: 16384, r: 8, p: 1 }));
  return k.length === esperado.length && crypto.timingSafeEqual(k, esperado);
}
export function validarSenhaNova(s) {
  if (typeof s !== 'string' || s.length < 10) throw new ErroApi(400, 'A senha precisa ter pelo menos 10 caracteres.');
  if (s.length > 200) throw new ErroApi(400, 'A senha é longa demais.');
}

/* ---------- Sessão ---------- */
async function segredo() {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return env;
  let s = await um('GET', P + 'segredo');
  if (!s) { await um('SET', P + 'segredo', crypto.randomBytes(32).toString('base64url'), 'NX'); s = await um('GET', P + 'segredo'); }
  return s;
}
const assinar = (dados, sec) => crypto.createHmac('sha256', sec).update(dados).digest('base64url');
function lerCookie(req, nome) {
  const c = String(req.headers.cookie || '');
  for (const parte of c.split(';')) { const [k, ...v] = parte.trim().split('='); if (k === nome) return decodeURIComponent(v.join('=')); }
  return '';
}
const seguro = (req) => (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL === '1';
export async function abrirSessao(req, res, usuario) {
  const exp = Date.now() + DIAS_SESSAO * 86400000;
  const dados = Buffer.from(JSON.stringify({ e: usuario.email, v: usuario.versao || 1, exp })).toString('base64url');
  const tok = dados + '.' + assinar(dados, await segredo());
  res.setHeader('Set-Cookie', COOKIE + '=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + DIAS_SESSAO * 86400 + (seguro(req) ? '; Secure' : ''));
}
export function fecharSessao(req, res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (seguro(req) ? '; Secure' : ''));
}
async function lerSessao(req) {
  const tok = lerCookie(req, COOKIE);
  const [dados, sig] = tok.split('.');
  if (!dados || !sig) return null;
  const esperado = assinar(dados, await segredo());
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  try { const s = JSON.parse(Buffer.from(dados, 'base64url').toString()); return s.exp > Date.now() ? s : null; } catch (_) { return null; }
}
// Confere a sessão e se o usuário ainda existe (quem foi removido perde o acesso na hora).
// Com false, o login fica desligado e todas as rotas tratam o visitante como o administrador.
// ATENÇÃO: sem login, qualquer pessoa com o endereço do site vê e altera os dados.
export const LOGIN_ATIVO = true;

export async function exigirLogin(req, opts = {}) {
  if (!LOGIN_ATIVO) return { email: normEmail(process.env.ADMIN_EMAIL) || 'admin', nome: process.env.ADMIN_NOME || 'Administrador', papel: 'admin', semLogin: true };
  const s = await lerSessao(req);
  if (!s) throw new ErroApi(401, 'Faça login para continuar.');
  if (opts.leve) return { email: s.e };
  const bruto = await um('HGET', P + 'usuarios', s.e);
  if (!bruto) throw new ErroApi(401, 'Seu acesso foi removido. Fale com o responsável pelo CT.');
  const u = JSON.parse(bruto);
  if ((u.versao || 1) !== (s.v || 1)) throw new ErroApi(401, 'Sua senha foi alterada. Entre de novo.');
  if (opts.admin && u.papel !== 'admin') throw new ErroApi(403, 'Só administradores podem fazer isso.');
  return u;
}
export const publico = (u) => ({ email: u.email, nome: u.nome, papel: u.papel, criadoEm: u.criadoEm, ...(u.semLogin ? { semLogin: true } : {}) });
export const normEmail = (e) => String(e || '').trim().toLowerCase();

/* ---------- Primeiro acesso e dados iniciais ---------- */
export async function semear() {
  const ok = await um('SET', P + 'semeado', new Date().toISOString(), 'NX');
  if (!ok) return;
  const cmds = [];
  for (const [col, docs] of Object.entries(SEED)) {
    const args = [];
    for (const d of docs) args.push(d.id, JSON.stringify(d));
    if (args.length) cmds.push(['HSET', chaveCol(col), ...args]);
  }
  cmds.push(['INCR', P + 'rev']);
  await banco(cmds);
}
export async function bumpRev() { return um('INCR', P + 'rev'); }
export const CHAVES = { usuarios: P + 'usuarios', rev: P + 'rev' };

import { banco, chaveCol, parHash, ErroApi } from './_lib.js';
import { pushGet, pushResult } from './_catraca_push.js';

// Integração com o leitor facial Control iD (iDFace) em Modo Online "Pro":
// o aparelho reconhece o rosto localmente e, a cada passagem, pergunta aqui se libera a catraca.
// O endereço configurado no aparelho é https://<site>/api/catraca/<token>; o Vercel reescreve
// /api/catraca/<token>/<ação> para esta rota com ?token=&acao= (ver vercel.json).
//
// Regras do CT: libera quem tem contrato em vigor e nenhuma mensalidade vencida em aberto.
// Alunos só de TotalPass/Wellhub entram apenas se a recepção liberou a entrada naquele dia.
// Pessoas do aparelho sem vínculo com um aluno (equipe, professores) são liberadas, se assim configurado.

const hojeSP = (ms = Date.now()) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const horaSP = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(11, 16);
const diaSemanaSP = (ms) => new Date(ms - 3 * 3600000).getUTCDay();
const lista = (bruto) => Object.values(parHash(bruto)).map((v) => JSON.parse(v));
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

function statusContrato(c, hoje) {
  if (c.cancelado) return 'cancelado';
  if (c.continuo) return c.inicio > hoje ? 'futuro' : 'ativo';
  if (c.fim < hoje) return 'vencido';
  if (c.inicio > hoje) return 'futuro';
  return 'ativo';
}
const saldoDe = (l) => Math.max(0, Math.round(((Number(l.valor) || 0) - (Number(l.desconto) || 0) - (l.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0)) * 100) / 100);

// Decide a entrada de um aluno. Exportada para os testes.
export function decidirEntrada(aluno, contratos, lancamentos, hoje) {
  const vig = contratos.filter((c) => c.alunoId === aluno.id && statusContrato(c, hoje) === 'ativo');
  if (!vig.length) return { ok: false, motivo: 'sem contrato ativo', msg: 'Sem plano ativo. Procure a recepção.' };
  const atrasada = lancamentos.some((l) => l.alunoId === aluno.id && l.tipo === 'receita' && !l.cancelado && l.vencimento < hoje && saldoDe(l) > 0.004);
  if (atrasada) return { ok: false, motivo: 'mensalidade em atraso', msg: 'Mensalidade em aberto. Procure a recepção.' };
  if (vig.every((c) => c.forma === 'app')) {
    if (aluno.passLiberadoEm === hoje) return { ok: true, motivo: 'TotalPass/Wellhub liberado hoje', msg: 'Bom treino, ' + primeiroNome(aluno.nome) + '!' };
    return { ok: false, motivo: 'TotalPass/Wellhub sem check-in', msg: 'Faça o check-in no app e fale com a recepção.' };
  }
  return { ok: true, motivo: 'liberado', msg: 'Bom treino, ' + primeiroNome(aluno.nome) + '!' };
}

// Escolhe a aula do dia em que a entrada conta como presença: a turma da modalidade do aluno
// que começa mais perto do horário de entrada (até 1h30 antes ou depois do início).
export function aulaDaEntrada(aluno, turmas, ms) {
  const dia = diaSemanaSP(ms); const hm = horaSP(ms);
  const min = (h) => { const [a, b] = String(h || '0:0').split(':').map(Number); return a * 60 + b; };
  const mods = new Set((aluno.modalidades || []).map((m) => m.mod));
  const cands = turmas.filter((t) => t.ativa !== false && (t.dias || []).includes(dia) && (!mods.size || mods.has(t.modalidade)))
    .map((t) => ({ t, d: Math.abs(min(t.inicio) - min(hm)) })).filter((x) => x.d <= 90).sort((a, b) => a.d - b.d);
  return cands.length ? cands[0].t : null;
}

const acaoAbrir = (cfg, portalId) => {
  if (cfg.acao === 'door') return [{ action: 'door', parameters: 'door=' + (cfg.porta || 1) }];
  if (cfg.acao === 'catra') return [{ action: 'catra', parameters: 'allow=' + (cfg.sentido || 'clockwise') }];
  return [{ action: 'sec_box', parameters: 'id=' + (cfg.secboxId || '65793') + ', reason=1' }];
};

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const acao = String(q.acao || '');
    const push = acao === 'push' || acao === 'result';
    const [cfgBruto, estadoBruto, liberarBruto] = await banco([['HGET', chaveCol('config'), 'geral'], ...(push ? [] : [['HGET', chaveCol('catraca'), 'estado'], ['HGET', chaveCol('catraca'), 'liberar']])]);
    const cfg = ((cfgBruto && JSON.parse(cfgBruto)) || {}).catraca || {};
    if (!cfg.ativo || !cfg.token || String(q.token || '') !== cfg.token) throw new ErroApi(404, 'Não encontrado.');
    // Modo Push: o leitor busca comandos (cadastro de pessoas e rostos) e devolve o resultado.
    if (acao === 'push') { const c = await pushGet(q, cfg); if (c) return res.status(200).json(c); res.statusCode = 200; return res.end(); }
    if (acao === 'result') { await pushResult(q, req.body); res.statusCode = 200; return res.end(); }
    const estado = (estadoBruto && JSON.parse(estadoBruto)) || { id: 'estado', entradas: [], desconhecidos: {} };
    estado.ultimoContato = new Date().toISOString();

    if (acao !== 'new_user_identified.fcgi') {
      // session_is_valid, device_is_alive, new_rex_log etc.: só confirmam que o servidor está no ar.
      await banco([['HSET', chaveCol('catraca'), 'estado', JSON.stringify(estado)]]);
      if (acao === 'session_is_valid.fcgi') return res.status(200).json({ session_is_valid: true });
      res.statusCode = 200; return res.end();
    }

    const b = typeof req.body === 'object' && req.body ? req.body : Object.fromEntries(new URLSearchParams(String(req.body || '')));
    const userId = Number(b.user_id) || 0;
    const portal = Number(b.portal_id) || 1;
    const ms = (Number(b.time) || 0) > 0 ? Number(b.time) * 1000 : Date.now();
    const hoje = hojeSP(ms);
    const responder = (ok, msg, nome) => res.status(200).json({ result: {
      event: ok ? 7 : 6, user_id: userId, user_name: nome || String(b.user_name || ''), user_image: false, portal_id: portal,
      actions: ok ? acaoAbrir(cfg, portal) : [], message: msg,
    } });
    const registrar = (e) => { estado.entradas = [{ em: new Date(ms).toISOString(), userId, nomeAparelho: String(b.user_name || '').slice(0, 80), ...e }, ...(estado.entradas || [])].slice(0, 60); };

    // Liberação pela recepção (botão "Liberar catraca" no Painel): vale para a próxima passagem, de qualquer pessoa,
    // por até 1 minuto, e só uma vez.
    const liberar = liberarBruto ? JSON.parse(liberarBruto) : null;
    if (liberar && liberar.ate && liberar.ate > new Date().toISOString()) {
      registrar({ ok: true, motivo: 'liberado pela recepção' + (liberar.por ? ' (' + liberar.por + ')' : '') });
      await banco([['HSET', chaveCol('catraca'), 'liberar', JSON.stringify({ id: 'liberar', ate: '', usadoEm: new Date().toISOString() })], ['HSET', chaveCol('catraca'), 'estado', JSON.stringify(estado)], ['INCR', 'ct:rev']]);
      return responder(true, 'Entrada liberada pela recepção.', String(b.user_name || ''));
    }

    if (!userId) {
      registrar({ ok: false, motivo: 'rosto não reconhecido' });
      await banco([['HSET', chaveCol('catraca'), 'estado', JSON.stringify(estado)], ['INCR', 'ct:rev']]);
      return res.status(200).json({ result: { event: 3, portal_id: portal, actions: [], message: 'Não reconhecido.' } });
    }

    const [alunosB, contratosB, lancsB, turmasB] = await banco([['HGETALL', chaveCol('alunos')], ['HGETALL', chaveCol('contratos')], ['HGETALL', chaveCol('lancamentos')], ['HGETALL', chaveCol('turmas')]]);
    const aluno = lista(alunosB).find((a) => Number(a.catracaId) === userId);
    const cmds = [];
    let dec;
    if (!aluno) {
      // Pessoa cadastrada no aparelho que ainda não foi vinculada a um aluno (pode ser da equipe).
      estado.desconhecidos = estado.desconhecidos || {};
      estado.desconhecidos[userId] = { id: userId, nome: String(b.user_name || '').slice(0, 80), ultimo: new Date(ms).toISOString() };
      dec = cfg.bloquearSemVinculo ? { ok: false, motivo: 'sem vínculo com aluno', msg: 'Cadastro não vinculado. Procure a recepção.' } : { ok: true, motivo: 'sem vínculo com aluno', msg: 'Bem-vindo!' };
      registrar({ ok: dec.ok, motivo: dec.motivo });
    } else {
      dec = decidirEntrada(aluno, lista(contratosB), lista(lancsB), hoje);
      registrar({ ok: dec.ok, motivo: dec.motivo, alunoId: aluno.id, nome: aluno.nome });
      if (estado.desconhecidos) delete estado.desconhecidos[userId];
      if (dec.ok) {
        const t = aulaDaEntrada(aluno, lista(turmasB), ms);
        if (t) {
          const id = 'au_' + t.id + '_' + hoje;
          const [auB] = await banco([['HGET', chaveCol('aulas'), id]]);
          const au = auB ? JSON.parse(auB) : { id, turmaId: t.id, turmaNome: t.nome || '', modalidade: t.modalidade || '', data: hoje, presentes: [], criadoEm: new Date().toISOString() };
          if (!(au.presentes || []).includes(aluno.id)) {
            cmds.push(['HSET', chaveCol('aulas'), id, JSON.stringify({ ...au, presentes: [...(au.presentes || []), aluno.id], atualizadoEm: new Date().toISOString(), viaCatraca: true })]);
          }
        }
      }
    }
    await banco([...cmds, ['HSET', chaveCol('catraca'), 'estado', JSON.stringify(estado)], ['INCR', 'ct:rev']]);
    return responder(dec.ok, dec.msg, aluno ? aluno.nome : '');
  } catch (e) {
    const s = e instanceof ErroApi ? e.status : 500;
    if (s >= 500) console.error('catraca:', e);
    return res.status(s).json({ erro: e.message || 'Erro.' });
  }
}

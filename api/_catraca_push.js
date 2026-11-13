import crypto from 'node:crypto';
import { banco, chaveCol, parHash } from './_lib.js';

// Modo Push do Control iD: o leitor consulta o sistema a cada poucos segundos (GET .../push) e executa
// o comando devolvido; depois manda o resultado (POST .../result). Assim o sistema, que está na internet,
// consegue cadastrar pessoas e rostos no leitor, que fica dentro da rede da academia.
// O estado do Push fica em catraca/push; a fila de cadastros em catrafila (um registro por pedido);
// as fotos em fotos/<alunoId> (base64, fora da carga geral do sistema).

const PERIODO_DIA = 10;      // segundos entre consultas, das 6h às 23h
const PERIODO_NOITE = 300;   // de madrugada, para gastar menos
const REENVIO_MS = 2 * 60000;
const LER_USUARIOS_MS = 30 * 60000;
const horaSP = () => new Date(Date.now() - 3 * 3600000).getUTCHours();
const lista = (bruto) => Object.values(parHash(bruto)).map((v) => JSON.parse(v));
const agora = () => new Date().toISOString();

// Comando no formato do Push. Com cfg.pushCorpoTexto, o corpo vai como texto JSON (compatibilidade).
const comando = (cfg, endpoint, body) => ({ verb: 'POST', endpoint, body: cfg.pushCorpoTexto ? JSON.stringify(body) : body, contentType: 'application/json' });

const ERROS_FOTO = {
  2: 'O leitor não encontrou um rosto na foto.',
  3: 'Este rosto já está cadastrado no leitor para outra pessoa',
  4: 'Rosto muito longe ou muito perto: tire a foto com o rosto ocupando boa parte da imagem.',
  5: 'Rosto fora do centro da foto.',
  6: 'Rosto fora do centro da foto.',
  7: 'Rosto não está de frente para a câmera.',
  8: 'Foto sem nitidez: tire de novo com boa luz.',
};
function erroFoto(r) {
  const e = (r && r.errors && r.errors[0]) || {};
  let msg = ERROS_FOTO[e.code] || e.message || 'O leitor recusou a foto.';
  const outro = r && r.info && r.info.match_user_id;
  if (e.code === 3 && outro) msg += ' (ID ' + outro + ' no leitor). Ligue o aluno a esse ID em vez de cadastrar de novo.';
  return msg;
}

export async function pushGet(q, cfg) {
  const [pushB, filaB, alunosB, profsB] = await banco([['HGET', chaveCol('catraca'), 'push'], ['HGETALL', chaveCol('catrafila')], ['HGETALL', chaveCol('alunos')], ['HGETALL', chaveCol('professores')]]);
  // A pessoa de um pedido da fila pode ser aluno (alunoId) ou professor (profId).
  const alunosL = lista(alunosB), profsL = lista(profsB);
  const pessoaDe = (i) => (i.profId ? profsL.find((p) => p.id === i.profId) : alunosL.find((a) => a.id === i.alunoId));
  const st = (pushB && JSON.parse(pushB)) || { id: 'push' };
  const uuid = String(q.uuid || crypto.randomUUID());
  const cmds = [];
  const salvarSt = () => cmds.push(['HSET', chaveCol('catraca'), 'push', JSON.stringify(st)]);
  // Marca o contato no máximo uma vez por minuto (para não gravar a cada consulta).
  if (!st.visto || Date.now() - Date.parse(st.visto) > 60000) { st.visto = agora(); st.deviceId = String(q.deviceId || st.deviceId || ''); salvarSt(); }

  let resp = null;
  const fila = lista(filaB).filter((i) => i.status === 'pendente' || (i.status === 'enviado' && Date.now() - Date.parse(i.atualizadoEm || 0) > REENVIO_MS && (i.tentativas || 0) < 3))
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
  const item = fila[0];
  // Antes de criar uma pessoa nova no leitor, a lista de pessoas dele precisa ser recente (até 2 min),
  // para o ID novo não coincidir com alguém cadastrado direto no leitor.
  const lerAntes = item && item.tipo === 'cadastrar' && (item.etapa || 'usuario') === 'usuario' && !((pessoaDe(item) || {}).catracaId)
    && (!st.usuariosEm || Date.now() - Date.parse(st.usuariosEm) > REENVIO_MS);
  if (!st.usuariosEm || lerAntes) {
    st.pendente = { uuid, tipo: 'usuarios' }; salvarSt();
    resp = comando(cfg, 'load_objects', { object: 'users', fields: ['id', 'name', 'image_timestamp'] });
  } else if (item) {
    const aluno = pessoaDe(item); const colPessoa = item.profId ? 'professores' : 'alunos';
    const n = { ...item, status: 'enviado', uuid, atualizadoEm: agora(), tentativas: (item.tentativas || 0) + 1 };
    if (item.tipo === 'remover') {
      if (item.catracaId) resp = comando(cfg, 'destroy_objects', { object: 'users', where: { users: { id: Number(item.catracaId) } } });
      else { n.status = 'ok'; }
    } else if (!aluno) {
      Object.assign(n, { status: 'erro', erro: (item.profId ? 'Professor' : 'Aluno') + ' não encontrado no sistema.' });
    } else if (item.etapa === 'usuario' || !item.etapa) {
      let id = Number(aluno.catracaId) || 0;
      if (!id) {
        // Novo ID no leitor: o maior ID conhecido (leitor ou alunos) + 1.
        const usados = [...(st.usuarios || []).map((u) => Number(u.id) || 0), ...alunosL.map((a) => Number(a.catracaId) || 0), ...profsL.map((p) => Number(p.catracaId) || 0)];
        id = Math.max(0, ...usados) + 1;
        cmds.push(['HSET', chaveCol(colPessoa), aluno.id, JSON.stringify({ ...aluno, catracaId: id })]);
      }
      n.etapa = 'usuario'; n.catracaId = id;
      resp = comando(cfg, 'create_or_modify_objects', { object: 'users', values: [{ id, name: String(aluno.nome).slice(0, 60), registration: '' }] });
    } else if (item.etapa === 'grupo') {
      resp = comando(cfg, 'create_objects', { object: 'user_groups', values: [{ user_id: Number(item.catracaId), group_id: Number(st.grupoPadrao) }] });
    } else if (item.etapa === 'foto') {
      const [fotoB] = await banco([['HGET', chaveCol('fotos'), aluno.id]]);  // fotos/<id do aluno ou do professor>
      const foto = fotoB && JSON.parse(fotoB);
      if (!foto || !foto.jpg) Object.assign(n, { status: 'erro', erro: 'Foto não encontrada. Tire a foto de novo.' });
      else resp = comando(cfg, 'user_set_image_list', { match: true, user_images: [{ user_id: Number(item.catracaId), timestamp: Math.floor(Date.now() / 1000), image: foto.jpg }] });
    }
    cmds.push(['HSET', chaveCol('catrafila'), n.id, JSON.stringify(n)]);
    if (n.status !== 'enviado') cmds.push(['INCR', 'ct:rev']);
  } else if (!st.usuariosEm || Date.now() - Date.parse(st.usuariosEm) > LER_USUARIOS_MS) {
    st.pendente = { uuid, tipo: 'usuarios' }; salvarSt();
    resp = comando(cfg, 'load_objects', { object: 'users', fields: ['id', 'name', 'image_timestamp'] });
  } else if (!st.gruposEm) {
    st.pendente = { uuid, tipo: 'grupos' }; salvarSt();
    resp = comando(cfg, 'load_objects', { object: 'user_groups' });
  } else {
    const h = horaSP(); const quer = h >= 23 || h < 6 ? PERIODO_NOITE : PERIODO_DIA;
    if (st.periodo !== quer && !(st.pendente && st.pendente.tipo === 'periodo' && Date.now() - Date.parse(st.pendente.em) < REENVIO_MS)) {
      st.pendente = { uuid, tipo: 'periodo', valor: quer, em: agora() }; salvarSt();
      resp = comando(cfg, 'set_configuration', { push_server: { push_request_period: String(quer) } });
    }
  }
  if (cmds.length) await banco(cmds);
  return resp; // null = nada a fazer (resposta vazia)
}

export async function pushResult(q, body) {
  const b = typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch (_) { return {}; } })() : body || {};
  const uuid = String(q.uuid || b.uuid || '');
  const [pushB, filaB] = await banco([['HGET', chaveCol('catraca'), 'push'], ['HGETALL', chaveCol('catrafila')]]);
  const st = (pushB && JSON.parse(pushB)) || { id: 'push' };
  const resp = typeof b.response === 'string' ? (() => { try { return JSON.parse(b.response); } catch (_) { return b.response; } })() : b.response;
  const erro = b.error ? String(b.error).slice(0, 300) : '';
  const cmds = [['INCR', 'ct:rev']];
  st.ultimoResultado = { em: agora(), endpoint: String(b.endpoint || ''), erro };

  const item = uuid && lista(filaB).find((i) => i.uuid === uuid);
  if (item) {
    const n = { ...item, atualizadoEm: agora() };
    if (item.tipo === 'remover') Object.assign(n, erro ? { status: 'erro', erro } : { status: 'ok', erro: '' });
    else if (item.etapa === 'usuario') {
      if (erro) Object.assign(n, { status: 'erro', erro: 'O leitor não aceitou o cadastro: ' + erro });
      else Object.assign(n, { etapa: st.grupoPadrao ? 'grupo' : 'foto', status: 'pendente', tentativas: 0, erro: '' });
    } else if (item.etapa === 'grupo') {
      // Já estar no grupo também serve: segue para a foto de qualquer jeito.
      Object.assign(n, { etapa: 'foto', status: 'pendente', tentativas: 0 });
    } else if (item.etapa === 'foto') {
      const r = resp && resp.results && resp.results[0];
      if (erro) Object.assign(n, { status: 'erro', erro: 'O leitor não aceitou a foto: ' + erro });
      else if (r && r.success === false) Object.assign(n, { status: 'erro', erro: erroFoto(r) });
      else Object.assign(n, { etapa: 'feito', status: 'ok', erro: '' });
    }
    cmds.push(['HSET', chaveCol('catrafila'), n.id, JSON.stringify(n)]);
  } else if (st.pendente && st.pendente.uuid === uuid) {
    const p = st.pendente; st.pendente = null;
    if (!erro && p.tipo === 'usuarios' && resp && Array.isArray(resp.users)) {
      st.usuarios = resp.users.slice(0, 3000).map((u) => ({ id: u.id, nome: String(u.name || '').slice(0, 80), foto: Number(u.image_timestamp) > 0 }));
      st.usuariosEm = agora();
    } else if (!erro && p.tipo === 'grupos' && resp) {
      const cont = {}; (resp.user_groups || []).forEach((g) => { cont[g.group_id] = (cont[g.group_id] || 0) + 1; });
      const mais = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
      st.grupoPadrao = mais ? Number(mais[0]) : null; st.gruposEm = agora();
    } else if (!erro && p.tipo === 'periodo') st.periodo = p.valor;
  }
  cmds.push(['HSET', chaveCol('catraca'), 'push', JSON.stringify(st)]);
  await banco(cmds);
}

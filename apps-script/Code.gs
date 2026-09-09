/**
 * Confirmacao de Presenca - Insanos MC Barra RJ4
 * Backend do app, publicado como Web App a partir da planilha.
 *
 * Guarda os dados em tres abas legiveis - Membros, Eventos e Presencas -
 * com uma linha por registro, em vez de JSON cru numa unica celula.
 * Duas consequencias praticas:
 *
 *   1. Da para ler, filtrar e editar a planilha na mao.
 *   2. Cada membro grava na propria linha, entao duas pessoas confirmando
 *      ao mesmo tempo nao se sobrescrevem.
 *
 * A aba KV antiga e lida uma unica vez, para migrar o que ja existia.
 *
 * COMO PUBLICAR (repetir a cada alteracao deste arquivo):
 *   Implantar > Gerenciar implantacoes > editar (lapis)
 *   > Versao: Nova versao > Implantar
 * Manter "Executar como: eu" e "Quem tem acesso: qualquer pessoa".
 * A URL nao muda ao criar nova versao de uma implantacao existente.
 */

// Marcador para conferir o que esta publicado de fato: basta chamar a URL do
// Web App com ?action=versao. Subir sempre junto com as alteracoes.
var VERSAO = '2026-09-09-e-relatorio-sob-demanda';

var ABA_MEMBROS = 'Membros';
var ABA_EVENTOS = 'Eventos';
var ABA_PRESENCAS = 'Presencas';
var ABA_RELATORIO = 'Relatorio';
var ABA_KV = 'KV';

var CAB_MEMBROS = ['ID', 'Nome', 'Grau', 'Divisao'];
var CAB_EVENTOS = ['ID', 'Nome', 'Data', 'Horario', 'Endereco', 'Outros', 'Status', 'Criado em'];
var CAB_PRESENCAS = ['ID Evento', 'Evento', 'ID Membro', 'Membro', 'Status',
                     'Direto', 'Destacado', 'Acompanhado', 'Atualizado em'];

// Na planilha fica o rotulo legivel; o app continua falando em chaves.
var STATUS_ROTULO = {
  aguardando: 'Aguardando',
  confirmado: 'Confirmado',
  familia: 'Familia',
  trabalho: 'Trabalho'
};

function statusParaChave(rotulo) {
  for (var chave in STATUS_ROTULO) {
    if (STATUS_ROTULO[chave] === String(rotulo).trim()) return chave;
  }
  return 'aguardando';
}

function simNao(v) { return v ? 'Sim' : 'Nao'; }
function ehSim(v) { return String(v).trim().toLowerCase() === 'sim'; }

// ---------- ENTRADAS ----------

function doGet(e) {
  var p = e.parameter || {};
  var resposta;
  try {
    resposta = executar(p.action || 'dados', p);
  } catch (erro) {
    resposta = { ok: false, erro: String(erro && erro.message || erro) };
  }
  return responder(resposta, p.callback);
}

// Usado pelo sendBeacon, quando a pagina do membro esta sendo fechada.
function doPost(e) {
  var dados = {};
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (erro) {
    return responder({ ok: false, erro: 'Corpo invalido' });
  }
  var resposta;
  try {
    resposta = executar(dados.action || '', dados);
  } catch (erro) {
    resposta = { ok: false, erro: String(erro && erro.message || erro) };
  }
  return responder(resposta);
}

function responder(obj, callback) {
  var texto = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + texto + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(texto)
    .setMimeType(ContentService.MimeType.JSON);
}

function executar(action, p) {
  if (action === 'versao') return { ok: true, versao: VERSAO };
  if (action === 'dados') return { ok: true, membros: lerMembros(), eventos: lerEventos() };
  if (action === 'presencas') return { ok: true, presencas: lerPresencas(p.eventoId) };
  // O relatorio nunca e refeito junto com uma gravacao: fazer isso dobrava o
  // tempo da confirmacao, e o membro esperava por uma pagina que ele nem ve.
  // Ele e gerado sob demanda, pelo botao no app ou pelo menu da planilha.
  if (action === 'presenca') return comTrava(function () { return salvarPresenca(p); });
  if (action === 'membroSalvar') return comTrava(function () { return salvarMembro(p); });
  if (action === 'membroRemover') return comTrava(function () { return removerMembro(p.id); });
  if (action === 'eventoSalvar') return comTrava(function () { return salvarEvento(p); });
  if (action === 'eventoRemover') return comTrava(function () { return removerEvento(p.id); });
  if (action === 'relatorio') return comTrava(function () { return atualizarRelatorio(); });
  throw new Error('Acao desconhecida: ' + action);
}

// Sem a trava, duas gravacoes simultaneas podem escolher a mesma linha vazia.
function comTrava(fn) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) throw new Error('A planilha esta ocupada, tente de novo');
  try {
    return fn();
  } finally {
    trava.releaseLock();
  }
}

// ---------- ABAS ----------

function planilha() { return SpreadsheetApp.getActiveSpreadsheet(); }

function aba(nome, cabecalho) {
  var ss = planilha();
  var s = ss.getSheetByName(nome);
  if (!s) {
    s = ss.insertSheet(nome);
    s.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

function linhas(s) {
  var ultima = s.getLastRow();
  if (ultima < 2) return [];
  return s.getRange(2, 1, ultima - 1, s.getLastColumn()).getValues();
}

function acharLinha(s, teste) {
  var dados = linhas(s);
  for (var i = 0; i < dados.length; i++) {
    if (teste(dados[i])) return { indice: i + 2, valores: dados[i] };
  }
  return null;
}

// ---------- LEITURA ----------

function lerMembros() {
  migrarSePreciso();
  return linhas(aba(ABA_MEMBROS, CAB_MEMBROS))
    .filter(function (l) { return l[0]; })
    .map(function (l) {
      return { id: String(l[0]), nome: String(l[1]), grau: String(l[2] || ''), divisao: String(l[3] || '') };
    });
}

function lerEventos() {
  migrarSePreciso();
  return linhas(aba(ABA_EVENTOS, CAB_EVENTOS))
    .filter(function (l) { return l[0]; })
    .map(function (l) {
      return {
        id: String(l[0]),
        nome: String(l[1]),
        data: formatarData(l[2]),
        horario: formatarHorario(l[3]),
        endereco: String(l[4] || ''),
        outros: String(l[5] || ''),
        status: String(l[6] || 'ativo'),
        criadoEm: ehData(l[7]) ? Utilities.formatDate(l[7], fuso(), 'dd/MM/yyyy HH:mm') : String(l[7] || ''),
        memberIds: membrosDoEvento(String(l[0]))
      };
    });
}

function membrosDoEvento(eventoId) {
  return linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS))
    .filter(function (l) { return String(l[0]) === eventoId && l[2]; })
    .map(function (l) { return String(l[2]); });
}

function lerPresencas(eventoId) {
  var mapa = {};
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (String(l[0]) !== String(eventoId) || !l[2]) return;
    mapa[String(l[2])] = {
      status: statusParaChave(l[4]),
      direto: ehSim(l[5]),
      destacado: ehSim(l[6]),
      acompanhado: ehSim(l[7])
    };
  });
  return mapa;
}

// A planilha devolve Date quando a celula esta formatada como data; o app
// espera sempre o texto ISO.
// O instanceof falha aqui: as datas vem do servico de planilhas, de outro
// contexto de execucao, entao a checagem e pelo formato do objeto.
function ehData(v) {
  return v && Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function formatarData(v) {
  if (ehData(v)) return Utilities.formatDate(v, fuso(), 'yyyy-MM-dd');
  return String(v || '');
}

function formatarHorario(v) {
  if (ehData(v)) return Utilities.formatDate(v, fuso(), 'HH:mm');
  return String(v || '');
}

function fuso() { return planilha().getSpreadsheetTimeZone() || 'America/Sao_Paulo'; }

function agora() {
  return Utilities.formatDate(new Date(), fuso(), 'dd/MM/yyyy HH:mm');
}

// ---------- ESCRITA ----------

function salvarPresenca(p) {
  if (!p.eventoId || !p.membroId) throw new Error('Faltou evento ou membro');
  var s = aba(ABA_PRESENCAS, CAB_PRESENCAS);
  var achado = acharLinha(s, function (l) {
    return String(l[0]) === String(p.eventoId) && String(l[2]) === String(p.membroId);
  });

  var nomeEvento = nomeDe(ABA_EVENTOS, CAB_EVENTOS, p.eventoId);
  var nomeMembro = nomeDe(ABA_MEMBROS, CAB_MEMBROS, p.membroId);
  var linha = [
    p.eventoId, nomeEvento, p.membroId, nomeMembro,
    STATUS_ROTULO[p.status] || STATUS_ROTULO.aguardando,
    simNao(ehVerdadeiro(p.direto)),
    simNao(ehVerdadeiro(p.destacado)),
    simNao(ehVerdadeiro(p.acompanhado)),
    agora()
  ];

  if (achado) s.getRange(achado.indice, 1, 1, linha.length).setValues([linha]);
  else s.appendRow(linha);
  return { ok: true };
}

// Os parametros chegam como texto quando vem pela URL.
function ehVerdadeiro(v) {
  return v === true || v === 'true' || v === 'Sim' || v === 1 || v === '1';
}

function nomeDe(nomeAba, cabecalho, id) {
  var achado = acharLinha(aba(nomeAba, cabecalho), function (l) { return String(l[0]) === String(id); });
  return achado ? String(achado.valores[1]) : '';
}

function salvarMembro(p) {
  if (!p.nome) throw new Error('Faltou o nome');
  var s = aba(ABA_MEMBROS, CAB_MEMBROS);
  var id = p.id || novoId();
  var linha = [id, p.nome, p.grau || '', p.divisao || ''];
  var achado = acharLinha(s, function (l) { return String(l[0]) === String(id); });
  if (achado) s.getRange(achado.indice, 1, 1, linha.length).setValues([linha]);
  else s.appendRow(linha);
  renomearEmPresencas(2, id, p.nome);
  return { ok: true, id: id };
}

function removerMembro(id) {
  apagarLinhas(aba(ABA_MEMBROS, CAB_MEMBROS), function (l) { return String(l[0]) === String(id); });
  apagarLinhas(aba(ABA_PRESENCAS, CAB_PRESENCAS), function (l) { return String(l[2]) === String(id); });
  return { ok: true };
}

function salvarEvento(p) {
  if (!p.nome) throw new Error('Faltou o nome do evento');
  var s = aba(ABA_EVENTOS, CAB_EVENTOS);
  var id = p.id || novoId();
  var achado = acharLinha(s, function (l) { return String(l[0]) === String(id); });
  var criadoEm = achado ? achado.valores[7] : agora();
  var linha = [id, p.nome, p.data || '', p.horario || '', p.endereco || '',
               p.outros || '', p.status || 'ativo', criadoEm];
  if (achado) s.getRange(achado.indice, 1, 1, linha.length).setValues([linha]);
  else s.appendRow(linha);
  renomearEmPresencas(0, id, p.nome);
  if (p.membroIds !== undefined) ajustarParticipantes(id, p.nome, listaDe(p.membroIds));
  return { ok: true, id: id };
}

function removerEvento(id) {
  apagarLinhas(aba(ABA_EVENTOS, CAB_EVENTOS), function (l) { return String(l[0]) === String(id); });
  apagarLinhas(aba(ABA_PRESENCAS, CAB_PRESENCAS), function (l) { return String(l[0]) === String(id); });
  return { ok: true };
}

function listaDe(v) {
  if (Array.isArray(v)) return v.map(String);
  if (!v) return [];
  return String(v).split(',').filter(function (x) { return x; });
}

// Cada participante ganha uma linha em Presencas assim que entra no evento,
// para o organizador ver a lista completa antes de qualquer confirmacao.
function ajustarParticipantes(eventoId, nomeEvento, membroIds) {
  var s = aba(ABA_PRESENCAS, CAB_PRESENCAS);
  var atuais = {};
  linhas(s).forEach(function (l) {
    if (String(l[0]) === String(eventoId)) atuais[String(l[2])] = true;
  });
  membroIds.forEach(function (mid) {
    if (atuais[mid]) return;
    s.appendRow([eventoId, nomeEvento, mid, nomeDe(ABA_MEMBROS, CAB_MEMBROS, mid),
                 STATUS_ROTULO.aguardando, 'Nao', 'Nao', 'Nao', agora()]);
  });
  var mantidos = {};
  membroIds.forEach(function (m) { mantidos[m] = true; });
  apagarLinhas(s, function (l) {
    return String(l[0]) === String(eventoId) && !mantidos[String(l[2])];
  });
}

function renomearEmPresencas(coluna, id, nome) {
  var s = aba(ABA_PRESENCAS, CAB_PRESENCAS);
  var dados = linhas(s);
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][coluna]) === String(id)) {
      s.getRange(i + 2, coluna + 2).setValue(nome);
    }
  }
}

// De tras para frente: apagar de cima muda o indice das linhas seguintes.
function apagarLinhas(s, teste) {
  var dados = linhas(s);
  for (var i = dados.length - 1; i >= 0; i--) {
    if (teste(dados[i])) s.deleteRow(i + 2);
  }
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- RELATORIO ----------

// Visao so de leitura, agrupada por evento e por situacao. E gerada do zero a
// cada alteracao: editar aqui na mao nao tem efeito, os dados vivem na aba
// Presencas.
var ORDEM_SECOES = [
  { chave: 'confirmado', titulo: 'MEMBROS CONFIRMADOS' },
  { chave: 'aguardando', titulo: 'MEMBROS NAO CONFIRMADOS' },
  { chave: 'familia', titulo: 'FALTA - FAMILIA' },
  { chave: 'trabalho', titulo: 'FALTA - TRABALHO' }
];

function atualizarRelatorio() {
  var s = planilha().getSheetByName(ABA_RELATORIO);
  if (!s) s = planilha().insertSheet(ABA_RELATORIO);
  s.clear();

  // Cada aba e lida uma unica vez: consultar por evento ou por membro dentro
  // do laco relia a planilha inteira a cada volta.
  var nomes = {};
  linhas(aba(ABA_MEMBROS, CAB_MEMBROS)).forEach(function (l) {
    if (l[0]) nomes[String(l[0])] = String(l[1] || '');
  });

  var porEvento = {};
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (!l[0] || !l[2]) return;
    var eid = String(l[0]);
    if (!porEvento[eid]) porEvento[eid] = [];
    porEvento[eid].push({
      membroId: String(l[2]),
      status: statusParaChave(l[4]),
      direto: ehSim(l[5]),
      destacado: ehSim(l[6]),
      acompanhado: ehSim(l[7])
    });
  });

  var eventos = linhas(aba(ABA_EVENTOS, CAB_EVENTOS))
    .filter(function (l) { return l[0]; })
    .map(function (l) {
      return {
        id: String(l[0]), nome: String(l[1]), data: formatarData(l[2]),
        horario: formatarHorario(l[3]), endereco: String(l[4] || ''),
        status: String(l[6] || 'ativo')
      };
    });

  var linhasSaida = [];
  var formatos = [];   // {linha, tipo} para aplicar negrito e cor depois

  if (!eventos.length) {
    linhasSaida.push(['Nenhum evento cadastrado.', '']);
  }

  eventos.forEach(function (ev, indice) {
    if (indice) { linhasSaida.push(['', '']); linhasSaida.push(['', '']); }

    formatos.push({ linha: linhasSaida.length + 1, tipo: 'evento' });
    linhasSaida.push([ev.nome, ev.status === 'encerrado' ? 'ENCERRADO' : 'ATIVO']);

    var detalhes = [];
    if (ev.data) detalhes.push(formatarDataBR(ev.data));
    if (ev.horario) detalhes.push(ev.horario);
    if (ev.endereco) detalhes.push(ev.endereco);
    if (detalhes.length) {
      formatos.push({ linha: linhasSaida.length + 1, tipo: 'detalhe' });
      linhasSaida.push([detalhes.join('  -  '), '']);
    }

    var porStatus = { confirmado: [], aguardando: [], familia: [], trabalho: [] };
    (porEvento[ev.id] || []).forEach(function (p) {
      var selos = [];
      if (p.direto) selos.push('Direto');
      if (p.destacado) selos.push('Destacado');
      if (p.acompanhado) selos.push('Acompanhado');
      (porStatus[p.status] || porStatus.aguardando)
        .push({ nome: nomes[p.membroId] || p.membroId, selos: selos.join(', ') });
    });
    Object.keys(porStatus).forEach(function (k) {
      porStatus[k].sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    });

    ORDEM_SECOES.forEach(function (secao) {
      var lista = porStatus[secao.chave];
      linhasSaida.push(['', '']);
      formatos.push({ linha: linhasSaida.length + 1, tipo: 'secao' });
      linhasSaida.push([secao.titulo + ' (' + lista.length + ')', '']);
      if (!lista.length) {
        linhasSaida.push(['   -', '']);
      } else {
        lista.forEach(function (m) { linhasSaida.push(['   ' + m.nome, m.selos]); });
      }
    });
  });

  s.getRange(1, 1, linhasSaida.length, 2).setValues(linhasSaida);

  formatos.forEach(function (f) {
    var linha = s.getRange(f.linha, 1, 1, 2);
    if (f.tipo === 'evento') linha.setFontWeight('bold').setFontSize(13);
    if (f.tipo === 'secao') linha.setFontWeight('bold').setFontColor('#666666');
    if (f.tipo === 'detalhe') linha.setFontColor('#888888').setFontStyle('italic');
  });

  s.setColumnWidth(1, 320);
  s.setColumnWidth(2, 200);
  return { ok: true };
}

function formatarDataBR(iso) {
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}

// Um menu na planilha, caso queira gerar sem passar pelo app.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Confirmacao MC')
    .addItem('Gerar relatorio agora', 'atualizarRelatorio')
    .addToUi();
}

// ---------- MIGRACAO ----------

// Roda uma vez so: se as abas novas estao vazias e a KV antiga tem dados,
// converte tudo. Depois disso a KV fica so como historico.
function migrarSePreciso() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('migrado') === 'sim') return;

  var kv = planilha().getSheetByName(ABA_KV);
  var mMembros = aba(ABA_MEMBROS, CAB_MEMBROS);
  var mEventos = aba(ABA_EVENTOS, CAB_EVENTOS);
  var mPresencas = aba(ABA_PRESENCAS, CAB_PRESENCAS);

  if (!kv || linhas(mMembros).length || linhas(mEventos).length) {
    props.setProperty('migrado', 'sim');
    return;
  }

  var valores = {};
  linhas(kv).forEach(function (l) { if (l[0]) valores[String(l[0])] = String(l[1] || ''); });

  var roster = parseOuVazio(valores['mc-roster'], []);
  roster.forEach(function (m) {
    mMembros.appendRow([m.id, m.nome || '', m.grau || '', m.divisao || '']);
  });

  var eventos = parseOuVazio(valores['mc-events'], []);
  eventos.forEach(function (ev) {
    mEventos.appendRow([ev.id, ev.nome || '', ev.data || '', ev.horario || '',
                        ev.endereco || '', ev.outros || '', ev.status || 'ativo',
                        ev.createdAt ? Utilities.formatDate(new Date(ev.createdAt), fuso(), 'dd/MM/yyyy HH:mm') : agora()]);

    var status = parseOuVazio(valores['mc-status-' + ev.id], {});
    (ev.memberIds || []).forEach(function (mid) {
      var membro = null;
      for (var i = 0; i < roster.length; i++) if (roster[i].id === mid) membro = roster[i];
      var st = status[mid] || {};
      mPresencas.appendRow([
        ev.id, ev.nome || '', mid, membro ? membro.nome : '',
        STATUS_ROTULO[st.status] || STATUS_ROTULO.aguardando,
        simNao(st.direto), simNao(st.destacado), simNao(st.acompanhado), agora()
      ]);
    });
  });

  props.setProperty('migrado', 'sim');
}

function parseOuVazio(texto, padrao) {
  if (!texto) return padrao;
  try { return JSON.parse(texto); } catch (e) { return padrao; }
}

// Util para rodar na mao pelo editor, caso queira refazer a migracao.
function refazerMigracao() {
  PropertiesService.getScriptProperties().deleteProperty('migrado');
  migrarSePreciso();
}

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
var VERSAO = '2026-09-10-o-batch-participantes';

var ABA_MEMBROS = 'Membros';
var ABA_EVENTOS = 'Eventos';
var ABA_PRESENCAS = 'Presencas';
var ABA_RELATORIO = 'Relatorio';
var ABA_REGIONAL = 'Regional RJ4';
var ABA_KV = 'KV';

var CAB_MEMBROS = ['ID', 'Nome', 'Grau', 'Divisao', 'Funcoes'];
var CAB_EVENTOS = ['ID', 'Nome', 'Data', 'Horario', 'Endereco', 'Outros', 'Status', 'Criado em', 'Categoria', 'Tipo'];
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
  if (action === 'relatorio') return comTrava(function () {
    atualizarRelatorio();
    atualizarAbaRegional();
    atualizarAbasDivisoes();
    return { ok: true };
  });
  if (action === 'estatisticas') return { ok: true, membros: lerEstatisticasMembros(String(p.categoria || '')) };
  if (action === 'verificarPin') return verificarPin(String(p.escopo || ''), String(p.pin || ''));
  if (action === 'rankPresenca') return { ok: true, rank: calcularRankPresenca(String(p.janela || 'sempre')) };
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

// ---------- PIN ----------
// Os PINs ficam nas Propriedades do Script (Apps Script > Configuracoes do
// projeto > Propriedades do script) - nunca no codigo que roda no
// navegador, entao nao da pra achar "ver codigo-fonte". Trocar um PIN e so
// editar o valor da propriedade correspondente, sem mexer em codigo.
var ESCOPOS_VALIDOS = ['barra', 'oeste', 'recreio', 'curicica', 'taquara', 'gardenia', 'regional'];
// Espelha a lista ESCOPOS do index.html (chave -> nome). Se uma divisao for
// renomeada la, atualizar aqui tambem.
var ESCOPOS_NOME = {
  barra: 'Barra - RJ4', oeste: 'Oeste - RJ4', recreio: 'Recreio - RJ4',
  curicica: 'Curicica - RJ4', taquara: 'Taquara - RJ4', gardenia: 'Gardênia - RJ4',
  regional: 'Regional RJ4'
};

// O app nunca compara PIN sozinho - manda o que a pessoa digitou pra ca, e
// so recebe de volta se bateu ou nao. Assim o valor certo nunca trafega
// para fora do servidor.
function verificarPin(escopo, pinDigitado) {
  if (ESCOPOS_VALIDOS.indexOf(escopo) === -1 || !pinDigitado) return { ok: true, valido: false };
  var props = PropertiesService.getScriptProperties();
  var pinRegional = props.getProperty('PIN_REGIONAL') || '';
  // O PIN do Regional e chave-mestra: abre qualquer divisao, alem da propria.
  if (pinRegional && pinDigitado === pinRegional) return { ok: true, valido: true };
  var pinEscopo = props.getProperty('PIN_' + escopo.toUpperCase()) || '';
  return { ok: true, valido: !!pinEscopo && pinDigitado === pinEscopo };
}

// Rodar UMA VEZ pelo editor do Apps Script (selecionar esta funcao no menu
// de funcoes, no topo, e clicar em Executar) para criar os 7 PINs, todos
// comecando iguais ao PIN unico de hoje. Depois disso, trocar um PIN e so
// editar a propriedade correspondente em Configuracoes do projeto >
// Propriedades do script - nao precisa rodar esta funcao de novo.
function configurarPinsIniciais() {
  var props = PropertiesService.getScriptProperties();
  var chaves = ['BARRA', 'OESTE', 'RECREIO', 'CURICICA', 'TAQUARA', 'GARDENIA', 'REGIONAL'];
  chaves.forEach(function (c) { props.setProperty('PIN_' + c, '0987'); });
  return 'PINs criados: ' + chaves.map(function (c) { return 'PIN_' + c; }).join(', ');
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
      return {
        id: String(l[0]), nome: String(l[1]), grau: String(l[2] || ''), divisao: String(l[3] || ''),
        // Guardado como texto separado por virgula, igual a lista de
        // participantes de um evento - cresce sem precisar de coluna nova
        // a cada funcao que o app ganhar no futuro.
        funcoes: String(l[4] || '').split(',').map(function (f) { return f.trim(); }).filter(Boolean)
      };
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
        // Linhas gravadas antes de existirem varias divisoes tem 'divisao'
        // ou nada - nessa epoca so a Barra existia, entao viram 'barra'.
        // Categorias novas guardam a divisao especifica (recreio, oeste,
        // regional, ...) direto, sem tradução nenhuma.
        categoria: (function () {
          var raw = String(l[8] || '');
          return (raw === '' || raw === 'divisao') ? 'barra' : raw;
        })(),
        tipo: String(l[9] || ''),
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

// Percentual de presenca de cada membro, olhando so para eventos ja
// encerrados: um evento ainda ativo pode ter a confirmacao mudada, entao
// contar ele antes da hora distorceria o numero. Um membro so entra na conta
// de um evento se estava convidado (tem linha em Presencas) - assim quem
// entrou no clube depois de um evento antigo nao e penalizado por ele.
// So os membros daquela divisao entram na conta - sem isso, o organizador
// da Barra veria (e o percentual incluiria) gente de outra divisao.
function lerEstatisticasMembros(categoria) {
  var nomeDivisao = ESCOPOS_NOME[categoria] || '';
  var nomes = {};
  linhas(aba(ABA_MEMBROS, CAB_MEMBROS)).forEach(function (l) {
    if (l[0] && (!nomeDivisao || String(l[3] || '') === nomeDivisao)) nomes[String(l[0])] = String(l[1] || '');
  });

  var encerrados = {};
  linhas(aba(ABA_EVENTOS, CAB_EVENTOS)).forEach(function (l) {
    if (!l[0] || String(l[6]) !== 'encerrado') return;
    var cat = String(l[8] || '');
    cat = (cat === '' || cat === 'divisao') ? 'barra' : cat;
    if (!categoria || cat === categoria) encerrados[String(l[0])] = true;
  });

  var contagem = {};
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (!l[0] || !l[2] || !encerrados[String(l[0])]) return;
    var mid = String(l[2]);
    if (!contagem[mid]) contagem[mid] = { convites: 0, confirmacoes: 0 };
    contagem[mid].convites++;
    if (statusParaChave(l[4]) === 'confirmado') contagem[mid].confirmacoes++;
  });

  return Object.keys(nomes).map(function (mid) {
    var c = contagem[mid] || { convites: 0, confirmacoes: 0 };
    return {
      id: mid,
      nome: nomes[mid],
      convites: c.convites,
      confirmacoes: c.confirmacoes,
      percentual: c.convites ? Math.round((c.confirmacoes / c.convites) * 100) : null
    };
  });
}

var CHAVE_POR_NOME_DIVISAO = (function () {
  var mapa = {};
  Object.keys(ESCOPOS_NOME).forEach(function (chave) { mapa[ESCOPOS_NOME[chave]] = chave; });
  return mapa;
})();

function pctOuNulo(c) { return c.convites ? Math.round((c.confirmacoes / c.convites) * 100) : null; }

// Motor compartilhado do Rank publico e da aba Regional RJ4 da planilha:
// confirmados/convidados por divisao (nos proprios eventos encerrados) e por
// membro (so dentro dos eventos da propria divisao - um membro convidado
// para um evento regional nao mistura essa presenca na % pessoal dele).
// dataInicio (yyyy-mm-dd) filtra so eventos a partir dali; null = sem
// filtro, desde sempre.
function calcularEstatisticasPorEscopo(dataInicio) {
  var nomePorId = {}, divisaoPorId = {};
  linhas(aba(ABA_MEMBROS, CAB_MEMBROS)).forEach(function (l) {
    if (!l[0]) return;
    nomePorId[String(l[0])] = String(l[1] || '');
    divisaoPorId[String(l[0])] = String(l[3] || '');
  });

  var categoriaPorEvento = {};
  linhas(aba(ABA_EVENTOS, CAB_EVENTOS)).forEach(function (l) {
    if (!l[0] || String(l[6]) !== 'encerrado') return;
    if (dataInicio) {
      var dataEv = formatarData(l[2]);
      if (!dataEv || dataEv < dataInicio) return;
    }
    var cat = String(l[8] || '');
    categoriaPorEvento[String(l[0])] = (cat === '' || cat === 'divisao') ? 'barra' : cat;
  });

  var porDivisao = {}, porMembro = {};
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (!l[0] || !l[2]) return;
    var cat = categoriaPorEvento[String(l[0])];
    if (!cat) return;
    var mid = String(l[2]);
    var confirmado = statusParaChave(l[4]) === 'confirmado';

    if (!porDivisao[cat]) porDivisao[cat] = { convites: 0, confirmacoes: 0 };
    porDivisao[cat].convites++;
    if (confirmado) porDivisao[cat].confirmacoes++;

    // So conta pra % pessoal se o evento e da mesma categoria da divisao do
    // membro - senao, um membro convidado por um evento regional teria essa
    // presenca misturada na propria % da divisao dele.
    if (CHAVE_POR_NOME_DIVISAO[divisaoPorId[mid]] === cat) {
      if (!porMembro[mid]) porMembro[mid] = { convites: 0, confirmacoes: 0 };
      porMembro[mid].convites++;
      if (confirmado) porMembro[mid].confirmacoes++;
    }
  });

  var divisoes = ESCOPOS_VALIDOS.map(function (chave) {
    var c = porDivisao[chave] || { convites: 0, confirmacoes: 0 };
    return { chave: chave, nome: ESCOPOS_NOME[chave], convites: c.convites, confirmacoes: c.confirmacoes, percentual: pctOuNulo(c) };
  });

  var membros = Object.keys(nomePorId).map(function (mid) {
    var c = porMembro[mid] || { convites: 0, confirmacoes: 0 };
    return {
      id: mid, nome: nomePorId[mid], divisao: divisaoPorId[mid],
      convites: c.convites, confirmacoes: c.confirmacoes, percentual: pctOuNulo(c)
    };
  });

  return { divisoes: divisoes, membros: membros };
}

function dataCorte(mesesAtras) {
  var d = new Date();
  d.setMonth(d.getMonth() - mesesAtras);
  return Utilities.formatDate(d, fuso(), 'yyyy-MM-dd');
}

// Mesmo calculo de calcularEstatisticasPorEscopo, mas para varias janelas de
// tempo de uma vez, lendo a planilha uma unica vez em vez de uma leitura por
// janela - usado pela aba Regional RJ4, que mostra 1/3/6/12 meses juntos.
// janelasEmMeses: lista de numeros (1, 3, 6, 12, ...); usar null na lista
// para incluir "desde sempre". Devolve um objeto { '1': {...}, '3': {...},
// 'sempre': {...} }, uma chave de texto por janela.
function calcularEstatisticasVariasJanelas(janelasEmMeses) {
  var nomePorId = {}, divisaoPorId = {};
  linhas(aba(ABA_MEMBROS, CAB_MEMBROS)).forEach(function (l) {
    if (!l[0]) return;
    nomePorId[String(l[0])] = String(l[1] || '');
    divisaoPorId[String(l[0])] = String(l[3] || '');
  });

  var eventosInfo = {};
  linhas(aba(ABA_EVENTOS, CAB_EVENTOS)).forEach(function (l) {
    if (!l[0] || String(l[6]) !== 'encerrado') return;
    var cat = String(l[8] || '');
    cat = (cat === '' || cat === 'divisao') ? 'barra' : cat;
    eventosInfo[String(l[0])] = { categoria: cat, data: formatarData(l[2]) };
  });

  var presencas = [];
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (!l[0] || !l[2]) return;
    var info = eventosInfo[String(l[0])];
    if (!info) return;
    presencas.push({
      membroId: String(l[2]), categoria: info.categoria, data: info.data,
      confirmado: statusParaChave(l[4]) === 'confirmado'
    });
  });

  function calcularParaCorte(dataInicio) {
    var porDivisao = {}, porMembro = {};
    presencas.forEach(function (p) {
      if (dataInicio && (!p.data || p.data < dataInicio)) return;

      if (!porDivisao[p.categoria]) porDivisao[p.categoria] = { convites: 0, confirmacoes: 0 };
      porDivisao[p.categoria].convites++;
      if (p.confirmado) porDivisao[p.categoria].confirmacoes++;

      if (CHAVE_POR_NOME_DIVISAO[divisaoPorId[p.membroId]] === p.categoria) {
        if (!porMembro[p.membroId]) porMembro[p.membroId] = { convites: 0, confirmacoes: 0 };
        porMembro[p.membroId].convites++;
        if (p.confirmado) porMembro[p.membroId].confirmacoes++;
      }
    });

    var divisoes = ESCOPOS_VALIDOS.map(function (chave) {
      var c = porDivisao[chave] || { convites: 0, confirmacoes: 0 };
      return { chave: chave, nome: ESCOPOS_NOME[chave], convites: c.convites, confirmacoes: c.confirmacoes, percentual: pctOuNulo(c) };
    });
    var membros = Object.keys(nomePorId).map(function (mid) {
      var c = porMembro[mid] || { convites: 0, confirmacoes: 0 };
      return { id: mid, nome: nomePorId[mid], divisao: divisaoPorId[mid], convites: c.convites, confirmacoes: c.confirmacoes, percentual: pctOuNulo(c) };
    });
    return { divisoes: divisoes, membros: membros };
  }

  var resultado = {};
  janelasEmMeses.forEach(function (m) {
    resultado[m === null ? 'sempre' : String(m)] = calcularParaCorte(m === null ? null : dataCorte(m));
  });
  return resultado;
}

// Rank publico: 'sempre' (padrao) ou '6meses'.
function calcularRankPresenca(janela) {
  return calcularEstatisticasPorEscopo(janela === '6meses' ? dataCorte(6) : null);
}

// Regional primeiro, depois as divisoes em ordem alfabetica - mesmo padrao
// usado em todo o app.
var ORDEM_EXIBICAO_ESCOPOS = ['regional', 'barra', 'curicica', 'gardenia', 'oeste', 'recreio', 'taquara'];

// So chamada de dentro do Regional (via o botao "Gerar relatorio na
// planilha", que so aparece la). So o resumo - % de cada divisao e o total
// regional junto, desde sempre (sem janela de tempo - o motor
// calcularEstatisticasPorEscopo aceita data de corte, so nao esta sendo
// usado aqui por enquanto; e facil religar se um dia quiser de volta).
// 4 colunas lado a lado - 1, 3, 6 e 12 meses (sem "desde sempre" aqui, so
// essas 4 janelas mesmo).
var JANELAS_REGIONAL = [
  { meses: 1, titulo: '1 MÊS' },
  { meses: 3, titulo: '3 MESES' },
  { meses: 6, titulo: '6 MESES' },
  { meses: 12, titulo: '12 MESES' }
];

function atualizarAbaRegional() {
  var s = planilha().getSheetByName(ABA_REGIONAL);
  if (!s) s = planilha().insertSheet(ABA_REGIONAL);
  s.clear();

  var porJanela = calcularEstatisticasVariasJanelas(JANELAS_REGIONAL.map(function (j) { return j.meses; }));
  var numColunas = JANELAS_REGIONAL.length + 1;

  function pctTexto(v) { return (v === null || v === undefined) ? '-' : v + '%'; }
  function porChave(estat, chave) {
    for (var i = 0; i < estat.divisoes.length; i++) if (estat.divisoes[i].chave === chave) return estat.divisoes[i];
    return null;
  }
  function totalDe(estat) {
    var conv = 0, conf = 0;
    estat.divisoes.forEach(function (d) { conv += d.convites; conf += d.confirmacoes; });
    return conv ? Math.round((conf / conv) * 100) : null;
  }
  function colunasVazias(n) { var a = []; for (var i = 0; i < n; i++) a.push(''); return a; }
  function linhaVazia() { return colunasVazias(numColunas); }

  var linhasSaida = [];
  var formatos = [];

  formatos.push({ linha: linhasSaida.length + 1, tipo: 'titulo' });
  linhasSaida.push(['REGIONAL RJ4 — RESUMO DE PRESENÇA'].concat(colunasVazias(numColunas - 1)));
  formatos.push({ linha: linhasSaida.length + 1, tipo: 'detalhe' });
  linhasSaida.push(['Gerado em ' + agora()].concat(colunasVazias(numColunas - 1)));
  linhasSaida.push(linhaVazia());

  formatos.push({ linha: linhasSaida.length + 1, tipo: 'cabecalho' });
  linhasSaida.push([''].concat(JANELAS_REGIONAL.map(function (j) { return j.titulo; })));

  formatos.push({ linha: linhasSaida.length + 1, tipo: 'total' });
  linhasSaida.push(['🏆 RANK TOTAL REGIONAL'].concat(JANELAS_REGIONAL.map(function (j) {
    return pctTexto(totalDe(porJanela[j.meses]));
  })));
  linhasSaida.push(linhaVazia());

  formatos.push({ linha: linhasSaida.length + 1, tipo: 'secao' });
  linhasSaida.push(['% DE EFETIVO POR DIVISÃO'].concat(colunasVazias(numColunas - 1)));
  ORDEM_EXIBICAO_ESCOPOS.forEach(function (chave) {
    var linha = [ESCOPOS_NOME[chave]];
    JANELAS_REGIONAL.forEach(function (j) {
      var e = porChave(porJanela[j.meses], chave);
      linha.push(pctTexto(e && e.percentual));
    });
    linhasSaida.push(linha);
  });

  s.getRange(1, 1, linhasSaida.length, numColunas).setValues(linhasSaida);

  formatos.forEach(function (f) {
    var linha = s.getRange(f.linha, 1, 1, numColunas);
    if (f.tipo === 'titulo') linha.setFontWeight('bold').setFontSize(14);
    if (f.tipo === 'detalhe') linha.setFontColor('#888888').setFontStyle('italic');
    if (f.tipo === 'cabecalho') linha.setFontWeight('bold').setFontColor('#666666').setFontSize(10);
    if (f.tipo === 'total') linha.setFontWeight('bold').setFontSize(13).setFontColor('#1a7a3c');
    if (f.tipo === 'secao') linha.setFontWeight('bold').setFontColor('#666666');
  });

  s.setColumnWidth(1, 220);
  for (var c = 2; c <= numColunas; c++) s.setColumnWidth(c, 80);
}

// Uma aba por divisao (nao inclui Regional - a dela e so o resumo, acima).
// Topo: cada integrante e a % dele, desde sempre. Embaixo: cada evento
// daquela divisao e a % de presenca dele, com o nome em vermelho se o
// evento ja encerrou e em verde se ainda esta ativo.
var CHAVES_DIVISOES_DETALHE = ['barra', 'oeste', 'recreio', 'curicica', 'taquara', 'gardenia'];

function atualizarAbasDivisoes() {
  var estat = calcularEstatisticasPorEscopo(null);

  var todosEventos = lerEventos();
  var eventosPorCategoria = {};
  todosEventos.forEach(function (ev) {
    var cat = ev.categoria || 'barra';
    (eventosPorCategoria[cat] = eventosPorCategoria[cat] || []).push(ev);
  });

  // Uma leitura so da aba Presencas, reaproveitada pelas 6 divisoes.
  var presencasPorEvento = {};
  linhas(aba(ABA_PRESENCAS, CAB_PRESENCAS)).forEach(function (l) {
    if (!l[0] || !l[2]) return;
    var eid = String(l[0]);
    if (!presencasPorEvento[eid]) presencasPorEvento[eid] = { confirmados: 0, total: 0 };
    presencasPorEvento[eid].total++;
    if (statusParaChave(l[4]) === 'confirmado') presencasPorEvento[eid].confirmados++;
  });

  CHAVES_DIVISOES_DETALHE.forEach(function (chave) {
    var nomeAba = ESCOPOS_NOME[chave];
    var s = planilha().getSheetByName(nomeAba);
    if (!s) s = planilha().insertSheet(nomeAba);
    s.clear();

    var linhasSaida = [];
    var formatos = [];

    formatos.push({ linha: linhasSaida.length + 1, tipo: 'titulo' });
    linhasSaida.push([nomeAba.toUpperCase(), '']);
    formatos.push({ linha: linhasSaida.length + 1, tipo: 'detalhe' });
    linhasSaida.push(['Gerado em ' + agora(), '']);
    linhasSaida.push(['', '']);

    formatos.push({ linha: linhasSaida.length + 1, tipo: 'secao' });
    linhasSaida.push(['INTEGRANTES', '']);
    var membrosDaDivisao = estat.membros
      .filter(function (m) { return m.divisao === nomeAba; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    if (!membrosDaDivisao.length) {
      linhasSaida.push(['(nenhum membro cadastrado)', '']);
    } else {
      membrosDaDivisao.forEach(function (m) {
        linhasSaida.push([m.nome, m.percentual === null ? '-' : m.percentual + '%']);
      });
    }

    linhasSaida.push(['', '']);
    formatos.push({ linha: linhasSaida.length + 1, tipo: 'secao' });
    linhasSaida.push(['EVENTOS', '']);

    var eventosDaDivisao = (eventosPorCategoria[chave] || []).slice()
      .sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });

    if (!eventosDaDivisao.length) {
      linhasSaida.push(['(nenhum evento criado)', '']);
    } else {
      eventosDaDivisao.forEach(function (ev) {
        var c = presencasPorEvento[ev.id] || { confirmados: 0, total: 0 };
        var pct = c.total ? Math.round((c.confirmados / c.total) * 100) : 0;
        formatos.push({ linha: linhasSaida.length + 1, tipo: ev.status === 'encerrado' ? 'eventoEncerrado' : 'eventoAtivo' });
        linhasSaida.push([ev.nome, pct + '%']);
      });
    }

    s.getRange(1, 1, linhasSaida.length, 2).setValues(linhasSaida);
    formatos.forEach(function (f) {
      if (f.tipo === 'titulo') s.getRange(f.linha, 1, 1, 2).setFontWeight('bold').setFontSize(14);
      if (f.tipo === 'detalhe') s.getRange(f.linha, 1, 1, 2).setFontColor('#888888').setFontStyle('italic');
      if (f.tipo === 'secao') s.getRange(f.linha, 1, 1, 2).setFontWeight('bold').setFontColor('#666666');
      // So o nome do evento fica colorido - a % ao lado continua na cor padrao.
      if (f.tipo === 'eventoEncerrado') s.getRange(f.linha, 1).setFontColor('#c0392b');
      if (f.tipo === 'eventoAtivo') s.getRange(f.linha, 1).setFontColor('#1a7a3c');
    });

    s.setColumnWidth(1, 260);
    s.setColumnWidth(2, 90);
  });
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
  var linha = [id, p.nome, p.grau || '', p.divisao || '', p.funcoes || ''];
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
  var categoria = String(p.categoria || 'barra');
  var linha = [id, p.nome, p.data || '', p.horario || '', p.endereco || '',
               p.outros || '', p.status || 'ativo', criadoEm, categoria, p.tipo || ''];
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

  // Uma escrita so para todos os participantes novos, em vez de uma
  // appendRow por pessoa. Com eventos regionais grandes (dezenas de
  // membros), gravar um por um era lento o bastante pra: (1) estourar o
  // tempo limite no navegador, e (2) deixar uma janela longa em que uma
  // leitura concorrente (ex.: apos aquele timeout, o app tenta recarregar
  // sozinho) pegava a planilha no meio da escrita e via uma lista parcial.
  var linhasNovas = [];
  membroIds.forEach(function (mid) {
    if (atuais[mid]) return;
    linhasNovas.push([eventoId, nomeEvento, mid, nomeDe(ABA_MEMBROS, CAB_MEMBROS, mid),
                       STATUS_ROTULO.aguardando, 'Nao', 'Nao', 'Nao', agora()]);
  });
  if (linhasNovas.length) {
    var proximaLinha = s.getLastRow() + 1;
    s.getRange(proximaLinha, 1, linhasNovas.length, linhasNovas[0].length).setValues(linhasNovas);
  }

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

    // Cada participante tem uma linha em Presencas (ajustarParticipantes
    // garante isso ao criar/editar o evento), entao contar as linhas equivale
    // a contar os convidados - sem precisar reler a planilha de novo aqui.
    var totalConvidados = (porEvento[ev.id] || []).length;
    var percentualEvento = totalConvidados ? Math.round((porStatus.confirmado.length / totalConvidados) * 100) : 0;
    formatos.push({ linha: linhasSaida.length + 1, tipo: 'percentual' });
    linhasSaida.push([percentualEvento + '% DE PRESENCA (' + porStatus.confirmado.length + ' de ' + totalConvidados + ')', '']);

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
    if (f.tipo === 'percentual') linha.setFontWeight('bold').setFontColor('#1a7a3c');
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

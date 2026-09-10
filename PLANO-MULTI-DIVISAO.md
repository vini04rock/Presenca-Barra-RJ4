# Plano futuro: RJ4 com várias divisões

Este documento existe para quando chegar a hora de abrir o app pras outras
divisões da RJ4 (Recreio, Gardênia, Leste, ...). **Não é para implementar
agora** — combinado que isso fica pra uma sessão dedicada, quando a próxima
divisão estiver de fato pronta pra entrar. É só o registro da decisão, pra
não se perder entre uma conversa e outra.

> Histórico: uma versão anterior deste documento apontava pro caminho
> oposto — um app e uma planilha separados por divisão. Foi reconsiderado.
> O que vale é o que está escrito abaixo.

## A decisão

**Um app só, uma planilha só**, pra RJ4 inteira. Não uma cópia por divisão.

- A tela inicial (onde o membro confirma presença) mostra os eventos ativos
  de **todas as divisões juntas**.
- O "Modo organizador" abre uma lista de divisões (a tela que já existe
  hoje, com só a Barra - RJ4 dentro). Cada uma tem o **próprio PIN**. Ao
  entrar numa divisão, o organizador só vê e edita os membros e eventos
  **daquela** divisão — sem trocar de site, sem sair do app.

## Já implementado (passo intermediário, com uma planilha só)

Antes da reescrita grande acontecer, alguns pedaços dela já foram
adiantados, de um jeito que funciona hoje mesmo com uma unica aba
`Membros`/`Eventos`/`Presencas` compartilhada:

- Todo evento tem uma **categoria** real (`divisao` ou `regional`),
  gravada na planilha - não é filtro por nome, é um campo de verdade.
- O "Modo organizador" já tem os dois botões, **Barra - RJ4** e
  **Regional RJ4** (mesmo PIN por enquanto). A categoria do evento vem
  automaticamente de qual botão o organizador entrou.
- A tela inicial dos membros já pede pra escolher entre Barra e Regional
  antes de mostrar os eventos ativos.
- O botão **"Gerar relatório na planilha"** (que reescreve a aba
  `Relatorio` inteira, cobrindo todas as categorias juntas) só aparece
  dentro do Regional - é uma ação de quem enxerga o quadro geral, não do
  dia a dia de cada divisão. Cada divisão usa o "Copiar relatório" (por
  evento, texto pronto pro WhatsApp), que continua disponível nas duas.

O que **ainda não** existe, e só faz sentido junto com a reescrita grande
(abas por divisão): a lista de **membros** continua uma só, compartilhada
entre Barra e Regional. Ver a seção de participantes de evento, logo
abaixo, para a regra já combinada de como isso vai funcionar quando as
abas por divisão existirem.

## Como a planilha fica

Em vez de uma coluna "Divisão" dentro de abas compartilhadas, a divisão vira
**aba própria** — o mesmo padrão de `Membros` / `Eventos` / `Presencas` que
já existe hoje, só que um jogo dessas três por divisão:

```
Membros - Barra        Eventos - Barra        Presencas - Barra
Membros - Recreio      Eventos - Recreio      Presencas - Recreio
Membros - Gardênia     Eventos - Gardênia     Presencas - Gardênia
Membros - Leste        Eventos - Leste        Presencas - Leste
```

Mais uma aba de resumo, só de leitura, juntando as quatro:

```
Regional RJ4
```

Essa aba mostra **só percentual** — nada de nome de evento, endereço ou
quem faltou por quê, isso fica dentro de cada divisão. Duas visões:

- **% de efetivo por divisão** — o quanto cada divisão confirmou presença,
  em média, nos próprios eventos.
- **% de presença por integrante**, agrupado por divisão — a mesma lógica
  que já existe hoje na aba `Presenças` de cada divisão, só que todas as
  divisões aparecem juntas nessa aba regional, cada uma na sua seção.

Ideia de layout (a definir com calma na hora de construir):

```
REGIONAL RJ4 — % DE EFETIVO POR DIVISÃO
Barra - RJ4      78%
Recreio - RJ4    64%
Gardênia - RJ4   81%
Leste - RJ4      70%

BARRA - RJ4
  Costa       92%
  Bull        85%
  ...

RECREIO - RJ4
  ...
```

## Quem participa de um evento

Decidido: a lista de "quem participa", que aparece ao criar ou editar um
evento, depende de onde o evento está sendo criado:

- **Evento de divisão** (ex.: criado dentro do Barra) → a lista mostra só
  os membros **daquela divisão** - vem da aba `Membros - Barra`, sozinha.
- **Evento regional** (criado dentro do Regional) → a lista mostra os
  membros de **todas as divisões juntas** - a união de `Membros - Barra`,
  `Membros - Recreio`, `Membros - Gardênia`, `Membros - Leste`.

Isso não dá pra implementar de verdade enquanto existir uma unica aba de
membros (a filtragem não teria nada real pra filtrar, e ficaria sem uso
até existir uma segunda divisão de membros pra testar contra). Fica pronto
pra ligar assim que as abas por divisão da seção seguinte existirem.

## Por que abas em vez de uma tabela só com coluna "Divisão"

- Reaproveita quase sem alteração o código que já existe (`lerMembros`,
  `lerEventos`, `salvarPresenca`, etc.) — eles passam a receber qual jogo de
  abas usar, em vez de reescrever a lógica de filtro em cada função.
- Um erro de digitação na divisão de uma linha (ex.: "Barra" em vez de
  "Barra - RJ4") não some no meio de uma tabela grande — cada divisão tem a
  própria aba, visualmente separada.
- Facilita migrar: a Barra de hoje (abas `Membros`, `Eventos`, `Presencas`)
  vira `Membros - Barra`, `Eventos - Barra`, `Presencas - Barra` — é
  praticamente renomear, não reconstruir.

## O que isso exige no código (pra dimensionar, não pra fazer agora)

- **`Code.gs`** — toda ação (`membroSalvar`, `eventoSalvar`, `presenca`,
  `relatorio`, `estatisticas`, ...) passa a receber qual divisão, e escolhe
  as abas certas com base nisso. As funções internas (`aba()`, `linhas()`)
  já são genéricas o bastante pra isso não ser uma reescrita, só um
  parâmetro a mais passando por todo lugar.
- **Nova ação** tipo `estatisticasRegionais`, que lê as quatro divisões e
  monta a aba `Regional RJ4`.
- **`index.html`** — o `state` do app precisa guardar "qual divisão o
  organizador está gerenciando agora" depois do PIN, e toda chamada de API
  do modo organizador passa esse valor. A tela inicial (fora do modo
  organizador) passa a buscar eventos das quatro divisões e juntar numa
  lista só.
- **PIN por divisão** — hoje o PIN fica exposto no código-fonte do
  `index.html`, dá pra achar por quem souber olhar. Com quatro PINs, vale
  reconsiderar onde eles ficam guardados (ideia: o `Code.gs` valida o PIN
  do lado do servidor, em vez do `index.html` comparar um valor fixo).

## Percentual de presença, separado por categoria

Decidido: a aba **Presenças (%)** do organizador passa a olhar só para
eventos da categoria de quem está vendo -

- Dentro do **Barra**, o percentual de cada membro conta só os eventos
  de categoria `divisao` (os da própria Barra).
- Dentro do **Regional**, o percentual conta só os eventos de categoria
  `regional`.

E essa visão Regional passa a aparecer **também no app**, não só na
planilha (diferente do que a primeira versão deste documento cogitava,
de deixar só na planilha para quem for consultar).

Diferente da lista de "quem participa de um evento" (que depende das
abas por divisão ainda não existirem), isso **já dá pra implementar
agora**: a categoria do evento já é um campo real, com dados de verdade
dos dois tipos, e o cálculo de percentual (`lerEstatisticasMembros` no
`Code.gs`) só precisa aprender a filtrar por ela.

### Onde isso aparece: botão "Rank de Presença", público

Decidido também o lugar exato: um botão **"🏆 Rank de Presença"** na tela
inicial (a mesma tela onde o membro escolhe entre Barra e Regional),
logo abaixo do subtítulo "RJ4" e acima da linha divisória. Diferente do
"Modo organizador", esse botão **não pede PIN** — qualquer membro que
abrir o link pode ver.

A tela que ele abre mostra dois blocos:

- **Percentual geral de cada divisão** (quando existir mais de uma) - o
  quanto cada divisão confirma presença, em média, nos próprios eventos.
- **Percentual de cada membro**, dentro da divisão dele - a mesma lista
  que já existe hoje na aba Presenças do organizador, só que pública.

Com uma unica divisão (Barra) ainda ativa, o bloco por divisão fica sem
muito sentido (só teria uma linha) - ele passa a valer a pena quando a
Recreio ou outra entrar. Já o percentual por membro da Barra pode
aparecer desde já, assim que a categoria dos eventos estiver
corretamente filtrada (ver acima).

## Perguntas já resolvidas

- **Eventos entre divisões** (tipo o "Bate e Volta Regional RJ4"): viram
  eventos de categoria `regional`, criados dentro do botão Regional — já
  funciona hoje, ver "Já implementado" acima.
- **Cadastro de membro**: acontece de dentro da divisão certa, porque o
  organizador entrou nela primeiro — sem escolher a divisão na mão. Já é
  assim hoje (todo membro cadastrado herda a divisão de quem cadastrou).
- **Quem participa de um evento**: ver a seção "Quem participa de um
  evento", acima.

## Perguntas em aberto pra quando chegar a hora

Nenhuma no momento — todas as levantadas até aqui foram respondidas acima.
Novas perguntas entram aqui conforme aparecerem.

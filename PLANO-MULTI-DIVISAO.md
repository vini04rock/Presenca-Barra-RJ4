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

## Perguntas em aberto pra quando chegar a hora

- **Eventos entre divisões** (tipo o "Bate e Volta Regional RJ4" que já
  existe hoje): fica cadastrado em qual aba de Eventos? A resposta mais
  simples é criar uma divisão "virtual" `Regional` com as próprias abas de
  Eventos/Presencas, só pra esse tipo de evento — evita forçar ele dentro
  de uma divisão só.
- **Cadastro de membro**: ele escolhe a divisão dele no cadastro (a tela
  que existia antes de simplificar pra só Barra), ou o cadastro já acontece
  de dentro da divisão certa, porque o organizador entrou nela primeiro?
  A segunda opção parece mais natural, dado que o organizador de cada
  divisão só mexe na própria.
- **Quem entra na aba `Regional RJ4`**: só percentual, como já decidido —
  mas vale confirmar se algum dia isso precisa ficar visível pro clube
  inteiro (ex.: um card na tela inicial do app) ou se fica só na planilha,
  pra quem for de fato consultar.

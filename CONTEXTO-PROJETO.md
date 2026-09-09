# Confirmação de Presença — Insanos MC Barra RJ4

## O que é
App de página única (`index.html`, sem build, sem dependências além de fontes do Google Fonts) para substituir a listagem de confirmação de presença via WhatsApp do motoclube. Membros abrem um link, tocam no próprio nome, marcam status de presença. Organizador tem um modo protegido por PIN pra criar/editar eventos, cadastrar membros e ver relatórios.

## Stack
- HTML + CSS + JavaScript puro (vanilla), tudo em um único arquivo `index.html`.
- Sem framework, sem build step. Fácil de editar diretamente.
- Hospedado no GitHub Pages (estático).
- Fonte de dados: **não usa localStorage nem window.storage** — usa uma planilha do Google Sheets como backend, via um Apps Script publicado como Web App (URL fixa salva na constante `API_URL` no topo do `<script>`).

## Por que Google Sheets em vez de storage nativo
O app foi inicialmente feito pra rodar como Artifact publicado da Claude (claude.ai), usando `window.storage`. Migramos pra fora da Claude por 2 motivos:
1. `window.storage` exige que cada usuário tenha conta Claude logada — inviável pra membros do clube.
2. Artifacts da Claude rodam num sandbox com CSP que bloqueia `fetch()`/chamadas externas — então nem dava pra usar um backend externo de dentro da Claude.
Por isso o app roda fora da Claude (GitHub Pages) e conversa livremente com o Google Apps Script.

## Como o armazenamento funciona
- `storageGet(key)`: usa uma técnica JSONP (cria uma tag `<script>` dinâmica) pra contornar CORS, já que não controlamos os headers de resposta do Apps Script.
- `storageSet(key, value)`: usa `fetch()` com `mode: 'no-cors'` e `Content-Type: text/plain` (evita preflight). É "fire-and-forget" — não lemos a resposta.
- O Apps Script (`Code.gs`, vive na planilha do Google, não neste repositório) guarda tudo numa aba chamada "KV": cada linha é `[chave, valor-json-em-texto]`.

### Chaves usadas
- `mc-roster` → array de membros `{id, nome, grau, divisao}`
- `mc-events` → array de eventos `{id, nome, memberIds[], status, data, horario, endereco, outros, createdAt}`
- `mc-status-<eventId>` → objeto `{memberId: {status, direto, destacado, acompanhado}}`

## Identidade visual
- Preto e branco (cores do clube), sem paleta colorida — status são diferenciados por forma/peso (contorno tracejado, preenchido, riscado, borda dupla), não por cor.
- Fonte de destaque: "Rye" (Google Fonts) — estilo entalhado, remete ao emblema do clube.
- Fonte de corpo: "IBM Plex Sans".
- Crest do clube (Insanos MC Brasil) embutido como base64 no HTML, no topo da tela inicial.

## Funcionalidades já prontas
- Tela inicial: lista de eventos ativos + crest + acesso ao modo organizador (PIN: `0987`, constante `PIN` no código).
- Tela de evento: dados do evento (data/horário/endereço/outros, se preenchidos) + lista de membros com status tocável (⚠️ Aguardando, ✅ Confirmado, ❌ Família, ❌ Trabalho) e badges extras (🚀 Direto, 🚧 Destacado, 🐯 Acompanhado).
- Modo organizador: abas Eventos (criar/editar/encerrar/excluir, com campos de data/horário/endereço/outros), Membros (cadastro com grau e divisão pré-definidos como chips) e Relatório (resumo de eventos encerrados + botão "Copiar relatório" que gera texto pronto pra colar no WhatsApp).
- Graus disponíveis: I a X. Divisões disponíveis: Barra - RJ4, Recreio - RJ4, Gardênia - RJ4, Leste - RJ4 (fixos no código, em `GRAUS` e `DIVISOES`).

## Próximos passos possíveis (não pedidos ainda, só ideias soltas do dono do projeto)
Nenhum definido no momento — o app está funcional e sendo testado.

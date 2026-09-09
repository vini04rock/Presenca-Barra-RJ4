# Confirmação de Presença — Insanos MC Barra RJ4

App de página única para substituir a lista de confirmação de presença no
WhatsApp. Membros abrem um link, tocam no próprio nome e marcam o status.
O organizador tem um modo protegido por PIN para criar eventos, cadastrar
membros e gerar relatórios.

## Stack

- HTML + CSS + JavaScript puro, tudo em [index.html](index.html).
- Sem framework, sem build step, sem dependências (só Google Fonts).
- Hospedagem: GitHub Pages (estático).
- Backend: planilha do Google Sheets via Apps Script publicado como Web App.
  A URL fica na constante `API_URL`, no topo do `<script>`.

## Como rodar localmente

Abra o `index.html` direto no navegador, ou sirva a pasta:

    python -m http.server 8000

Depois acesse `http://localhost:8000`.

> O app lê e grava na planilha de produção. Não existe ambiente de teste
> separado — cuidado ao mexer com eventos reais abertos.

## Estrutura

    .
    ├── index.html            app inteiro (HTML + CSS + JS)
    ├── CONTEXTO-PROJETO.md   contexto e decisões de arquitetura
    └── README.md

O `Code.gs` do Apps Script vive na planilha do Google, não neste repositório.

## Documentação

Detalhes de arquitetura, chaves de armazenamento, identidade visual e o que
já está pronto: [CONTEXTO-PROJETO.md](CONTEXTO-PROJETO.md).

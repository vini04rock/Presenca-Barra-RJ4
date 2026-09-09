# Links do projeto

## App — link para mandar no grupo

    https://vini04rock.github.io/Presenca-Barra-RJ4/

Atenção às maiúsculas: `P` de Presenca, `B` de Barra, `RJ4` todo maiúsculo.
O endereço diferencia maiúscula de minúscula.

Não precisa de conta nem instalar nada — abre no navegador do celular.
Para virar ícone no aparelho:

- iPhone: botão de compartilhar → "Adicionar à Tela de Início"
- Android: menu ⋮ → "Adicionar à tela inicial"

PIN do modo organizador: `0987` (constante `PIN` no `index.html`).

## Repositório

    https://github.com/vini04rock/Presenca-Barra-RJ4

O site é publicado pelo GitHub Pages a partir da branch `main`, pasta raiz.
Todo `git push` atualiza o site no ar em cerca de 1 minuto.

## Backend — Google Apps Script

URL do Web App (constante `API_URL` no `index.html`):

    https://script.google.com/macros/s/AKfycbyotQH6FypFdkC6D42WQHszNiuG29wqIBal2jBcwXdoCsT-Om_0gyDxFE02hxfwrZegxw/exec

Conferir qual versão está publicada:

    <URL acima>?action=versao

O código vive em [apps-script/Code.gs](apps-script/Code.gs) e precisa ser
colado no editor do Apps Script a cada alteração:

    Extensões > Apps Script > colar > Ctrl+S
    Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar

Usar "Gerenciar implantações", nunca "Nova implantação" — esta última cria
uma URL diferente e quebra o app.

## Planilha

Abas em uso:

- `Membros`, `Eventos`, `Presencas` — os dados. O app lê e grava aqui.
- `Relatorio` — visão organizada por evento, gerada sob demanda pelo botão
  no modo organizador ou pelo menu "Confirmacao MC" da planilha.
- `KV` — formato antigo, mantido apenas como backup da migração.

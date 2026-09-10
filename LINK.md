# Links do projeto

## App — link para mandar no grupo

    https://vini04rock.github.io/Presenca-RJ4/

Atenção às maiúsculas: `P` de Presenca, `RJ4` todo maiúsculo. O endereço
diferencia maiúscula de minúscula.

Não precisa de conta nem instalar nada — abre no navegador do celular.
Para virar ícone no aparelho:

- iPhone: botão de compartilhar → "Adicionar à Tela de Início"
- Android: menu ⋮ → "Adicionar à tela inicial"

PIN do modo organizador: cada uma das 7 divisões (Barra, Oeste, Recreio,
Curicica, Taquara, Gardênia, Regional) tem o próprio PIN, guardado nas
Propriedades do Script do Apps Script — não fica mais no código. O PIN do
Regional funciona como chave-mestra, abrindo qualquer divisão.

## Repositório

    https://github.com/vini04rock/Presenca-RJ4

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

- `Membros`, `Eventos`, `Presencas` — os dados. O app lê e grava aqui,
  filtrando por uma coluna de divisão/categoria (não há aba separada por
  divisão para os dados — ver `PLANO-MULTI-DIVISAO.md`).
- `Relatorio` — por evento, gerada sob demanda pelo botão "Gerar relatório
  na planilha" (só aparece dentro do organizador Regional).
- `Regional RJ4` — resumo comparativo entre divisões, em 4 janelas de
  tempo (1/3/6/12 meses), gerada pelo mesmo botão.
- Uma aba por divisão (`Barra - RJ4`, `Oeste - RJ4`, etc.) — integrantes e
  % de cada um no topo, eventos e % coloridos por status embaixo. Também
  gerada pelo mesmo botão.
- `KV` — formato antigo, mantido apenas como backup da migração inicial.

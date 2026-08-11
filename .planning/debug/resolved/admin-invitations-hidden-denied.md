---
status: resolved
trigger: 'primeiro q nao temos um botao para isso nao e esta dando erro a UI ainda esta horrivel so conseguir entrar pelo link msm'
created: 2026-08-11T05:29:38.257Z
updated: 2026-08-11T06:15:26.124Z
resolved_commit: cfef0c1af6eddf60bcece00042db2dc2f7a8fba3
---

## Sintomas

- A área administrativa não expunha uma entrada visível para `Convites da beta`.
- A URL direta `/pt-BR/admin/people/invitations` retornava `unauthorized` para o proprietário com
  função ativa `security`.
- O erro ocupava uma tela quase vazia e não oferecia recuperação útil.

## Causa raiz

Três contratos divergiam:

1. A navegação agrupava todas as rotas de Pessoas em um único item e escondia a rota filha.
2. A API e o resolvedor de sessão admitiam convites apenas para `operations`, embora o proprietário
   de governança estivesse corretamente provisionado como `security` com capacidades de convite.
3. O escopo forte de `security` não incluía `invitations`.

## Correção

- Foi criada navegação compartilhada e explícita entre `Equipe e acessos` e `Convites da beta`.
- A autoridade de convite agora admite `security` e `operations` somente quando as capacidades e o
  escopo explícitos também estão presentes; outras funções continuam ocultas e negadas.
- O estado de falha foi limitado a um painel compacto com `Voltar para Pessoas` e `Tentar novamente`.

## Verificação

- API: 32 arquivos, 241 testes aprovados.
- Admin: 15 arquivos, 183 testes aprovados; TypeScript e build Next aprovados.
- Storybook live/error: sem overlay nem erros de console.
- Vercel Admin e Render API publicados na revisão exata `cfef0c1`; readiness conectada.
- Reteste humano aprovado pelo proprietário: a entrada `Convites da beta` abriu o workspace `live`,
  exibiu capacidade e dois registros ativos sem `unauthorized`.

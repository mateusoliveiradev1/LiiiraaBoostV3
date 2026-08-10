---
status: resolved
trigger: 'essa tela de pessoas esta estranha de mais'
created: 2026-08-10T14:33:46.100Z
updated: 2026-08-10T14:42:36.000Z
---

## Symptoms

- expected: A rota Pessoas deve carregar autoridade real online, mostrar somente membros administrativos reais e organizar convites, equipe e aprovações com hierarquia operacional clara.
- actual: A rota aparece offline e somente leitura, informa 34 membros e repete várias linhas idênticas de `Admin Evidence 61` com endereços `example.test`.
- errors: A interface informa que o servidor não admitiu registros de Pessoas ou aprovações para a função ativa.
- timeline: Observado durante o UAT real da Fase 4 em 2026-08-10, após a validação do isolamento de sessões.
- reproduction: Entrar no Admin staging com a conta administrativa e abrir a rota Pessoas.

## Current Focus

- hypothesis: Confirmada. O E2E publicado persistia uma nova identidade `admin-e2e-*` a cada execução e o canal global de atualização exigia indevidamente a função Operações.
- test: Cobertura focada exige atualização ao vivo para Segurança sem conceder busca operacional e impede identidades reservadas de evidência na projeção de equipe.
- expecting: Pessoas deve ficar online para Segurança, continuar com mutações protegidas e publicar somente membros administrativos reais.
- next_action: retest published staging route after deployment

## Evidence

- timestamp: 2026-08-10T14:33:46.100Z
  checked: Captura do proprietário na rota Pessoas do Admin staging.
  found: Estado offline/somente leitura, total 34 e várias linhas visualmente idênticas de `Admin Evidence 61` com domínio `example.test`.
  implication: O UAT de convites e governança não é confiável enquanto autoridade, qualidade dos dados e composição visual não forem corrigidas.
- timestamp: 2026-08-10T14:39:37.000Z
  checked: Testes RED de rotas operacionais e composição do control plane de staging.
  found: Segurança recebia HTTP 404 em `/v1/admin/operations/live`; a consulta de equipe não distinguia identidades reais de identidades `admin-e2e-*@example.test`.
  implication: O estado offline e a repetição tinham causas independentes e reproduzíveis.
- timestamp: 2026-08-10T14:42:36.000Z
  checked: API completa, TypeScript, lint, formatação e verificação completa do Admin.
  found: 239 testes da API e 180 testes do Admin passaram; o build Next.js de produção foi concluído.
  implication: A correção preserva o isolamento operacional e está pronta para reteste no staging.

## Eliminated

- Duplicação por chave React ou merge de paginação no cliente: os registros repetidos já eram retornados como memberships distintas pelo PostgreSQL.
- Ausência completa de autoridade para Segurança: as consultas de governança funcionavam; somente o stream compartilhado de frescor estava preso à capacidade de Operações.

## Resolution

- root_cause: O teste publicado criava identidades administrativas duráveis com o mesmo nome e e-mails reservados sem separá-las da projeção real; simultaneamente, o stream de invalidação global reutilizava a autorização de busca exclusiva da função Operações.
- fix: Excluir o namespace reservado `admin-e2e-*@example.test` das consultas publicadas de equipe, permitir o stream somente para qualquer sessão administrativa autenticada sem ampliar capacidades operacionais e corrigir a cópia visual de estado e equipe.
- verification: API 32 arquivos/239 testes; Admin 14 arquivos/180 testes; TypeScript API; ESLint; Prettier; build Next.js 16.3.0.
- files_changed: apps/api/src/modules/admin/operations-routes.ts, apps/api/src/staging/runtime.ts, apps/api/src/modules/admin/operations-routes.test.ts, apps/api/src/staging/runtime-control-plane.test.ts, apps/admin/src/features/admin-access-governance.tsx

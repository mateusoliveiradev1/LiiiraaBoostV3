---
phase: 04-identity-commerce-devices-and-administration
reviewed_at: 2026-08-09
reviewed_commit: 919069687742d9cc378b453dcce10b9464eae9c8
status: remediation-required
overall_score: 16
maximum_score: 24
needs_human_review: true
---

# Revisão visual da Fase 4

## Veredito

O Admin preserva uma base visual forte nas superfícies canônicas construídas no
plano 04-61, mas a migração posterior para autoridade real criou uma segunda
gramática, muito mais simples, nas rotas de produção. O shell, a navegação e os
workspaces especializados continuam sólidos; já as rotas de autoridade, negação,
lista vazia e registros autorizados voltaram a parecer estados técnicos
provisórios.

O resultado ainda é seguro e funcional, porém não possui acabamento consistente
o bastante para encerrar a Fase 4. A remediação deve recuperar a direção Calm
Briefing + Mission Control sem reintroduzir fixtures, funções simuladas ou
autoridade derivada da URL.

Evidência humana:

- `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-18c108e0-21e8-4f8b-be0a-da375c565338.png`
- O owner aprovou o acabamento equivalente do portal Account e pediu a mesma
  revisão de UI/UX para todas as rotas do Admin em 2026-08-09.

Evidência de código:

- `apps/admin/src/features/admin-authority.tsx`
- `apps/admin/src/features/admin-workspace-registry.tsx`
- `apps/admin/src/features/admin-overview.tsx`
- `apps/admin/src/app/admin-shell.css`
- `apps/admin/src/features/*.module.css`

## Pontuação

| Pilar | Nota | Diagnóstico |
|---|---:|---|
| Copywriting | 3/4 | A voz é segura e precisa, mas algumas projeções exibem estados de transporte crus (`live`, `offline`, `degraded`) e as rotas de autoridade usam o título genérico “Função administrativa ativa” no lugar da tarefa real. |
| Visual | 2/4 | Shell e workspaces canônicos seguem a direção aprovada; negação, listas de autoridade e estados vazios ainda são pilhas simples de texto sem composição operacional equivalente. |
| Cor | 4/4 | A base neutra, os limites tonais e o cobalt permanecem restritos a foco, seleção e ação; não há retorno ao visual gamer ou a templates SaaS. |
| Tipografia | 3/4 | Manrope e JetBrains Mono estão empacotadas e a hierarquia principal é correta, mas registros e estados genéricos não diferenciam título, contexto, referência e próxima ação com clareza suficiente. |
| Espaçamento | 2/4 | Os módulos especializados têm bom ritmo, porém as superfícies genéricas deixam grandes vazios, limitam indevidamente a largura de trabalho e não mantêm a mesma cadência responsiva dos workspaces canônicos. |
| Experiência | 2/4 | Segurança, autenticação e navegação são robustas; falta continuidade visual entre rotas, orientação acionável em negação/vazio e uma lista autorizada com identidade, contexto, estado e caminho de detalhe. |

## Falhas prioritárias

### P0 — restaurar a gramática visual na autoridade real

1. Dar a cada rota de autoridade um eyebrow, título, resumo e estado de conexão
   específicos da tarefa, sem usar função ativa como título da página.
2. Traduzir estados de projeção e capacidade antes de renderizar; nenhum valor
   de transporte cru pode aparecer em PT-BR.
3. Transformar negação, vazio, carregamento e falha parcial em regiões de
   trabalho completas com significado, recuperação e próxima ação segura.

### P1 — tornar listas e decisões administráveis

1. Substituir linhas textuais genéricas por registros com referência, resumo
   redigido, estado, affordance de detalhe e alvo mínimo de 44 px.
2. Unificar cabeçalho, autoridade ativa, atualização e contexto entre overview,
   suporte, operações, segurança, diagnóstico e auditoria.
3. Preservar o shell durante troca de rota e refetch, evitando flashes, largura
   comprimida e grandes regiões que parecem implementação ausente.

### P2 — verificar o acabamento completo

1. Capturar produção com autoridade simulada somente no transporte de teste em
   1440, 1024, 390 e 320 px, PT-BR e inglês.
2. Repetir axe, teclado, foco, 200% de texto, reduced motion e forced colors.
3. Atualizar baselines apenas depois que a autoridade real e os workspaces
   canônicos compartilhem a mesma linguagem visual.

## Decisão

A Fase 4 precisa de uma rodada final de recuperação visual do Admin antes da
validação manual 04-25 e do fechamento de evidências 04-26. A remediação não
altera autorização, origem isolada, CSRF, TOTP, step-up, consentimento ou
persistência PostgreSQL; ela corrige somente apresentação, estados e interação.

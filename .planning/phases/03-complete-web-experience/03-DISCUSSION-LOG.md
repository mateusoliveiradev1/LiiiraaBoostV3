# Phase 3: Complete Web Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-30  
**Phase:** 03-complete-web-experience  
**Areas discussed:** Narrativa e estrutura pública, Documentação versionada, Download e verificação, Experiência de conta e administração, Direção visual Impeccable e completude global, Mapa total de rotas e falhas, Responsividade real, Confiança/privacidade/transparência, Operação de conteúdo e lançamento

---

## Narrativa e estrutura pública

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Estrutura da Home | Preparar, provar, restaurar | Produto e capacidades; Confiança primeiro |
| Apresentação de Free e Premium | Comparação transparente por capacidades | Planos como jornada; Apenas Premium |
| Capacidades e limitações | Matriz de suporte com estados claros | Explicação narrativa; Centro separado |
| Ação pública principal | Verificar compatibilidade e baixar | Explorar documentação; Criar conta |
| Política de evidências | Blocos contextuais em cada claim | Página central; Selos resumidos |
| Profundidade da Home | Editorial longa em capítulos | Curta e direta; Modular configurável |
| Material de credibilidade | Releases, metodologia e decisões verificáveis | Estudos sintéticos; Depoimentos futuros |
| Imagens de produto | Capturas reais, anotadas e com proveniência | Ilustrações; Vídeo como peça principal |
| Navegação pública | Poucos pilares por intenção | Menu extenso; Home quase única |
| Recursos futuros | Estado explícito em todo recurso | Roadmap separado; Ocultar futuros |
| Idiomas | Paridade completa PT-BR/inglês | Um idioma principal |
| Relação visual com desktop | Mesma identidade, composição web própria | Cópia literal; Web mais expressiva |

**Notas:** A narrativa deve vender por prova, compatibilidade, reversibilidade e controle. Pressão comercial, urgência artificial e claims sem evidência foram rejeitados.

---

## Documentação versionada

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Organização principal | Por tarefa e intenção | Por módulo; Por tipo de conteúdo |
| Profundidade | Explicação progressiva | Trilhas separadas; Referência isolada |
| Versionamento | Vinculado ao canal e à versão do app | Só versão atual; Só versões principais |
| Deep links do desktop | Destino exato, estável e localizado | Página do domínio; Busca preenchida |
| Busca | Técnica, com filtros e códigos | Texto simples; Sem busca inicial |
| Autoridade do documento | Metadados visíveis | Apenas data; Metadados no rodapé |
| Troubleshooting | Diagnóstico orientado por estado | FAQ; Procedimento linear |
| Scripts e comandos | Explicar sem distribuir mutações genéricas | Inspeção copiável; Comandos avançados |

**Notas:** Nenhum documento pode transformar a web em canal de execução remota ou distribuir scripts de mutação.

---

## Download e verificação

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Antes da confiança pública | Bloquear download e mostrar prontidão | Autoassinado público; Lista de espera |
| Canais | Estável padrão, Beta opt-in, Experimental separado | Um canal; Todos lado a lado |
| Verificação | Assinatura, editor, SHA-256, versão e manifesto | Site como única autoridade; Só SHA-256 |
| Windows 10/11 | Fluxo unificado; diferenças apenas quando reais | Seleção artificial de versão; Detecção do navegador |
| Conta obrigatória | Não | Conta sempre; Free sem conta/Premium com conta |
| Versões antigas | Histórico verificável, binário só se seguro | Só atual; Arquivo completo |
| Divergência de integridade | Bloqueio total | Continuar com aviso; Erro genérico |
| Origem oficial | Somente origens controladas | Mirrors; Repositório público |
| Manifesto | Versão humana e formato de máquina assinado | Apenas humano; Apenas técnico |
| Notas de versão | Mudanças, riscos, compatibilidade e recuperação | Resumo promocional; Commits |
| Pós-download | Próximos passos seguros | Apenas confirmação; Tutorial completo |
| Métricas | Mínimas, agregadas e purpose-bound | Nenhuma; Sessão detalhada |

**Notas:** O usuário esclareceu que o aplicativo funciona normalmente em Windows 10 e 11; a interface não deve inventar uma escolha entre sistemas equivalentes. O instalador de desenvolvimento autoassinado não pode entrar no fluxo público.

---

## Experiência de conta e administração

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Home da conta | Completa com dados demonstrativos rotulados | Shell vazio; Só perfil/plano |
| Sinalização de preview | Persistente e contextual | Banner único; Só no clique |
| Acesso ao admin | Origem separada, sem link público comum | Link no rodapé; Dentro da conta |
| Papéis administrativos | Cenários fechados por função | Superadmin único; Controles iguais |
| Navegação da conta | Por responsabilidade | Painel único; Por frequência |
| Ações remotas | Jornada completa, limite e recibo sem alteração | Desabilitar cedo; Simular sucesso |
| Diagnósticos no admin | Consentimento temporal e auditável | Sempre redigido; Livre no preview |
| Relação visual | Mesma marca, densidades diferentes | Layout igual; Admin neutro |
| Completude | Todo web 100% navegável e funcional | Apenas admin; Escopo parcial |
| Catálogo de cenários | Só desenvolvimento e testes | Seletor público; URLs ocultas |
| Entrada na conta | Completa até o limite da sessão real | Entrar direto no preview; Informativa |
| Estados degradados | Matriz integral por superfície | Erros básicos; Só conta |
| Transições entre apps | Continuidade contextual segura | Apps independentes; Shell único |
| Segurança da conta | E-mail, passkeys, MFA, sessões e recuperação | Resumo; Só senha |
| Auditoria | Linha do tempo imutável e correlacionável | Lista simples; Só por usuário |
| Ações críticas | Motivo, impacto, reautenticação e dupla confirmação | Confirmação simples; Desabilitadas |

**Notas:** O usuário corrigiu explicitamente o alcance: a completude não vale apenas para admin, mas para todo o web app. Nenhuma rota, submenu, formulário ou jornada prevista pode ficar morta.

---

## Direção visual Impeccable e completude global

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Escopo de design | Ecossistema web completo | Somente Home |
| Impacto do hero | PC pronto para a partida | Produto direto; Manifesto técnico |
| Promessa | “Prepare seu PC. Prove o resultado. Restaure com controle.” | “O otimizador definitivo...” |
| Probe visual | Híbrido Command Runway + Evidence Stage | A isolado; B isolado; Pre-Match Sequence |
| Fonte das imagens | Capturas reais do desktop; web interno code-native | Mockups gerados |
| Brief Impeccable | Aprovado | Ajustar |

**Notas:** Os probes gerados servem somente como exploração. A produção usa capturas do aplicativo executável e componentes web reais. A direção rejeita o cenário genérico de headset/cidade e preserva o impacto comercial do hero com a disciplina de evidência logo abaixo.

---

## Mapa total de rotas e falhas

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Divisão dos shells | Público, conta e admin coordenados | Um shell; Shell por subárea |
| Busca fora de docs | Busca pública global | Só documentação; Busca por superfície |
| 404/403/410/500 | Estados próprios e recuperação contextual | Erro genérico; Redirecionar para Home |
| Manutenção parcial | Degradação por superfície | Manutenção global; Falha silenciosa |

**Notas:** A autoridade canônica de rotas deve alcançar navegação, links, sitemap, redirects e testes.

---

## Responsividade real

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Admin móvel | Consulta e resposta segura; sem operações críticas | Paridade total; Desktop obrigatório |
| Docs móveis | Conteúdo completo e navegação recolhível | Desktop reduzido; Versão simplificada |
| Tabelas estreitas | Prioridade de colunas e detalhe expansível | Scroll horizontal; Cards |
| Hero móvel | Copy/CTA primeiro, recortes reais depois | Reduzir tudo; Ocultar produto |
| Navegação móvel | Cabeçalho compacto e menu em tela inteira | Barra inferior; Menu horizontal |
| Conexão lenta | Conteúdo e ações antes da mídia | Visual primeiro; Modo leve tardio |
| Zoom e texto | Reflow a 400% e texto a 200% | Limite 200%; Escala própria |
| Hover e toque | Nada depende de hover | Primeiro toque simula; Ocultar detalhes |

**Notas:** A experiência móvel mantém profundidade funcional e não vira uma versão reduzida do produto.

---

## Confiança, privacidade e transparência

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Cookies e métricas | Sem banner para necessário; consentimento granular para opcional | Banner sempre; Consentimento implícito |
| Privacidade/Termos/Segurança | Resumo claro, texto integral, versão e histórico | Jurídico tradicional; Integral só no cadastro |
| Vulnerabilidades | Divulgação responsável e canal seguro | Suporte comum; Só autenticado |
| Incidentes | Status público e histórico | Só na conta; Apenas post-mortem |
| Direitos do titular | Central de privacidade na conta | Suporte manual; Formulário público |
| Retenção/finalidade | Explicar junto à coleta | Só política; Texto genérico |
| Claim incorreto | Correção rastreável com impacto e histórico | Silenciosa; Remover sem histórico |
| Cobrança e cancelamento | Condições completas no plano | Só preço; Resumo + Termos |

**Notas:** Checkout e direitos de dados permanecem previews honestos até a Fase 4, mas toda a experiência e suas consequências precisam estar representadas.

---

## Operação de conteúdo e lançamento

| Pergunta | Escolha do usuário | Alternativas consideradas |
| --- | --- | --- |
| Autoridade de conteúdo | Repositório versionado, schema e revisão | CMS direto; Híbrido |
| Sincronização de release | Publicação atômica | Independente; Release primeiro |
| Indexação | Política explícita por classe | Tudo público; Só institucional |
| Social previews | Metadados e imagens por conteúdo | Imagem global; Sem imagem |
| PT-BR/inglês | Bloquear se tradução faltar ou estiver velha | Publicar idioma principal; Automática |
| Screenshots | Pipeline determinístico com proveniência | Manual; Permanente |
| Copy | Contrato editorial e validação de claims | Só guia; Só páginas principais |
| Gate de publicação | Completo, sem exceções | Só críticos; Diferente por superfície |
| Conteúdo vencido | Falhar fechado e remover claims acionáveis | Manter; Excluir tudo |
| Links quebrados | Manifesto canônico e verificação automática | Teste manual; Monitorar depois |
| Rollback | Versão completa de código, conteúdo, manifestos e assets | Hotfix; Só código |
| Hero e performance | Progressivo com orçamento rígido | Visual primeiro; Simplificar só mobile |

**Notas:** A operação editorial e a publicação devem preservar a mesma verdade em conteúdo, tradução, documentação, compatibilidade, release, manifestos, screenshots e artefatos.

---

## The agent's Discretion

- Component boundaries, route groups, state-machine decomposition, exact breakpoints, cache strategy, test partitioning, and implementation details dentro dos contratos bloqueados.
- Tipografia final dentro da identidade e das licenças existentes.
- Tratamento atmosférico e motion do hero, desde que respeite reduced motion, performance e os anti-padrões aprovados.
- Conteúdo exato das fixtures, mantendo catálogo fechado, determinístico, tipado e claramente simulado.

## Deferred Ideas

- Autoridade real de autenticação, MFA, sessões, billing, device binding, support upload, consentimento e administração — Phase 4.
- Assinatura comercial publicamente confiável, SmartScreen, distribuição pública e promoção de releases — Phase 10.

# Phase 6: Transactional Plans and Recovery - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase transforma as interfaces simuladas de planos e recuperação em uma autoridade transacional real no Windows. Ela entrega composição e revisão de planos personalizados, aplicação pelo limite privilegiado mínimo, registro exato do estado anterior, verificação do resultado, retomada após interrupções e restauração individual, completa ou por checkpoint. O primeiro efeito real será um plano de energia dedicado e reversível. A ampliação do catálogo de otimizações pertence à Fase 7 e a descoberta/automação de jogos pertence à Fase 8.

</domain>

<decisions>
## Implementation Decisions

### Aplicação real e progressão do alfa
- **D-01:** Toda versão de operação percorre quatro estágios obrigatórios: simulação determinística, VM Windows limpa, PC do proprietário e PCs dos amigos. Não existe promoção direta para uma etapa posterior.
- **D-02:** Cada estágio deve provar o ciclo completo: preparar recuperação, aplicar, verificar, reiniciar quando necessário, restaurar e verificar novamente.
- **D-03:** A primeira operação real cria e ativa um plano de energia separado chamado **Liiiraa Verificado**. O plano de energia atual permanece intacto e sua identidade exata é registrada para restauração.
- **D-04:** Uma alteração aplicada permanece ativa até restauração explícita. Fechar o aplicativo, ficar offline ou perder Premium não desfaz a alteração. Recuperação nunca será bloqueada por assinatura.
- **D-05:** Mudança externa detectada entre preparação, aplicação ou restauração é drift. O executor pausa, mostra a diferença exata e oferece manter o estado atual, restaurar o anterior ou reaplicar quando seguro; nunca sobrescreve silenciosamente.
- **D-06:** Falha em qualquer estágio bloqueia aquela versão da operação em todas as etapas posteriores. Uma correção cria nova versão e reinicia a validação desde a simulação, sem override manual.
- **D-07:** Resultados dos amigos são reunidos em pacote diagnóstico local, redigido e verificável. O usuário vê o conteúdo antes de exportar ou enviar; dados brutos nunca são enviados automaticamente.
- **D-08:** Uma operação distribuída considerada insegura recebe revogação assinada: novas aplicações são bloqueadas, usuários afetados são alertados e a recuperação local continua disponível. Não haverá rollback remoto automático nem execução remota arbitrária.

### Níveis de risco e consentimento
- **D-09:** A progressão é controlada: **Verificado** disponível por padrão; **Avançado** mediante ativação consciente; **Experimental** somente para alfa/beta; **Extremo** visível e explicado, porém bloqueado até existir uma fase futura com controles dedicados.
- **D-10:** A política global é somente um teto máximo de risco. Ela não seleciona operações automaticamente e não remove o controle individual por operação.
- **D-11:** A confirmação é proporcional: Verificado exige revisão clara e uma confirmação; Avançado exige detalhes e autenticação forte; Experimental exige autenticação forte, recuperação comprovada e frase digitada; Extremo não pode ser executado.
- **D-12:** A classificação de risco é técnica e imutável por versão. O usuário não pode reduzi-la. Evidência ausente, degradada, contraditória ou incompatível restringe ou bloqueia a operação.
- **D-13:** Ativar Avançado é uma preferência local, persistente e revogável por PC, protegida por autenticação forte. Mudança relevante de hardware ou postura de segurança exige revalidação.
- **D-14:** Experimental exige consentimento para cada versão e para cada aplicação. Participar do beta apenas torna a operação visível.
- **D-15:** Um plano misto herda o maior risco presente, é apresentado em grupos de risco e dependência e preserva confirmações individuais nas operações sensíveis.
- **D-16:** Mudança de evidência, compatibilidade ou risco entre composição e aplicação invalida a aprovação anterior. A interface mostra o diff e exige nova revisão.

### Falhas, reinício, retomada e fechamento
- **D-17:** Falha parcial restaura automaticamente apenas o grupo de dependências afetado, interrompe novas operações, preserva operações independentes já verificadas e explica o estado final exato.
- **D-18:** Operações que exigem reinício criam checkpoint protegido. O aplicativo nunca força o reinício; o usuário escolhe quando reiniciar. No próximo boot, a verificação ocorre antes de concluir o plano ou admitir novas mutações.
- **D-19:** Após crash, queda de energia ou desligamento inesperado, a recuperação tem prioridade sobre qualquer nova ação. O executor compara o estado real do Windows com o diário durável e apenas conclui uma verificação segura ou restaura o grupo afetado; nunca repete uma mutação às cegas.
- **D-20:** Restauração falha ou estado anterior desconhecido bloqueia novas mutações, encerra repetições automáticas, preserva toda a evidência e abre recuperação guiada com opções seguras, Ponto de Restauração quando aplicável e diagnóstico exportável.
- **D-21:** Cancelamento só ocorre em fronteira segura. Novos estágios param, enquanto a mutação atômica atual termina ou é limitada. Timeout produz estado desconhecido e recuperação, nunca sucesso presumido.
- **D-22:** Mutações são serializadas. Apenas leituras e verificações comprovadamente independentes podem executar em paralelo.
- **D-23:** Somente operações de leitura podem repetir automaticamente de forma limitada. Uma mutação nunca é repetida sem observar antes o estado real; nova tentativa cria nova entrada de diário e exige nova confirmação quando houver incerteza.
- **D-24:** Fechar a janela durante aplicação ou recuperação não interrompe o executor protegido. A UI vai para a bandeja e, quando reaberta, apresenta o progresso atual. Desligamento do Windows é tratado pelo diário durável e pela retomada no próximo boot.

### Central de Recuperação, checkpoints e comprovantes
- **D-25:** A experiência de recuperação fica reunida em uma Central de Recuperação única, com linha do tempo do plano ativo, checkpoints, restauração de operação individual e restauração completa do plano.
- **D-26:** O manifesto próprio do Liiiraa Boost, contendo o estado exato observado, é a autoridade primária de recuperação para toda mutação.
- **D-27:** Ponto de Restauração do Windows é uma segunda camada complementar e nunca a única garantia. Ele é preparado antes de operações Avançadas ou Experimentais quando o Windows permitir. Ausência ou falha dessa camada deve ser explícita e pode bloquear a operação conforme o risco.
- **D-28:** Se, durante a restauração, o valor atual diferir tanto do valor aplicado quanto do valor anterior registrado, há conflito. O sistema pausa, mostra o conflito e permite manter o atual ou restaurar o anterior; nunca sobrescreve silenciosamente.
- **D-29:** Aplicar e restaurar são novas transações auditáveis; o histórico anterior não é apagado nem reescrito.
- **D-30:** Cada aplicação e restauração gera comprovante imutável com resumo humano, detalhes técnicos expansíveis, estado anterior, estado solicitado, estado observado após verificação, método de recuperação e identificador auditável. Mensagem de sucesso sem verificação não é comprovante.

### Restrições herdadas e invariantes
- **D-31:** A UI continua não elevada. Somente um broker privilegiado mínimo pode efetuar comandos específicos, tipados e permitidos; não haverá RPC genérico, scripts remotos, PowerShell arbitrário nem primitivas genéricas de registro, arquivo ou serviço.
- **D-32:** SQLite local, migrado e append-oriented, é a autoridade para diário transacional, retomada e comprovantes. Segredos não são armazenados em texto simples.
- **D-33:** A evidência da Fase 5 é requisito de admissão. Dados desconhecidos ou degradados nunca se transformam silenciosamente em compatibilidade.
- **D-34:** Nenhum teste ou ambiente desta fase usará Docker. A matriz local usa simulação determinística e Hyper-V/Windows real.
- **D-35:** Não declarar suporte de hardware como 100% sem evidência física. Os testes do proprietário e dos amigos alimentam a promoção do alfa e mantêm lacunas visíveis.

### Discrição do agente
- Escolher nomes de crates, módulos, tabelas SQLite, índices, comandos Tauri e mensagens TypeSpec, desde que respeitem os limites tipados, a serialização de mutações e a autoridade append-oriented.
- Definir o layout visual final da revisão do plano, progresso, linha do tempo e comprovantes, preservando o design bespoke existente, WCAG 2.2 AA, teclado completo, leitor de tela e movimento reduzido.
- Definir limites numéricos de retry apenas para leituras, timeouts técnicos, retenção de logs não necessários à recuperação e política de compactação, sem apagar estado necessário para restaurar ou auditar.
- Definir a implementação Windows específica do plano de energia e do Ponto de Restauração usando APIs documentadas e comandos estreitos, com testes de propriedade, falha injetada e upgrade de banco.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Escopo e requisitos
- `.planning/ROADMAP.md` — define a meta, dependência, critérios de sucesso e fronteira da Fase 6.
- `.planning/REQUIREMENTS.md` — define PLAN-01 a PLAN-08 e as restrições herdadas de identidade, diagnóstico e medição.
- `.planning/PROJECT.md` — contém os princípios do produto, segurança local-first, reversibilidade, contratos e limites de plataforma.

### Autoridade de evidência anterior
- `.planning/phases/05-hardware-intelligence-and-measured-evidence/05-SPEC.md` — requisitos bloqueados da autoridade nativa e da evidência medida consumida pela admissão de operações.
- `.planning/phases/05-hardware-intelligence-and-measured-evidence/05-CONTEXT.md` — decisões de coleta, qualidade, ausência explícita e privacidade que a Fase 6 não pode enfraquecer.

### Contratos e shell nativo
- `packages/contracts-source/src/main.tsp` — raiz canônica dos contratos compartilhados.
- `packages/contracts-source/src/shell.tsp` — estados existentes de fechamento, recuperação, rollback e retomada do shell.
- `apps/desktop/src-tauri/src/main.rs` — composição atual do host Tauri e ponto de integração do executor protegido.

### Experiência já representada
- `packages/feature-shell/src/features/improve.tsx` — revisão de plano, metadados de operação, riscos e recuperação atualmente simulados.
- `packages/feature-shell/src/features/recover.tsx` — telas simuladas de snapshots, plano interrompido, recuperação guiada e comprovantes.
- `packages/feature-shell/src/features/preview-workflows.tsx` — máquina de estados de preview que deve evoluir para o fluxo transacional real.
- `packages/feature-shell/src/model/interaction-policy.ts` — políticas atuais de risco, boundary explanations, receipts e rotas de recuperação.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ImproveFeature`: já modela operações, classes de risco, evidência, dependências, restart e método de recuperação; deve ser conectado a contratos e autoridade reais em vez de substituído por outra experiência.
- `RecoverFeature`: já oferece as superfícies conceituais de histórico, snapshots, interrupção, recuperação guiada e comprovantes; será a base da Central de Recuperação.
- `PreviewWorkflows`: já representa preview, pausa, diagnóstico de dependência, retomada e recuperação em uma máquina de estados determinística; serve como oráculo de UI e base de testes.
- `interaction-policy.ts`: já concentra vocabulário de risco, rotas de recuperação e recibos simulados; a fase deve separar claramente policy pura de efeitos nativos.
- Contratos TypeSpec e shell Tauri existentes: devem ser estendidos em uma única fonte, gerando transportes equivalentes para TypeScript e Rust.

### Established Patterns
- A fronteira visual existe antes da autoridade nativa e declara honestamente quando algo é simulado; a Fase 6 substitui essa fronteira de forma incremental, sem estados falsos.
- A UI é não elevada; comandos nativos são estreitos e a elevação, quando indispensável, fica isolada em broker mínimo.
- Estado autoritativo local usa SQLite com migrações e histórico append-oriented.
- Resultados precisam separar solicitado, observado, verificado, degradado, conflitante e indisponível.
- Toda operação crítica deve ser idempotente na observação, não na repetição cega do efeito.

### Integration Points
- Gerador de plano consome objetivos do usuário, capacidades e evidência atual da Fase 5.
- UI de revisão/aplicação conversa com comandos Tauri tipados e acompanha eventos do executor mesmo quando a janela fecha.
- Executor registra intenção e estado anterior antes de chamar o broker privilegiado, verifica o Windows depois e grava o comprovante.
- Inicialização e bandeja consultam o diário antes de permitir novas mutações e retomam planos/checkpoints pendentes.
- Central de Recuperação lê o mesmo diário e emite novas transações de restauração, nunca altera retroativamente o histórico.

</code_context>

<specifics>
## Specific Ideas

- O primeiro teste real e demonstrável será trocar para o plano de energia **Liiiraa Verificado** e voltar exatamente ao plano anterior.
- A VM `LiiiraaBoost-W11-25H2-Clean` será a primeira máquina real da progressão depois da simulação determinística.
- A experiência deve ser muito clara e premium: o usuário entende o que vai mudar, por que, qual o risco, como voltar e o que realmente aconteceu.
- Recuperação é valor central do produto e deve continuar disponível mesmo sem Premium.
- O alfa com amigos é parte da matriz de evidência, não uma justificativa para declarar cobertura universal.

</specifics>

<deferred>
## Deferred Ideas

- Liberar operações de risco Extremo fica adiado até uma fase futura com controles dedicados e evidência própria.
- O catálogo amplo de otimizações de Windows, CPU, GPU, rede, áudio e demais famílias pertence à Fase 7; a Fase 6 entrega a infraestrutura transacional e a primeira operação de energia.
- Descoberta de jogos e automação por sessão pertencem à Fase 8.
- As validações físicas pendentes da Fase 4 permanecem dívida explícita e serão retomadas com os amigos durante o alfa; não bloqueiam o planejamento da Fase 6, mas impedem afirmar cobertura total.

</deferred>

---

*Phase: 6-transactional-plans-and-recovery*
*Context gathered: 2026-08-12*

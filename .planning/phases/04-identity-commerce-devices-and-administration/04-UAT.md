---
status: testing
phase: 04-identity-commerce-devices-and-administration
source:
  - 04-39-SUMMARY.md
  - ../../debug/auth-session-persistence-ui.md
started: 2026-08-06T07:53:16.4689728Z
updated: 2026-08-06T08:40:00.0000000Z
---

## Current Test

number: 4
name: Persistencia apos fechar e reabrir
expected: |
  Depois de fechar completamente o aplicativo e abri-lo novamente, a sessao e restaurada pelo armazenamento seguro do Windows e o usuario continua autenticado sem repetir o login.
awaiting: install replacement 0.0.1 and retest tests 4, 9, 10 and 12

## Tests

### 1. Abertura do login pelo desktop 0.0.1
expected: Ao abrir o Liiiraa Boost 0.0.1 e clicar em Entrar, o navegador padrao abre a pagina de login em portugues no dominio Account da Vercel. A pagina nao mostra erro de rota e preserva a autorizacao solicitada pelo aplicativo.
result: pass
retest: "O instalador conectado Internal #023001 abriu a conta real com sucesso."

### 2. Login e retorno automatico ao aplicativo
expected: O login com a conta principal termina em uma tela de sucesso clara e retorna automaticamente ao desktop, sem copiar codigos ou abrir uma WebView embutida.
result: pass

### 3. Identidade, plano e funcao reais
expected: O desktop mostra o email da conta principal, Premium, Administrador e Seguranca de forma consistente, sem qualquer indicacao conflitante de plano Free.
result: pass

### 4. Persistencia apos fechar e reabrir
expected: Depois de fechar completamente o aplicativo e abri-lo novamente, a sessao e restaurada pelo armazenamento seguro do Windows e o usuario continua autenticado sem repetir o login.
result: [pending]

### 5. Portal da conta autenticado e sem piscadas
expected: Portal da conta abre a conta correta ja autenticada; navegar pelas secoes nao exibe rapidamente a tela Sessao necessaria nem provoca recarregamentos completos perceptiveis.
result: [pending]

### 6. Painel administrativo persistente
expected: A conta principal acessa o Admin como administradora; o menu e as rotas carregam dentro do mesmo shell, sem piscar uma tela deslogada antes do conteudo autorizado.
result: [pending]

### 7. Logout administrativo e do desktop
expected: O logout administrativo encerra a sessao correspondente sem erro, e o logout do desktop remove a credencial local e retorna ao estado de entrada de maneira previsivel.
result: [pending]

### 8. Experiencia mobile do menu
expected: Em largura de celular, o cabecalho publico apresenta um botao de menu acessivel que abre e fecha a navegacao real, em vez de exibir apenas a palavra Menu.
result: [pending]

### 9. Identidade da versao instalada
expected: A tela Sobre mostra Liiiraa Boost 0.0.1 e o canal de teste atual, sem versao 0.0.0, compilacao visual da Fase 2 ou rotulos de demonstracao/simulacao.
result: issue
reported: "A tela Sobre ainda mostra Versao 0.0.0, canal estavel, compilacao visual da Fase 2 e Demonstracao segura no instalador 0.0.1."
severity: major

### 10. Atualizacao persistente do perfil
expected: Alterar o nome de exibicao salva no PostgreSQL, mantem a sessao autenticada e reaparece com o novo valor apos atualizar ou reabrir o aplicativo.
result: issue
reported: "Ao tentar mudar o nome para Mateus Winchester, a conta entrou em restauracao, perdeu a sessao, exigiu novo login e voltou para Mateus Oliveira."
severity: blocker

### 11. Vinculo deste computador
expected: O desktop registra ou oferece uma acao clara para vincular este computador a conta, e a aba Dispositivo mostra o vinculo real persistido pela API.
result: [pending]

### 12. Minimizar para a bandeja
expected: Com a opcao de minimizar para a bandeja ativada, fechar ou minimizar conforme a preferencia esconde a janela principal, mantem o processo na bandeja e permite restaurar o aplicativo pelo icone.
result: issue
reported: "A opcao de minimizar para a bandeja esta ativa, mas o aplicativo nao minimiza para a bandeja."
severity: major

## Summary

total: 12
passed: 3
issues: 3
pending: 6
skipped: 0
blocked: 0

## Gaps

- truth: "O desktop 0.0.1 deve conseguir restaurar a sessao publicada ou oferecer o login real no navegador, sem ficar preso em conexao indisponivel."
  status: resolved
  reason: "User reported: o aplicativo abre preso em Conexao indisponivel / Sua sessao salva continua protegida e nao oferece o caminho de login."
  severity: blocker
  test: 1
  root_cause: "O instalador entregue foi gerado apenas com tauri.conf.json; sem o overlay tauri.staging.conf.json, o host nativo nao recebeu apiOrigin/accountOrigin e retornou network-unavailable localmente."
  artifacts:
    - path: "apps/desktop/package.json"
      issue: "Nao existia um comando de bundle de staging que exigisse o overlay conectado."
    - path: "apps/desktop/src/internal-channel.test.ts"
      issue: "A politica testava o conteudo do overlay, mas nao o comando usado para empacotar o instalador entregue."
  missing:
    - "Nenhum; o owner retestou o instalador conectado com sucesso."
  debug_session: ".planning/debug/auth-session-persistence-ui.md"
- truth: "A tela Sobre deve projetar a identidade real 0.0.1 sem conteudo legado de simulacao."
  status: failed
  reason: "User reported: a tela Sobre continua mostrando 0.0.0, canal estavel, Fase 2 e Demonstracao segura."
  severity: major
  test: 9
  root_cause: "A rota Sobre do runtime nativo ainda consumia valores visuais hardcoded e o updater demonstrativo da Fase 2."
  artifacts:
    - path: "apps/desktop/src/features/premium-operations.tsx"
      issue: "A tela nativa usava versão, canal e atualizador demonstrativos hardcoded."
  missing:
    - "Reteste humano do novo instalador."
  debug_session: ".planning/debug/auth-session-persistence-ui.md"
- truth: "Editar o nome deve persistir no PostgreSQL sem revogar ou perder a sessao desktop."
  status: failed
  reason: "User reported: salvar Mateus Winchester entrou em restauracao, exigiu novo login e voltou ao nome anterior."
  severity: blocker
  test: 10
  root_cause: "A API aplicava CSRF de navegador ao PATCH Bearer nativo; o cliente não enviava If-Match e apagava a credencial em qualquer 403."
  artifacts:
    - path: "apps/api/src/modules/identity/real-routes.ts"
      issue: "PATCH nativo era bloqueado pela política CSRF exclusiva do navegador."
    - path: "apps/desktop/src-tauri/src/account_sync.rs"
      issue: "PATCH não enviava If-Match e 403 apagava a credencial segura."
  missing:
    - "Redeploy da API após push e reteste humano do novo instalador."
  debug_session: ".planning/debug/auth-session-persistence-ui.md"
- truth: "A preferencia ativa de minimizar para a bandeja deve controlar o ciclo real da janela nativa."
  status: failed
  reason: "User reported: minimizar para a bandeja esta ativo, mas o aplicativo nao minimiza para a bandeja."
  severity: major
  test: 12
  root_cause: "O React não sincronizava a preferência restaurada no startup, comandos anteriores ao bridge eram descartados e o Rust ignorava o evento de minimização."
  artifacts:
    - path: "apps/desktop/src/preferences.tsx"
      issue: "Preferência restaurada não era sincronizada com o host no startup."
    - path: "apps/desktop/src-tauri/src/main.rs"
      issue: "O host tratava CloseRequested, mas ignorava a janela minimizada."
  missing:
    - "Reteste humano de minimizar, fechar e restaurar pelo ícone."
  debug_session: ".planning/debug/auth-session-persistence-ui.md"

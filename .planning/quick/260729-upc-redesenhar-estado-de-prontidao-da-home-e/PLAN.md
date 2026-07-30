# Quick Task: Redesenhar estado de prontidão da Home e implementar análise simulada funcional

## Objetivo

Substituir métricas genéricas de prontidão por estados qualitativos e verificáveis, e transformar “Analisar novamente” em um fluxo demonstrativo completo, visível, acessível e pronto para receber o adaptador real.

## Tarefas

- [x] Redesenhar o cartão de prontidão sem a pontuação artificial `92/100`.
- [x] Contextualizar as cinco recomendações como uma revisão pendente, sem tratá-las como nota de desempenho.
- [x] Implementar análise simulada com etapas, progresso, bloqueio contra clique duplo, conclusão e atualização das evidências.
- [x] Garantir textos completos em PT-BR e inglês, incluindo estados dinâmicos.
- [x] Cobrir o fluxo com testes de navegador e validar tema, responsividade, tipagem, lint e regressões.
- [x] Gerar e verificar um novo instalador NSIS.

## Critérios de conclusão

- O botão comunica imediatamente que a análise começou e permanece desabilitado durante o processo.
- O usuário vê as etapas e o progresso da análise, seguido de uma confirmação inequívoca.
- A Home não exibe uma nota numérica sem base real.
- O cartão mantém hierarquia, alinhamento e legibilidade nos tamanhos suportados.
- Nenhum texto novo fica parcialmente traduzido.
- As suítes existentes e os novos testes passam.

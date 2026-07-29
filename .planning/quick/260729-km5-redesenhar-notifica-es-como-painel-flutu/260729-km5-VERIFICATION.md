---
status: passed
quick_id: 260729-km5
verified_at: 2026-07-29
---

# Verificação

## Resultado

O objetivo da tarefa foi atingido no código e no navegador:

- painel de notificações abre como camada fixa e fecha por botão, clique externo e Escape;
- foco retorna ao acionador;
- dimensões do shell, rail e canvas permanecem idênticas antes e depois da abertura;
- shell, topo, sidebar, canvas e área principal mantêm a mesma geometria ao alternar todas as rotas em 1440, 1280 e 1024 px;
- conteúdo da gaveta está localizado em PT-BR;
- rotas de otimização exibem switches acessíveis, ícones e tooltips funcionais;
- alternar o switch atualiza o contador de seleção;
- detalhes e revisão do plano continuam navegáveis;
- operações excluídas apresentam switch desabilitado;
- nenhuma copy afirma que o Windows já foi modificado.

## Comandos aprovados

```text
pnpm --filter @liiiraa/design-system check
pnpm --filter @liiiraa/feature-shell check
pnpm --filter @liiiraa/desktop check
pnpm --filter @liiiraa/feature-shell test
pnpm --filter @liiiraa/desktop test
pnpm --filter @liiiraa/desktop test:e2e
```

## Limite conhecido

O instalador é válido para teste local, mas a aceitação empacotada permanece não promovida porque ainda faltam observações humanas em imagens limpas de Windows 10 e Windows 11 e uma assinatura pública. Isso não invalida os objetivos visuais e de interação desta tarefa.

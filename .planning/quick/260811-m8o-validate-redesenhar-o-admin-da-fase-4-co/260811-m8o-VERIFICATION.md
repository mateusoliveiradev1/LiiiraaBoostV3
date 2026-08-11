---
status: passed
quick_id: 260811-m8o
verified_at: 2026-08-11T16:20:00-03:00
reviewed_commit: 44eed222630c07e2f9d68a9440c4ae8502abded2
---

# Verification: Admin operacional e intencional

## Must-have truths

| Verdade | Resultado | Evidência |
| --- | --- | --- |
| A visão geral comunica prioridade antes do histórico | PASS | O domínio publicado renderizou `Prioridade agora`, contadores e uma ação principal antes do ledger. |
| A sessão protegida permanece clara sem repetição excessiva | PASS | O briefing integrou validade, postura e sincronização; o pill redundante da função foi removido da visão geral. |
| Estados operacionais possuem tratamento distinto | PASS | Estado derivado da projeção controla texto, ícone e borda para ativo, pendente, expirado e revogado. |
| O controle lateral explica sua função | PASS | `Usar barra lateral compacta` aparece no modo expandido e o rótulo continua acessível no compacto. |
| Não existe autoridade ou métrica inventada | PASS | Contadores usam `AdminProjectionRecord`; navegação usa a projeção autorizada da função. |

## Verificação publicada

- `Visão geral`: carregou com 71 sessões ativas, 16 mudanças de estado, postura atualizada e apenas 6 de 87 registros expostos na primeira dobra.
- `Pessoas`: carregou a governança real; membro exibido como `Ativo`, `Operações · Segurança`.
- `Segurança`: carregou a revisão de segurança, acesso emergencial e ledger autorizado sem estado de autoridade indisponível.
- O UAT encontrou enums crus no seletor de convite e `live` no cabeçalho; o commit `44eed22` corrigiu ambos preservando os valores contratuais.

## Gates automatizados

- Lint, TypeScript, 191 testes e build de produção passaram após a última correção.
- O deployment final `dpl_5iVA1sa89deSKDk54XgKmP8jep2m` ficou `READY` e promoveu o domínio customizado sem erro de alias.

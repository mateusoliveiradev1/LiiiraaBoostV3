---
quick: 260812-tmh
title: Finalizar convidado Windows do laboratório Hyper-V e criar checkpoint limpo
status: complete
created: 2026-08-13
---

# Objetivo

Preparar o Windows recém-instalado da VM sem exigir senha ou credenciais no chat, aplicar atualizações oficiais, registrar evidência local, remover a ISO do boot e criar o checkpoint limpo antes dos testes do Liiiraa Boost.

# Entregas

1. Bootstrap idempotente executado dentro do convidado com elevação local.
2. Ação administrativa que copia o bootstrap pelo canal de integração do Hyper-V.
3. Evidência local da preparação e orientação clara de reinicialização.
4. Ejeção da ISO e checkpoint `Clean-Windows-Ready`.

# Segurança

- Não usar Docker.
- Não armazenar senha nem exigir credenciais do convidado.
- Copiar somente arquivos explícitos para `C:\Users\Public\Desktop` da VM nomeada.
- Instalar somente atualizações admitidas pelo Windows Update.
- Não aplicar otimizações nem alterações de desempenho nesta base limpa.

# Verificação concluída

- Marcador `Liiiraa Boost Lab - PREPARADO.txt` confirmou que não existem atualizações de software pendentes.
- O convidado foi renomeado para `LIIIRAA-LAB`.
- Auditoria final confirmou VM em execução, ISO removida, Secure Boot e TPM ativos.
- O checkpoint `Clean-Windows-Ready` foi criado e confirmado no inventário do Hyper-V.

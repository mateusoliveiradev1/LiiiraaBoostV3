---
quick_id: 260813-lkv
status: ready
---

# Auditar arquivos de ambiente e commitar somente configurações seguras

## Task 1: Proteger os ambientes locais

- Normalizar os `.gitignore` dos apps web, account e admin.
- Manter `.env.local` ignorado e permitir apenas `.env.example` versionado.
- Criar modelos sem valores secretos que documentem as variáveis encontradas.

## Task 2: Validar e commitar

- Confirmar que nenhum `.env.local` ou valor sensível está staged.
- Comprovar que os exemplos não contêm tokens reais.
- Criar um commit atômico apenas com as regras, exemplos e artefatos desta quick task.

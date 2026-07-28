---
phase: 02-complete-desktop-experience
plan: "35"
completed: 2026-07-28
requirements: [UX-01, UX-02, UX-03, UX-10, UX-12]
---

# Plano 02-35 — tipografia e acabamento visual

## Resultado

- Manrope Variable e JetBrains Mono Variable foram incluídas no pacote do
  desktop com as respectivas licenças SIL Open Font License.
- Um teste de contrato agora falha se qualquer fonte ou licença desaparecer.
- O build do Vite copia as duas fontes para `dist/fonts` sem os avisos antigos
  de asset ausente.
- Shell, barra de objetivos, seleção ativa, título, botões, estados e inspetor
  receberam hierarquia, contraste e ritmo visual consistentes.
- O aviso de cenário continua verdadeiro, mas deixou de se repetir dentro do
  conteúdo e da barra de título.
- A Home foi recomposta em três regiões legíveis e os estados visíveis passaram
  a aceitar rótulos localizados em PT-BR.
- A calibração agora apresenta as sete etapas como progresso real, uma etapa
  focal, detalhes técnicos recolhidos e consentimentos opcionais separados.
- O handoff apresenta resumo e ação principal antes dos metadados técnicos.

## Revisão visual

Capturas inspecionadas em 1440 × 900:

- `visuals/02-35-handoff-1440.png`
- `visuals/02-35-calibration-1440.png`
- `visuals/02-35-home-1440.png`

Também foram verificados 960 px e 760 px sem rolagem horizontal. Em 760 px, a
navegação reduz para ícones e o progresso da calibração passa a uma faixa
compacta.

## Verificação

- `@liiiraa/design-tokens test`: 6 testes aprovados.
- `@liiiraa/design-system test`: 11 testes aprovados.
- `@liiiraa/feature-shell test`: 88 testes aprovados.
- Testes de startup, handoff e shell do desktop: 22 testes aprovados.
- Typecheck de design system, feature shell e desktop: aprovado.
- Build de produção do desktop: aprovado.
- Fontes presentes em `dist/fonts`: Manrope 24.836 bytes; JetBrains Mono
  40.404 bytes.

## Limites preservados

- Sem gradientes, glassmorphism, RGB, grids decorativos ou bibliotecas pagas.
- A identidade de desenvolvimento e a ausência de efeitos reais continuam
  explícitas.
- Nenhum instalador novo foi gerado nesta etapa.

---
quick_id: 260728-ndw
slug: unificar-todas-as-rotas-desktop-ao-conce
status: complete
date: 2026-07-28
---

# Unificar todas as rotas ao conceito dark aprovado

## Objetivo

Eliminar a ruptura visual entre a Visão Geral aprovada e as demais rotas do
desktop. O aplicativo inteiro deve parecer um único produto premium, técnico e
silencioso.

## Escopo

- Aplicar o shell dark aprovado a todas as rotas.
- Remover a faixa roxa de fixture e o inspetor persistente da composição
  principal, preservando a informação por disclosure discreto.
- Manter a mesma sidebar, título, largura de conteúdo, superfícies, ícones e
  controles ao navegar.
- Redesenhar as rotas principais de Otimização, Jogos, Desempenho e Recuperação
  usando o sistema visual aprovado.
- Corrigir textos técnicos crus, excesso de espaço vazio, botões genéricos,
  tabs sem hierarquia e painéis desalinhados.
- Preservar contratos de cenário simulado, segurança, teclado, i18n,
  responsividade e todas as rotas existentes.
- Redesenhar também a configuração inicial/onboarding com o mesmo acabamento,
  linguagem e controles do produto.
- Substituir símbolos improvisados por uma biblioteca gratuita de ícones e alinhar
  todos os ícones da navegação, métricas e ações.
- Unificar marca, ícone do Windows, instalador, desinstalador e atalhos em uma
  identidade própria.
- Entregar o instalador em português com artes próprias e uma etapa de aceite dos
  termos completos.

## Verificação

- Comparação visual das cinco rotas principais e do onboarding em 1440×900.
- Inspeção em 1280, 960 e 760.
- TypeScript e testes unitários dos pacotes afetados.
- Todas as rotas Playwright e axe.
- Rebuild e validação do executável empacotado.
- Inspeção do script NSIS gerado para licença, idioma, ícone e artes configuradas.

## Must haves

- A estrutura externa não muda ao trocar de rota.
- Nenhuma rota volta ao cabeçalho/barra/inspetor antigos.
- As telas são visualmente densas e intencionais, sem grandes vazios.
- Estados simulados permanecem claros sem dominar a interface.
- Nenhum botão ou chevron visual fica sem ação.

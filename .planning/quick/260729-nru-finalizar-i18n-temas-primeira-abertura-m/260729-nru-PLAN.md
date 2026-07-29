---
status: in_progress
quick_id: 260729-nru
date: 2026-07-29
description: Finalizar i18n, temas, primeira abertura, motion, feedback e polimento premium da Fase 2
---

# Plano

## Objetivo

Entregar a experiência visual da Fase 2 pronta para receber o motor real de
otimização, sem controles decorativos, traduções parciais ou fluxos que se
repetem indevidamente.

## Tarefas

### 1. Preferências reais e persistentes

- Adicionar temas Escuro, Claro e Sistema ao contrato de preferências.
- Fazer Sistema seguir o tema claro/escuro do Windows em tempo real.
- Aplicar e persistir movimento reduzido de verdade.
- Preservar migração segura das preferências existentes.

### 2. Internacionalização integral

- Localizar o shell e todas as rotas premium em PT-BR e inglês.
- Localizar títulos, descrições, filtros, ações, estados, tooltips, toasts e
  acessibilidade.
- Adicionar teste que rejeite regressões de idioma misturado.

### 3. Primeira abertura e verificação

- Exibir instalação/primeira abertura apenas quando realmente necessário.
- Persistir conclusão benignamente no dispositivo.
- Transformar Revisar verificação em um fluxo funcional e acessível.
- Explicar claramente a finalidade de cada etapa e permitir reabertura pelas
  configurações.

### 4. Polimento visual e feedback

- Refinar topo, ícones e hierarquia sem substituir as decorações nativas do
  Windows.
- Usar ícones reais de jogos, aplicativos, fabricantes e serviços; reservar
  Phosphor para ações e conceitos genéricos.
- Usar logotipos reais para NVIDIA, AMD, Intel, Microsoft e demais fabricantes
  reconhecidos nos cartões de hardware.
- Exibir imagem real do jogo com fallback local seguro.
- Criar uma tela de carregamento premium com progresso por etapas, falha,
  repetição e alternativa sem animação.
- Criar toasts premium com estados, fechamento e movimento reduzido.
- Criar progresso visual funcional para downloads simulados.
- Garantir feedback de carregamento, sucesso, pausa, cancelamento e falha.

### 5. Verificação e instalador

- Executar tipos, lint, unitários, Playwright e acessibilidade.
- Conferir tema claro/escuro/sistema e os dois idiomas.
- Atualizar capturas e reconstruir o instalador local gratuito.

## Critérios de aceite

- Alterar o idioma troca 100% do conteúdo visível da experiência premium.
- Escuro, Claro e Sistema funcionam, persistem e respeitam o Windows.
- Movimento reduzido elimina animações não essenciais e persiste.
- Telas iniciais aparecem uma única vez por instalação/versão relevante.
- Revisar verificação abre conteúdo real e navegável.
- Cartão do jogo usa arte real com fallback.
- Jogos e aplicativos conhecidos usam suas identidades visuais reais.
- O carregamento inicial possui uma tela finalizada e acessível.
- Toasts e downloads apresentam estados completos e acessíveis.
- Nenhum controle desta entrega permanece sem efeito observável.

## Incremento validado — jogo ativo e moldura nativa

- [x] Jogo ativo compartilhado entre Modo Competitivo e Home.
- [x] Seleção persistente após navegação e reinicialização.
- [x] Catálogo tipado com CS2, VALORANT, Fortnite e PUBG.
- [x] Capas reais locais e marcas oficiais, sem download em runtime.
- [x] Barra nativa cinza substituída por titlebar premium arrastável.
- [x] Minimizar, maximizar/restaurar e fechar conectados às APIs Tauri.
- [x] Contrato deny-by-default atualizado apenas com permissões de janela necessárias.
- [x] Regressões cobertas por testes unitários, navegador, acessibilidade, screenshots e Rust.

O quick task continua `in_progress`: a Fase 2 só será concluída após a aprovação visual
integral das demais superfícies pelo usuário.

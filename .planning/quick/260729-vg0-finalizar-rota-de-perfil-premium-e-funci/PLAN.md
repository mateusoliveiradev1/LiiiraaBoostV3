---
status: complete
validation: inline
---

# Quick Task: Finalizar rota de perfil premium e funcional da Fase 2

## Objetivo

Transformar `/account/overview` em uma experiência de perfil com aparência e comportamento de produto final, mantendo operações externas honestamente simuladas até a integração dos serviços reais.

## Escopo funcional

- [x] Persistir dados editáveis do perfil localmente e restaurá-los após recarregar o app.
- [x] Permitir editar nome de exibição, identificador do jogador e biografia curta.
- [x] Validar campos, impedir salvamento inválido e comunicar alterações não salvas.
- [x] Permitir escolher avatar visual, remover personalização e restaurar o padrão.
- [x] Expor preferências próprias do perfil com switches funcionais e persistidos.
- [x] Exibir estado da conta, plano, dispositivo e segurança com navegação conectada.
- [x] Permitir copiar o identificador da conta e exportar um pacote JSON local.
- [x] Implementar saída da conta e limpeza da prévia local com confirmação segura.

## Escopo visual e UX

- [x] Redesenhar a apresentação de identidade sem hero genérico ou métricas artificiais.
- [x] Criar hierarquia clara entre identidade, dados pessoais, preferências e conta.
- [x] Usar apenas componentes, ícones e tokens compatíveis com o design system atual.
- [x] Cobrir loading, success, error, disabled, focus, hover e reduced motion.
- [x] Garantir PT-BR, inglês, nomes longos, tema claro/escuro e redimensionamento.

## Verificação

- [x] TypeScript, ESLint e Prettier aprovados nos arquivos alterados.
- [x] Vitest do adaptador de perfil aprovado.
- [x] Playwright cobrindo edição, persistência, preferências, exportação, limpeza e inglês.
- [x] Inspeção visual em 1440×900, 960×700 e 760×600 nos temas escuro e claro.
- [x] Detector Impeccable sem findings materiais.
- [x] Instalador NSIS atualizado e hash SHA-256 registrado.

## Must-haves

- [x] Nenhum controle principal sem resposta observável.
- [x] Estado local honesto, sem fingir sincronização ou sessão de nuvem.
- [x] Identidade atualizada também no titlebar.
- [x] Sem rolagem horizontal nas larguras suportadas.
- [x] Pronto para validação final do usuário antes do encerramento formal da Fase 2.

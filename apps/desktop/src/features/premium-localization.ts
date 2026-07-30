import type { RefObject } from 'react';
import { useEffect } from 'react';
import type { ShellLocale } from '@liiiraa/feature-shell';

const ENGLISH_COPY: Readonly<Record<string, string>> = Object.freeze({
  'Acesso direto às configurações e ferramentas nativas do Windows.':
    'Direct access to native Windows settings and tools.',
  'Adicionar executável...': 'Add executable...',
  Adaptativo: 'Adaptive',
  Alta: 'High',
  Agora: 'Now',
  'Ajustes avançados de GPU, CPU, entrada, memória e armazenamento.':
    'Advanced GPU, CPU, input, memory, and storage controls.',
  'Ajustes de entrada': 'Input controls',
  'Ajustes próprios para latência, estabilidade e conectividade.':
    'Purpose-built latency, stability, and connectivity controls.',
  'Alterações críticas exigem confirmação, compatibilidade e caminho de restauração.':
    'Critical changes require confirmation, compatibility, and a recovery path.',
  'Alterações demonstrativas descartadas.': 'Demonstration changes discarded.',
  'Alterações reversíveis': 'Reversible changes',
  'Ambiente priorizado': 'Prioritized environment',
  'Analisar novamente': 'Analyze again',
  'Aplicativos recuperáveis': 'Recoverable applications',
  'Aplicação sem reiniciar': 'Apply without restarting',
  'Aplicação temporária': 'Temporary application',
  'Assinatura de desenvolvimento': 'Development signature',
  Atalhos: 'Shortcuts',
  Ativar: 'Enable',
  Baixar: 'Download',
  Cancelar: 'Cancel',
  Compatibilidade: 'Compatibility',
  Confortável: 'Comfortable',
  Concluído: 'Completed',
  Consumo: 'Power use',
  Controlado: 'Controlled',
  Configurações: 'Settings',
  'Preferências do aplicativo, privacidade, aparência e atualizações.':
    'Application preferences, privacy, appearance, and updates.',
  'Controles rápidos': 'Quick controls',
  'Controles rápidos do Windows organizados por objetivo.':
    'Quick Windows controls organized by goal.',
  'Demonstração segura': 'Safe demonstration',
  Desativar: 'Disable',
  Desinstalador: 'Uninstaller',
  Downloads: 'Downloads',
  'Ferramentas confiáveis, licenças claras e fontes oficiais.':
    'Trusted tools, clear licenses, and official sources.',
  'Em andamento': 'In progress',
  'Estado do computador, próxima ação e evidências em um só lugar.':
    'Computer status, next action, and evidence in one place.',
  'Eventos, alterações pendentes e ações recentes do aplicativo.':
    'Events, pending changes, and recent application actions.',
  'Fechar mensagem': 'Close message',
  'Fechar revisão': 'Close review',
  'Filtrar categoria': 'Filter category',
  'Foco no jogo': 'Game focus',
  Geral: 'General',
  'Hardware detectado no cenário': 'Hardware detected in this scenario',
  Histórico: 'History',
  Integridade: 'Integrity',
  Jogo: 'Game',
  'Jogo selecionado': 'Selected game',
  'Latência local': 'Local latency',
  Licenças: 'Licenses',
  Manual: 'Manual',
  Memória: 'Memory',
  'Metadados do ajuste': 'Adjustment metadata',
  'Modo Competitivo': 'Competitive Mode',
  'Prepare recursos, processos e serviços para uma sessão competitiva.':
    'Prepare resources, processes, and services for a competitive session.',
  'Nada foi aplicado ao Windows. Revise compatibilidade e recuperação primeiro.':
    'Nothing was applied to Windows. Review compatibility and recovery first.',
  'Nenhum ajuste encontrado': 'No controls found',
  'Nenhuma mudança aplicada ainda': 'No changes applied yet',
  'Nenhuma mudança de compatibilidade': 'No compatibility changes',
  'Nenhuma operação privilegiada será executada': 'No privileged operation will run',
  Notificações: 'Notifications',
  'O cenário está estável. Há cinco recomendações compatíveis aguardando sua revisão.':
    'The scenario is stable. Five compatible recommendations are waiting for review.',
  Ontem: 'Yesterday',
  'Pasta de downloads aberta no cenário demonstrativo.':
    'Downloads folder opened in the demonstration scenario.',
  'Pausar serviços não essenciais': 'Pause non-essential services',
  Perfil: 'Profile',
  'Perfil competitivo · prioridade alta · restauração automática':
    'Competitive profile · high priority · automatic recovery',
  'Placa de vídeo': 'Graphics card',
  'Planos de energia': 'Power plans',
  'Planos de energia compatíveis, explicados e reversíveis.':
    'Compatible, explained, and reversible power plans.',
  'Perfil validado para este cenário': 'Profile validated for this scenario',
  'Ponto de restauração disponível': 'Restore point available',
  Preparando: 'Preparing',
  'Preparar aplicação': 'Prepare application',
  'Próxima ação': 'Next action',
  Processador: 'Processor',
  Protegido: 'Protected',
  'Recuperação pronta': 'Recovery ready',
  Recomendado: 'Recommended',
  Rede: 'Network',
  Resposta: 'Response',
  'Resumo da prontidão': 'Readiness summary',
  'Latência, estabilidade e conectividade ajustadas ao hardware detectado.':
    'Latency, stability, and connectivity tuned for the detected hardware.',
  'Requer reinicialização': 'Restart required',
  Restaurar: 'Restore',
  Restauração: 'Recovery',
  'Revisar ajustes': 'Review controls',
  'Revisar desinstalação': 'Review uninstall',
  'Revisar plano': 'Review plan',
  'Revise antes de continuar': 'Review before continuing',
  'Revise inicialização, dependências e impacto dos serviços do Windows.':
    'Review startup, dependencies, and the impact of Windows services.',
  Risco: 'Risk',
  Segurança: 'Security',
  'Proteções compatíveis sem atalhos que enfraquecem o Windows.':
    'Compatible protections without shortcuts that weaken Windows.',
  Serviços: 'Services',
  'Serviços do Windows explicados antes de qualquer mudança.':
    'Windows services explained before any change.',
  'Sessão competitiva': 'Competitive session',
  'Sessão competitiva simulada iniciada.': 'Simulated competitive session started.',
  'Sessão encerrada e estado demonstrativo restaurado.':
    'Session ended and demonstration state restored.',
  'Seu PC está pronto para competir': 'Your PC is ready to compete',
  Sistema: 'System',
  Sobre: 'About',
  'Versão, integridade, termos, licenças e canais oficiais.':
    'Version, integrity, terms, licenses, and official channels.',
  Suporte: 'Support',
  'Telemetria local': 'Local telemetry',
  'Tente outro termo ou remova o filtro atual.': 'Try another term or remove the current filter.',
  'Termos de uso': 'Terms of use',
  Todos: 'All',
  Tweaks: 'Tweaks',
  'Ver detalhes': 'View details',
  'Verificar atualizações': 'Check for updates',
  'Versão do WebView2': 'WebView2 version',
  'Visão geral': 'Overview',
  'Voltar aos ajustes': 'Back to controls',
  'Você já está na versão mais recente do cenário.':
    'You already have the latest scenario version.',
  'Última sessão': 'Last session',
  Elevado: 'High',
  'Evidências de prontidão': 'Readiness evidence',
  Exigente: 'Demanding',
  'Hardware compatível': 'Compatible hardware',
  Imediata: 'Immediate',
  Máxima: 'Maximum',
  Máximo: 'Maximum',
  Moderado: 'Moderate',
  Padrão: 'Standard',
  Quente: 'Hot',
  Sustentada: 'Sustained',
  Térmico: 'Thermal',
  'Atualizado agora': 'Updated now',
  'Revise os ajustes compatíveis antes de iniciar sua próxima sessão.':
    'Review compatible controls before starting your next session.',
  '5 recomendações': '5 recommendations',
  'Verificação local': 'Local verification',
  '5 ajustes para revisar': '5 controls to review',
  ativos: 'active',
  concluído: 'completed',
  'exigem reinício': 'require restart',
  'fonte oficial': 'official source',
  'itens preparados': 'items prepared',
  ocioso: 'idle',
  preparando: 'preparing',
  recomendações: 'recommendations',
});

const ORIGINAL_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTRIBUTES = new WeakMap<Element, Readonly<Record<string, string>>>();
const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const;
const EXPLICIT_LOCALIZATION_SELECTOR = '[data-premium-localized]';

const hasExplicitLocalization = (node: Node): boolean => {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(EXPLICIT_LOCALIZATION_SELECTOR) !== null;
};

const translatePatterns = (source: string): string => {
  let translated = ENGLISH_COPY[source] ?? source;
  translated = translated
    .replace(/^(\d+) alterações aguardam revisão$/u, '$1 changes awaiting review')
    .replace(/^(\d+) alterações preparadas$/u, '$1 changes prepared')
    .replace(/^(\d+) alteração preparada$/u, '$1 change prepared')
    .replace(/^(\d+) ações selecionadas/u, '$1 selected actions')
    .replace(/nenhum risco crítico detectado/gu, 'no critical risk detected')
    .replace(/Nenhuma alteração real nesta fase/gu, 'No real system change in this phase')
    .replace(/nenhuma alteração real nesta fase/gu, 'no real system change in this phase')
    .replace(/restauração disponível/gu, 'recovery available')
    .replace(/fonte oficial/gu, 'official source')
    .replace(/fluxo demonstrativo concluído/gu, 'demonstration flow completed')
    .replace(/Plano demonstrativo/gu, 'Demonstration plan')
    .replace(/Nenhuma mudança real foi aplicada/gu, 'No real change was applied');
  return translated;
};

const localizeTextNode = (node: Text, locale: ShellLocale): void => {
  if (hasExplicitLocalization(node)) return;
  const source = ORIGINAL_TEXT.get(node) ?? node.nodeValue ?? '';
  ORIGINAL_TEXT.set(node, source);
  if (source.trim().length === 0) return;
  const leading = /^\s*/u.exec(source)?.[0] ?? '';
  const trailing = /\s*$/u.exec(source)?.[0] ?? '';
  const core = source.trim();
  node.nodeValue = `${leading}${locale === 'pt-BR' ? core : translatePatterns(core)}${trailing}`;
};

const localizeElementAttributes = (element: Element, locale: ShellLocale): void => {
  if (hasExplicitLocalization(element)) return;
  const existing = ORIGINAL_ATTRIBUTES.get(element);
  const originals: Record<string, string> = { ...(existing ?? {}) };
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    originals[attribute] ??= current;
    element.setAttribute(
      attribute,
      locale === 'pt-BR' ? originals[attribute] : translatePatterns(originals[attribute]),
    );
  }
  ORIGINAL_ATTRIBUTES.set(element, Object.freeze(originals));
};

const localizeTree = (root: HTMLElement, locale: ShellLocale): void => {
  if (root.matches(EXPLICIT_LOCALIZATION_SELECTOR)) return;
  localizeElementAttributes(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node !== null) {
    if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node as Text, locale);
    else if (node instanceof Element) localizeElementAttributes(node, locale);
    node = walker.nextNode();
  }
};

export const usePremiumLocalization = (
  rootRef: RefObject<HTMLElement | null>,
  locale: ShellLocale,
): void => {
  useEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof MutationObserver === 'undefined') return undefined;
    localizeTree(root, locale);
    const observe = (observer: MutationObserver): void => {
      observer.observe(root, { characterData: true, childList: true, subtree: true });
    };
    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
            ORIGINAL_TEXT.set(mutation.target as Text, mutation.target.nodeValue ?? '');
            localizeTextNode(mutation.target as Text, locale);
          }
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.TEXT_NODE) localizeTextNode(addedNode as Text, locale);
            else if (addedNode instanceof HTMLElement) localizeTree(addedNode, locale);
          }
        }
      } finally {
        observe(observer);
      }
    });
    observe(observer);
    return () => {
      observer.disconnect();
    };
  }, [locale, rootRef]);
};

export const translatePremiumText = translatePatterns;

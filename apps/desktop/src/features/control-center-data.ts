import type { ProductIconName } from '@liiiraa/design-system';

export type PremiumRouteId =
  | 'about'
  | 'activity'
  | 'competitive'
  | 'downloads'
  | 'home'
  | 'network'
  | 'power'
  | 'restoration'
  | 'security'
  | 'services'
  | 'settings'
  | 'shortcuts'
  | 'toggles'
  | 'tweaks'
  | 'uninstaller';

export type CatalogRouteId = Extract<PremiumRouteId, 'network' | 'security' | 'toggles' | 'tweaks'>;

export interface OperationItem {
  readonly active: boolean;
  readonly category: string;
  readonly description: string;
  readonly icon: ProductIconName;
  readonly id: string;
  readonly recommended?: boolean;
  readonly restart?: boolean;
  readonly risk: 'baixo' | 'moderado' | 'alto';
  readonly title: string;
}

export interface ShortcutItem {
  readonly category:
    'Configurações do Windows' | 'Ferramentas administrativas' | 'Sistema e arquivos';
  readonly description: string;
  readonly icon: ProductIconName;
  readonly id: string;
  readonly title: string;
}

export interface PowerPlanItem {
  readonly consumption: string;
  readonly description: string;
  readonly icon: ProductIconName;
  readonly id: string;
  readonly impact: string;
  readonly recommended?: boolean;
  readonly response: string;
  readonly thermal: string;
  readonly title: string;
}

export interface ServiceItem {
  readonly category: string;
  readonly description: string;
  readonly id: string;
  readonly recommended: 'Automático' | 'Automático (atraso)' | 'Desativado' | 'Manual';
  readonly title: string;
}

export interface DownloadItem {
  readonly category: string;
  readonly description: string;
  readonly icon: ProductIconName;
  readonly id: string;
  readonly license: string;
  readonly title: string;
}

export interface InstalledAppItem {
  readonly category: 'Aplicativo' | 'Componente' | 'Ferramenta' | 'Jogo';
  readonly id: string;
  readonly publisher: string;
  readonly protected?: boolean;
  readonly size: string;
  readonly title: string;
}

const operations = (items: readonly OperationItem[]): readonly OperationItem[] =>
  Object.freeze(items.map((item) => Object.freeze(item)));

export const OPERATION_CATALOGS: Readonly<Record<CatalogRouteId, readonly OperationItem[]>> =
  Object.freeze({
    toggles: operations([
      {
        active: true,
        category: 'Sistema',
        description: 'Mantém o Modo Jogo do Windows preparado quando um jogo compatível inicia.',
        icon: 'game',
        id: 'windows-game-mode',
        recommended: true,
        risk: 'baixo',
        title: 'Modo Jogo do Windows',
      },
      {
        active: false,
        category: 'Dispositivos',
        description: 'Desativa a suspensão seletiva de USB para periféricos de baixa latência.',
        icon: 'usb',
        id: 'usb-selective-suspend',
        recommended: true,
        restart: true,
        risk: 'moderado',
        title: 'Suspensão seletiva USB',
      },
      {
        active: true,
        category: 'Aparência',
        description:
          'Reduz animações do Windows preservando transições essenciais de acessibilidade.',
        icon: 'monitor',
        id: 'visual-effects',
        risk: 'baixo',
        title: 'Efeitos visuais equilibrados',
      },
      {
        active: false,
        category: 'Sistema',
        description:
          'Evita que a indexação rode durante uma sessão competitiva, sem desativá-la globalmente.',
        icon: 'search',
        id: 'pause-indexing',
        recommended: true,
        risk: 'baixo',
        title: 'Pausar indexação durante jogos',
      },
      {
        active: true,
        category: 'Privacidade',
        description: 'Limita sugestões e conteúdo promocional no menu Iniciar.',
        icon: 'shield',
        id: 'suggested-content',
        risk: 'baixo',
        title: 'Conteúdo sugerido',
      },
      {
        active: false,
        category: 'Aparência',
        description: 'Restaura o menu de contexto completo do Windows 11.',
        icon: 'list',
        id: 'classic-context-menu',
        restart: true,
        risk: 'baixo',
        title: 'Menu de contexto clássico',
      },
      {
        active: true,
        category: 'Dispositivos',
        description: 'Mantém Bluetooth disponível para controles, headsets e acessórios.',
        icon: 'plugs',
        id: 'bluetooth',
        risk: 'baixo',
        title: 'Bluetooth',
      },
      {
        active: false,
        category: 'Sistema',
        description: 'Evita reinicializações automáticas durante o horário configurado para jogar.',
        icon: 'windows',
        id: 'active-hours',
        recommended: true,
        risk: 'baixo',
        title: 'Horário ativo inteligente',
      },
    ]),
    network: operations([
      {
        active: true,
        category: 'Latência',
        description: 'Reduz o agrupamento de pequenos pacotes TCP em conexões compatíveis.',
        icon: 'arrowsMerge',
        id: 'nagle',
        recommended: true,
        risk: 'moderado',
        title: 'Algoritmo de Nagle',
      },
      {
        active: true,
        category: 'Latência',
        description:
          'Ajusta a moderação de interrupções da placa de rede conforme o hardware detectado.',
        icon: 'activity',
        id: 'interrupt-moderation',
        recommended: true,
        risk: 'moderado',
        title: 'Moderação de interrupções',
      },
      {
        active: false,
        category: 'Energia',
        description: 'Impede que o adaptador Ethernet entre em estados agressivos de economia.',
        icon: 'leaf',
        id: 'energy-efficient-ethernet',
        restart: true,
        risk: 'baixo',
        title: 'Ethernet eficiente em energia',
      },
      {
        active: false,
        category: 'Largura de banda',
        description: 'Controla o envio de atualizações do Windows para outros computadores.',
        icon: 'shareNetwork',
        id: 'delivery-optimization',
        risk: 'baixo',
        title: 'Distribuição P2P de atualizações',
      },
      {
        active: true,
        category: 'Latência',
        description: 'Configura a frequência de ACK somente para adaptadores e jogos compatíveis.',
        icon: 'timer',
        id: 'tcp-ack-frequency',
        recommended: true,
        restart: true,
        risk: 'moderado',
        title: 'Frequência de confirmação TCP',
      },
      {
        active: false,
        category: 'Compatibilidade',
        description:
          'Mantém NetBIOS disponível apenas quando redes legadas realmente precisam dele.',
        icon: 'broadcast',
        id: 'netbios',
        risk: 'moderado',
        title: 'NetBIOS sobre TCP/IP',
      },
      {
        active: true,
        category: 'Estabilidade',
        description:
          'Preserva a descarga de segmentação quando ela melhora vazão sem elevar frametime.',
        icon: 'flow',
        id: 'large-send-offload',
        risk: 'moderado',
        title: 'Large Send Offload',
      },
      {
        active: true,
        category: 'DNS',
        description:
          'Seleciona o resolvedor com menor resposta estável, sem prometer reduzir o ping do jogo.',
        icon: 'globe',
        id: 'dns-profile',
        recommended: true,
        risk: 'baixo',
        title: 'Perfil DNS medido',
      },
    ]),
    tweaks: operations([
      {
        active: true,
        category: 'GPU e exibição',
        description:
          'Permite agendamento de GPU por hardware quando driver e jogos são compatíveis.',
        icon: 'graphics',
        id: 'hags',
        recommended: true,
        restart: true,
        risk: 'moderado',
        title: 'Agendamento de GPU por hardware',
      },
      {
        active: false,
        category: 'GPU e exibição',
        description: 'Ativa taxa de atualização variável para jogos em janela compatíveis.',
        icon: 'monitor',
        id: 'vrr',
        risk: 'baixo',
        title: 'Taxa de atualização variável',
      },
      {
        active: true,
        category: 'GPU e exibição',
        description:
          'Equilibra otimizações de tela inteira conforme o modo de apresentação do jogo.',
        icon: 'game',
        id: 'fullscreen-optimizations',
        risk: 'moderado',
        title: 'Otimizações de tela inteira',
      },
      {
        active: true,
        category: 'CPU e agendamento',
        description: 'Prioriza o aplicativo em primeiro plano sem sufocar tarefas essenciais.',
        icon: 'cpu',
        id: 'foreground-boost',
        recommended: true,
        risk: 'moderado',
        title: 'Prioridade do primeiro plano',
      },
      {
        active: false,
        category: 'CPU e agendamento',
        description:
          'Evita alterar a resolução global do temporizador sem uma sessão que a justifique.',
        icon: 'timer',
        id: 'timer-resolution',
        risk: 'alto',
        title: 'Resolução global do temporizador',
      },
      {
        active: true,
        category: 'Memória e sistema',
        description: 'Mantém partes críticas do kernel residentes quando há memória suficiente.',
        icon: 'memory',
        id: 'kernel-paging',
        restart: true,
        risk: 'moderado',
        title: 'Paginação do kernel',
      },
      {
        active: false,
        category: 'Entrada',
        description:
          'Remove a aceleração do ponteiro para movimento consistente em jogos competitivos.',
        icon: 'competitive',
        id: 'mouse-acceleration',
        recommended: true,
        risk: 'baixo',
        title: 'Aceleração do mouse',
      },
      {
        active: true,
        category: 'Entrada',
        description: 'Evita o atalho de Teclas de Aderência durante partidas.',
        icon: 'key',
        id: 'sticky-keys',
        risk: 'baixo',
        title: 'Atalho das Teclas de Aderência',
      },
      {
        active: false,
        category: 'Interface',
        description: 'Abre o Explorador diretamente em Este Computador.',
        icon: 'hardDrive',
        id: 'explorer-this-pc',
        risk: 'baixo',
        title: 'Página inicial do Explorador',
      },
      {
        active: true,
        category: 'Armazenamento',
        description:
          'Evita atualização de último acesso em arquivos para reduzir escrita desnecessária.',
        icon: 'hardDrive',
        id: 'ntfs-last-access',
        risk: 'baixo',
        title: 'Último acesso do NTFS',
      },
      {
        active: false,
        category: 'Memória e sistema',
        description: 'Mantém a compactação de memória quando ela evita paginação mais cara.',
        icon: 'memory',
        id: 'memory-compression',
        risk: 'moderado',
        title: 'Compactação de memória',
      },
      {
        active: true,
        category: 'Memória e sistema',
        description: 'Adapta o SysMain ao tipo de armazenamento e à quantidade de memória.',
        icon: 'database',
        id: 'sysmain',
        risk: 'moderado',
        title: 'SysMain adaptativo',
      },
    ]),
    security: operations([
      {
        active: true,
        category: 'Proteção do kernel',
        description: 'Bloqueia drivers conhecidos como vulneráveis ou maliciosos.',
        icon: 'shield',
        id: 'driver-blocklist',
        recommended: true,
        risk: 'alto',
        title: 'Lista de bloqueio de drivers',
      },
      {
        active: true,
        category: 'Proteção do kernel',
        description: 'Mantém integridade de memória quando drivers e anti-cheats são compatíveis.',
        icon: 'lock',
        id: 'core-isolation',
        recommended: true,
        restart: true,
        risk: 'alto',
        title: 'Isolamento de núcleo',
      },
      {
        active: true,
        category: 'Conta',
        description: 'Confirma ações administrativas antes de elevar privilégios.',
        icon: 'profile',
        id: 'uac',
        recommended: true,
        risk: 'alto',
        title: 'Controle de Conta de Usuário',
      },
      {
        active: true,
        category: 'Reputação',
        description: 'Verifica reputação de aplicativos e downloads desconhecidos.',
        icon: 'check',
        id: 'smartscreen',
        recommended: true,
        risk: 'alto',
        title: 'Microsoft SmartScreen',
      },
      {
        active: true,
        category: 'Exploração',
        description: 'Preserva mitigações de CPU contra classes conhecidas de ataques.',
        icon: 'microchip',
        id: 'cpu-mitigations',
        recommended: true,
        restart: true,
        risk: 'alto',
        title: 'Mitigações da CPU',
      },
      {
        active: false,
        category: 'Virtualização',
        description: 'Mostra o impacto e a compatibilidade da segurança baseada em virtualização.',
        icon: 'windows',
        id: 'vbs',
        restart: true,
        risk: 'alto',
        title: 'Segurança baseada em virtualização',
      },
      {
        active: true,
        category: 'Exploração',
        description: 'Valida alvos indiretos de execução com impacto geralmente pequeno.',
        icon: 'code',
        id: 'control-flow-guard',
        recommended: true,
        risk: 'alto',
        title: 'Control Flow Guard',
      },
    ]),
  });

export const SHORTCUTS: readonly ShortcutItem[] = Object.freeze([
  {
    category: 'Configurações do Windows',
    description: 'Resolução, escala, HDR e taxa de atualização.',
    icon: 'monitor',
    id: 'display',
    title: 'Exibição',
  },
  {
    category: 'Configurações do Windows',
    description: 'Saída, entrada e mixer de volume.',
    icon: 'sliders',
    id: 'sound',
    title: 'Som',
  },
  {
    category: 'Configurações do Windows',
    description: 'Ethernet, Wi‑Fi, VPN e proxy.',
    icon: 'network',
    id: 'windows-network',
    title: 'Rede e Internet',
  },
  {
    category: 'Configurações do Windows',
    description: 'Preferências de GPU por aplicativo.',
    icon: 'graphics',
    id: 'graphics-settings',
    title: 'Configurações gráficas',
  },
  {
    category: 'Ferramentas administrativas',
    description: 'Hardware, dispositivos e drivers.',
    icon: 'device',
    id: 'device-manager',
    title: 'Gerenciador de Dispositivos',
  },
  {
    category: 'Ferramentas administrativas',
    description: 'Partições, volumes e letras de unidade.',
    icon: 'hardDrive',
    id: 'disk-manager',
    title: 'Gerenciamento de Disco',
  },
  {
    category: 'Ferramentas administrativas',
    description: 'Logs do sistema e dos aplicativos.',
    icon: 'activity',
    id: 'event-viewer',
    title: 'Visualizador de Eventos',
  },
  {
    category: 'Ferramentas administrativas',
    description: 'CPU, memória, disco e rede em tempo real.',
    icon: 'chart',
    id: 'resource-monitor',
    title: 'Monitor de Recursos',
  },
  {
    category: 'Sistema e arquivos',
    description: 'Acesso direto às configurações avançadas do sistema.',
    icon: 'settings',
    id: 'advanced-system',
    title: 'Sistema avançado',
  },
  {
    category: 'Sistema e arquivos',
    description: 'Diagnóstico de DirectX, áudio e GPU.',
    icon: 'game',
    id: 'dxdiag',
    title: 'Diagnóstico do DirectX',
  },
  {
    category: 'Sistema e arquivos',
    description: 'Acesso ao Registro do Windows.',
    icon: 'database',
    id: 'registry',
    title: 'Editor do Registro',
  },
  {
    category: 'Sistema e arquivos',
    description: 'Aplicativos iniciados com a conta atual.',
    icon: 'rocket',
    id: 'startup-folder',
    title: 'Pasta de inicialização',
  },
]);

export const POWER_PLANS: readonly PowerPlanItem[] = Object.freeze([
  {
    consumption: 'Elevado',
    description: 'Recomendado para jogos competitivos em desktops com refrigeração adequada.',
    icon: 'crosshair',
    id: 'liiiraa-competitive',
    impact: 'Desempenho máximo · consumo alto',
    recommended: true,
    response: 'Imediata',
    thermal: 'Exigente',
    title: 'Liiiraa Competitivo',
  },
  {
    consumption: 'Adaptativo',
    description: 'Mantém resposta alta com menor calor fora de partidas.',
    icon: 'gauge',
    id: 'liiiraa-adaptive',
    impact: 'Desempenho alto · consumo equilibrado',
    response: 'Alta',
    thermal: 'Controlado',
    title: 'Liiiraa Adaptativo',
  },
  {
    consumption: 'Moderado',
    description: 'Plano padrão do Windows para uso geral.',
    icon: 'scales',
    id: 'balanced',
    impact: 'Equilibrado',
    response: 'Padrão',
    thermal: 'Confortável',
    title: 'Equilibrado',
  },
  {
    consumption: 'Elevado',
    description: 'Plano nativo voltado a cargas contínuas.',
    icon: 'speedometer',
    id: 'high-performance',
    impact: 'Desempenho alto · consumo alto',
    response: 'Sustentada',
    thermal: 'Quente',
    title: 'Alto desempenho',
  },
  {
    consumption: 'Máximo',
    description: 'Plano de estação de trabalho disponível em versões compatíveis do Windows.',
    icon: 'fire',
    id: 'ultimate-performance',
    impact: 'Desempenho máximo · calor elevado',
    response: 'Máxima',
    thermal: 'Elevado',
    title: 'Desempenho máximo',
  },
]);

export const SERVICES: readonly ServiceItem[] = Object.freeze([
  {
    category: 'Telemetria e diagnóstico',
    description: 'Coleta diagnóstico e uso para o Windows.',
    id: 'diagtrack',
    recommended: 'Manual',
    title: 'Experiências Conectadas e Telemetria',
  },
  {
    category: 'Telemetria e diagnóstico',
    description: 'Gera relatórios quando aplicativos falham.',
    id: 'wersvc',
    recommended: 'Manual',
    title: 'Relatório de Erros do Windows',
  },
  {
    category: 'Xbox e jogos',
    description: 'Autenticação para jogos e serviços Xbox.',
    id: 'xblauth',
    recommended: 'Manual',
    title: 'Xbox Live Auth Manager',
  },
  {
    category: 'Xbox e jogos',
    description: 'Sincronização de saves do Xbox com a nuvem.',
    id: 'xblgamesave',
    recommended: 'Manual',
    title: 'Xbox Live Game Save',
  },
  {
    category: 'Conectividade',
    description: 'Permite acesso remoto ao Registro; normalmente desnecessário em PCs pessoais.',
    id: 'remote-registry',
    recommended: 'Desativado',
    title: 'Registro Remoto',
  },
  {
    category: 'Conectividade',
    description: 'Compatibilidade com redes NetBIOS legadas.',
    id: 'lmhosts',
    recommended: 'Manual',
    title: 'Auxiliar NetBIOS sobre TCP/IP',
  },
  {
    category: 'Sistema e manutenção',
    description: 'Entrega notificações do Windows e blocos dinâmicos.',
    id: 'wpnservice',
    recommended: 'Automático',
    title: 'Notificações por Push do Windows',
  },
  {
    category: 'Sistema e manutenção',
    description: 'Suporte à criptografia de arquivos EFS.',
    id: 'efs',
    recommended: 'Manual',
    title: 'Sistema de Arquivos com Criptografia',
  },
  {
    category: 'Atualizações',
    description: 'Mantém o navegador e o WebView2 atualizados.',
    id: 'edge-update',
    recommended: 'Automático (atraso)',
    title: 'Microsoft Edge Update',
  },
  {
    category: 'Atualizações',
    description: 'Atualiza componentes WebView usados pelo aplicativo.',
    id: 'webview-update',
    recommended: 'Automático (atraso)',
    title: 'WebView2 Runtime Update',
  },
]);

export const DOWNLOADS: readonly DownloadItem[] = Object.freeze([
  {
    category: 'Navegadores',
    description: 'Navegador Chromium com bloqueio de anúncios e rastreadores.',
    icon: 'browser',
    id: 'brave',
    license: 'Gratuito',
    title: 'Brave',
  },
  {
    category: 'Navegadores',
    description: 'Navegador independente baseado em Gecko.',
    icon: 'browser',
    id: 'firefox',
    license: 'Código aberto',
    title: 'Firefox',
  },
  {
    category: 'Drivers',
    description: 'Aplicativo oficial para drivers GeForce.',
    icon: 'graphics',
    id: 'nvidia-app',
    license: 'Gratuito',
    title: 'NVIDIA App',
  },
  {
    category: 'Drivers',
    description: 'Pacote oficial AMD Software: Adrenalin Edition.',
    icon: 'graphics',
    id: 'amd-adrenalin',
    license: 'Gratuito',
    title: 'AMD Software',
  },
  {
    category: 'Monitoramento',
    description: 'Sensores detalhados e registro de hardware.',
    icon: 'activity',
    id: 'hwinfo',
    license: 'Gratuito para uso pessoal',
    title: 'HWiNFO',
  },
  {
    category: 'Monitoramento',
    description: 'Informações de CPU, placa-mãe e memória.',
    icon: 'cpu',
    id: 'cpu-z',
    license: 'Gratuito',
    title: 'CPU-Z',
  },
  {
    category: 'Benchmark',
    description: 'Captura e análise de frametime.',
    icon: 'chart',
    id: 'capframex',
    license: 'Código aberto',
    title: 'CapFrameX',
  },
  {
    category: 'Benchmark',
    description: 'Analisa latência DPC e drivers.',
    icon: 'timer',
    id: 'latencymon',
    license: 'Gratuito',
    title: 'LatencyMon',
  },
  {
    category: 'Streaming',
    description: 'Gravação local e transmissão ao vivo.',
    icon: 'monitor',
    id: 'obs',
    license: 'Código aberto',
    title: 'OBS Studio',
  },
  {
    category: 'Jogos',
    description: 'Loja e inicializador de jogos da Valve.',
    icon: 'game',
    id: 'steam',
    license: 'Gratuito',
    title: 'Steam',
  },
  {
    category: 'Utilitários',
    description: 'Compactador leve e de código aberto.',
    icon: 'package',
    id: '7zip',
    license: 'Código aberto',
    title: '7-Zip',
  },
  {
    category: 'Periféricos',
    description: 'Controle unificado de iluminação e dispositivos compatíveis.',
    icon: 'plugs',
    id: 'openrgb',
    license: 'Código aberto',
    title: 'OpenRGB',
  },
]);

export const INSTALLED_APPS: readonly InstalledAppItem[] = Object.freeze([
  {
    category: 'Componente',
    id: 'amd-chipset',
    protected: true,
    publisher: 'Advanced Micro Devices',
    size: '512 MB',
    title: 'AMD Chipset Software',
  },
  {
    category: 'Ferramenta',
    id: 'android-studio',
    publisher: 'Google LLC',
    size: '3,2 GB',
    title: 'Android Studio',
  },
  {
    category: 'Aplicativo',
    id: 'brave-installed',
    publisher: 'Brave Software',
    size: '620 MB',
    title: 'Brave',
  },
  {
    category: 'Aplicativo',
    id: 'discord',
    publisher: 'Discord Inc.',
    size: '884 MB',
    title: 'Discord',
  },
  {
    category: 'Jogo',
    id: 'counter-strike-2',
    publisher: 'Valve',
    size: '37,8 GB',
    title: 'Counter-Strike 2',
  },
  {
    category: 'Ferramenta',
    id: 'docker-desktop',
    publisher: 'Docker Inc.',
    size: '2,7 GB',
    title: 'Docker Desktop',
  },
  {
    category: 'Aplicativo',
    id: 'chatgpt',
    publisher: 'OpenAI',
    size: '384 MB',
    title: 'ChatGPT',
  },
  {
    category: 'Componente',
    id: 'webview2',
    protected: true,
    publisher: 'Microsoft Corporation',
    size: '720 MB',
    title: 'Microsoft Edge WebView2 Runtime',
  },
]);

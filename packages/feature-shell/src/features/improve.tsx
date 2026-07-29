import {
  CapabilityReason,
  ChangeLedger,
  LbButton,
  LbRadioGroup,
  OperationInspector,
  OperationRow,
  PlanDependencyList,
  ProductIcon,
  ProvenanceMark,
  QualityMark,
  RestartPlanner,
  RiskClass,
  RiskGate,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  VerificationReceipt,
  type CapabilityState,
  type EvidenceQuality,
  type ProductIconName,
  type RiskLevel,
} from '@liiiraa/design-system';
import type {
  DesktopScenarioId,
  PhaseBoundaryExplanation,
  RecommendationState,
} from '@liiiraa/desktop-client';

import type { ShellLocale } from './calibration.js';

export const IMPROVE_VIEWS = Object.freeze([
  'goals',
  'component',
  'operation',
  'plan-review',
  'confirmation',
  'restart',
  'recovery-history',
  'no-change-receipt',
] as const);

export type ImproveView = (typeof IMPROVE_VIEWS)[number];

export const IMPROVE_GOALS = Object.freeze([
  'performance',
  'latency',
  'stability',
  'privacy',
] as const);

export type ImproveGoal = (typeof IMPROVE_GOALS)[number];

export const IMPROVE_RISK_POLICIES = Object.freeze([
  'verified',
  'advanced',
  'experimental',
  'extreme',
] as const);

export const IMPROVE_COMPONENTS = Object.freeze([
  'windows',
  'cpu-power',
  'gpu',
  'memory',
  'storage',
  'thermals',
  'network',
  'audio',
  'input-usb',
  'display',
  'security-privacy',
] as const);

export type ImproveComponent = (typeof IMPROVE_COMPONENTS)[number];

type OperationEligibility = RecommendationState['eligibility'];
type OperationRisk = RecommendationState['risk'];

export interface TechnicalOperation {
  readonly compatibility: LocalizedCopy;
  readonly component: ImproveComponent;
  readonly dependencies: readonly LocalizedCopy[];
  readonly eligibility: OperationEligibility;
  readonly evidence: LocalizedCopy;
  readonly evidenceQuality: EvidenceQuality;
  readonly exclusionReason?: LocalizedCopy;
  readonly expectedDirection: LocalizedCopy;
  readonly id: string;
  readonly name: LocalizedCopy;
  readonly previousValue: LocalizedCopy;
  readonly provenance: 'fixture';
  readonly purpose: LocalizedCopy;
  readonly recoveryMethod: LocalizedCopy;
  readonly restartEffect: LocalizedCopy;
  readonly riskClass: OperationRisk;
}

export interface ImproveSurfaceProps {
  readonly locale: ShellLocale;
  readonly onNavigate?: (view: ImproveView, targetId?: string) => void;
  readonly onRiskPolicyChange?: (risk: OperationRisk) => void;
  readonly scenarioId: string;
  readonly selectedComponent?: ImproveComponent;
  readonly selectedGoal?: ImproveGoal;
  readonly selectedOperationId?: string;
  readonly view: ImproveView;
}

interface LocalizedCopy {
  readonly en: string;
  readonly 'pt-BR': string;
}

const localized = (copy: LocalizedCopy, locale: ShellLocale) => copy[locale];

const GOAL_COPY: Readonly<
  Record<ImproveGoal, Readonly<{ detail: LocalizedCopy; label: LocalizedCopy }>>
> = {
  performance: {
    label: { en: 'Performance', 'pt-BR': 'Desempenho' },
    detail: {
      en: 'Review evidence-bound opportunities that may reduce avoidable work.',
      'pt-BR': 'Revise oportunidades baseadas em evidência que podem reduzir trabalho evitável.',
    },
  },
  latency: {
    label: { en: 'Latency', 'pt-BR': 'Latência' },
    detail: {
      en: 'Inspect timing paths without promising zero latency.',
      'pt-BR': 'Inspecione caminhos de tempo sem prometer latência zero.',
    },
  },
  stability: {
    label: { en: 'Stability', 'pt-BR': 'Estabilidade' },
    detail: {
      en: 'Prefer repeatability, thermal margin, and verified recovery.',
      'pt-BR': 'Priorize repetibilidade, margem térmica e recuperação verificada.',
    },
  },
  privacy: {
    label: { en: 'Privacy', 'pt-BR': 'Privacidade' },
    detail: {
      en: 'Review local data behavior and explicit connected consent.',
      'pt-BR': 'Revise dados locais e consentimento explícito para recursos conectados.',
    },
  },
};

const COMPONENT_COPY: Readonly<
  Record<ImproveComponent, Readonly<{ label: LocalizedCopy; relevance: readonly ImproveGoal[] }>>
> = {
  windows: {
    label: { en: 'Windows', 'pt-BR': 'Windows' },
    relevance: ['performance', 'latency', 'stability', 'privacy'],
  },
  'cpu-power': {
    label: { en: 'CPU and power', 'pt-BR': 'CPU e energia' },
    relevance: ['performance', 'latency', 'stability'],
  },
  gpu: {
    label: { en: 'GPU', 'pt-BR': 'GPU' },
    relevance: ['performance', 'latency', 'stability'],
  },
  memory: {
    label: { en: 'Memory', 'pt-BR': 'Memória' },
    relevance: ['performance', 'stability'],
  },
  storage: {
    label: { en: 'Storage', 'pt-BR': 'Armazenamento' },
    relevance: ['performance', 'stability', 'privacy'],
  },
  thermals: {
    label: { en: 'Thermals', 'pt-BR': 'Temperaturas' },
    relevance: ['performance', 'stability'],
  },
  network: {
    label: { en: 'Network', 'pt-BR': 'Rede' },
    relevance: ['latency', 'stability', 'privacy'],
  },
  audio: {
    label: { en: 'Audio', 'pt-BR': 'Áudio' },
    relevance: ['latency', 'stability'],
  },
  'input-usb': {
    label: { en: 'Input and USB', 'pt-BR': 'Entrada e USB' },
    relevance: ['latency', 'stability'],
  },
  display: {
    label: { en: 'Display', 'pt-BR': 'Tela' },
    relevance: ['performance', 'latency'],
  },
  'security-privacy': {
    label: { en: 'Security and privacy', 'pt-BR': 'Segurança e privacidade' },
    relevance: ['stability', 'privacy'],
  },
};

const COMPONENT_ICONS: Readonly<Record<ImproveComponent, ProductIconName>> = Object.freeze({
  windows: 'app',
  'cpu-power': 'cpu',
  gpu: 'microchip',
  memory: 'memory',
  storage: 'database',
  thermals: 'temperature',
  network: 'network',
  audio: 'audio',
  'input-usb': 'usb',
  display: 'monitor',
  'security-privacy': 'shield',
});

export const GOLDEN_OPERATIONS = Object.freeze([
  {
    id: 'windows-game-mode-review',
    name: { en: 'Review Windows Game Mode', 'pt-BR': 'Revisar o Modo de Jogo do Windows' },
    component: 'windows',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Keep foreground game scheduling aligned with the selected session profile.',
      'pt-BR':
        'Manter o agendamento do jogo em primeiro plano alinhado ao perfil da sessão selecionada.',
    },
    expectedDirection: {
      en: 'May reduce avoidable background scheduling during a game session.',
      'pt-BR': 'Pode reduzir agendamentos desnecessários em segundo plano durante o jogo.',
    },
    evidence: {
      en: 'The S01 scenario includes a compatible Windows 11 Game Mode state.',
      'pt-BR': 'O cenário S01 inclui um estado compatível do Modo de Jogo no Windows 11.',
    },
    compatibility: {
      en: 'Compatible with the Windows 11 S01 fixture.',
      'pt-BR': 'Compatível com o cenário S01 do Windows 11.',
    },
    restartEffect: {
      en: 'No restart is expected in the simulated review.',
      'pt-BR': 'Nenhuma reinicialização é esperada na revisão simulada.',
    },
    previousValue: {
      en: 'Scenario baseline: Game Mode enabled.',
      'pt-BR': 'Base do cenário: Modo de Jogo ativado.',
    },
    recoveryMethod: {
      en: 'Restore the captured Game Mode preference.',
      'pt-BR': 'Restaurar a preferência capturada do Modo de Jogo.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Windows version', 'pt-BR': 'Versão do Windows' },
      { en: 'Recovery checkpoint', 'pt-BR': 'Ponto de recuperação' },
    ],
  },
  {
    id: 'windows-background-apps-review',
    name: {
      en: 'Review background app activity',
      'pt-BR': 'Revisar atividade de aplicativos em segundo plano',
    },
    component: 'windows',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Identify optional background activity without disabling required Windows services.',
      'pt-BR':
        'Identificar atividades opcionais em segundo plano sem desativar serviços necessários do Windows.',
    },
    expectedDirection: {
      en: 'May reduce avoidable CPU and memory pressure before a game starts.',
      'pt-BR': 'Pode reduzir uso evitável de CPU e memória antes de iniciar um jogo.',
    },
    evidence: {
      en: 'Only allowlisted fixture applications are represented.',
      'pt-BR': 'Apenas aplicativos permitidos no cenário simulado estão representados.',
    },
    compatibility: {
      en: 'Compatible after per-application review.',
      'pt-BR': 'Compatível após revisão individual de cada aplicativo.',
    },
    restartEffect: {
      en: 'No system restart; affected apps may need to reopen in a future real flow.',
      'pt-BR':
        'Sem reinicialização do sistema; os aplicativos podem precisar ser reabertos em um fluxo real futuro.',
    },
    previousValue: {
      en: 'Scenario baseline: Windows manages background permissions.',
      'pt-BR': 'Base do cenário: o Windows gerencia as permissões em segundo plano.',
    },
    recoveryMethod: {
      en: 'Restore each captured application permission.',
      'pt-BR': 'Restaurar a permissão capturada de cada aplicativo.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Application allowlist', 'pt-BR': 'Lista de aplicativos permitidos' },
      { en: 'User confirmation', 'pt-BR': 'Confirmação do usuário' },
    ],
  },
  {
    id: 'windows-visual-effects-review',
    name: {
      en: 'Review Windows visual effects',
      'pt-BR': 'Revisar efeitos visuais do Windows',
    },
    component: 'windows',
    eligibility: 'review-required',
    riskClass: 'advanced',
    evidenceQuality: 'degraded',
    purpose: {
      en: 'Prepare a selective visual-effects profile instead of a blanket disable.',
      'pt-BR':
        'Preparar um perfil seletivo de efeitos visuais em vez de desativar tudo indiscriminadamente.',
    },
    expectedDirection: {
      en: 'May reduce desktop composition work on constrained systems; no gain is guaranteed.',
      'pt-BR':
        'Pode reduzir o trabalho de composição em sistemas limitados; nenhum ganho é garantido.',
    },
    evidence: {
      en: 'The impact is modeled because no real device measurement exists yet.',
      'pt-BR': 'O impacto é modelado porque ainda não existe medição do dispositivo real.',
    },
    compatibility: {
      en: 'Requires a complete accessibility and hardware review.',
      'pt-BR': 'Exige revisão completa de acessibilidade e hardware.',
    },
    restartEffect: {
      en: 'Explorer restart may be required in a future real flow.',
      'pt-BR': 'O Explorador do Windows pode precisar reiniciar em um fluxo real futuro.',
    },
    previousValue: {
      en: 'Scenario baseline: Windows chooses visual effects automatically.',
      'pt-BR': 'Base do cenário: o Windows escolhe os efeitos visuais automaticamente.',
    },
    recoveryMethod: {
      en: 'Restore the complete captured visual-effects profile.',
      'pt-BR': 'Restaurar o perfil completo de efeitos visuais capturado.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Accessibility review', 'pt-BR': 'Revisão de acessibilidade' },
      { en: 'Hardware classification', 'pt-BR': 'Classificação do hardware' },
    ],
  },
  {
    id: 'power-balanced-review',
    name: {
      en: 'Review balanced game power policy',
      'pt-BR': 'Revisar política de energia equilibrada para jogos',
    },
    component: 'cpu-power',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Prefer a validated balanced scenario policy during the selected game.',
      'pt-BR': 'Priorizar uma política equilibrada validada durante o jogo selecionado.',
    },
    expectedDirection: {
      en: 'May reduce avoidable scheduling variance; no numeric gain is guaranteed.',
      'pt-BR':
        'Pode reduzir variações evitáveis de agendamento; nenhum ganho numérico é garantido.',
    },
    evidence: {
      en: 'S01 fixture inventory and recovery readiness are current.',
      'pt-BR': 'O inventário simulado S01 e a prontidão de recuperação estão atualizados.',
    },
    compatibility: {
      en: 'Eligible for the S01 Windows 11 fixture only.',
      'pt-BR': 'Elegível somente para o cenário S01 do Windows 11.',
    },
    restartEffect: {
      en: 'No restart in the preview.',
      'pt-BR': 'Nenhuma reinicialização durante a prévia.',
    },
    previousValue: {
      en: 'Scenario baseline: Windows balanced policy.',
      'pt-BR': 'Base do cenário: política equilibrada do Windows.',
    },
    recoveryMethod: {
      en: 'Restore the exact prior policy from the scenario checkpoint.',
      'pt-BR': 'Restaurar a política anterior exata a partir do ponto de recuperação.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Trusted inventory', 'pt-BR': 'Inventário confiável' },
      { en: 'Recovery checkpoint', 'pt-BR': 'Ponto de recuperação' },
    ],
  },
  {
    id: 'cpu-boost-consistency-review',
    name: {
      en: 'Review processor boost consistency',
      'pt-BR': 'Revisar consistência do boost do processador',
    },
    component: 'cpu-power',
    eligibility: 'review-required',
    riskClass: 'advanced',
    evidenceQuality: 'degraded',
    purpose: {
      en: 'Inspect processor boost behavior without forcing a universal value.',
      'pt-BR': 'Inspecionar o comportamento de boost sem impor um valor universal.',
    },
    expectedDirection: {
      en: 'May improve frametime consistency when thermal headroom is verified.',
      'pt-BR': 'Pode melhorar a consistência do frametime quando houver margem térmica verificada.',
    },
    evidence: {
      en: 'Thermal impact remains modeled in the S01 fixture.',
      'pt-BR': 'O impacto térmico permanece modelado no cenário S01.',
    },
    compatibility: {
      en: 'Requires processor and cooling classification.',
      'pt-BR': 'Exige classificação do processador e do sistema de refrigeração.',
    },
    restartEffect: {
      en: 'No restart is expected, but a future real plan would revalidate temperatures.',
      'pt-BR':
        'Nenhuma reinicialização é esperada, mas um plano real futuro revalidaria as temperaturas.',
    },
    previousValue: {
      en: 'Scenario baseline: manufacturer-managed boost behavior.',
      'pt-BR': 'Base do cenário: boost gerenciado pelo fabricante.',
    },
    recoveryMethod: {
      en: 'Restore the captured processor policy and verify clocks.',
      'pt-BR': 'Restaurar a política capturada do processador e verificar os clocks.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Processor identity', 'pt-BR': 'Identidade do processador' },
      { en: 'Thermal headroom', 'pt-BR': 'Margem térmica' },
    ],
  },
  {
    id: 'gpu-latency-policy-review',
    name: {
      en: 'Review GPU latency policy',
      'pt-BR': 'Revisar política de latência da GPU',
    },
    component: 'gpu',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Prepare a vendor-aware latency setting for the selected game profile.',
      'pt-BR': 'Preparar uma configuração de latência compatível com o fabricante e o jogo.',
    },
    expectedDirection: {
      en: 'May reduce render-queue delay in compatible titles.',
      'pt-BR': 'Pode reduzir o atraso da fila de renderização em jogos compatíveis.',
    },
    evidence: {
      en: 'The S01 fixture contains a verified GPU family and driver branch.',
      'pt-BR': 'O cenário S01 contém família de GPU e ramo de driver verificados.',
    },
    compatibility: {
      en: 'Compatible only with the represented driver branch and game profile.',
      'pt-BR': 'Compatível apenas com o ramo de driver e o perfil de jogo representados.',
    },
    restartEffect: {
      en: 'No Windows restart; a game restart may be required in a future real flow.',
      'pt-BR':
        'Sem reinicialização do Windows; o jogo pode precisar reiniciar em um fluxo real futuro.',
    },
    previousValue: {
      en: 'Scenario baseline: application-controlled latency policy.',
      'pt-BR': 'Base do cenário: política de latência controlada pelo aplicativo.',
    },
    recoveryMethod: {
      en: 'Restore the captured per-game driver setting.',
      'pt-BR': 'Restaurar a configuração capturada do driver para o jogo.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Verified driver branch', 'pt-BR': 'Ramo de driver verificado' },
      { en: 'Per-game profile', 'pt-BR': 'Perfil individual do jogo' },
    ],
  },
  {
    id: 'network-latency-review',
    name: {
      en: 'Review adapter latency policy',
      'pt-BR': 'Revisar política de latência do adaptador',
    },
    component: 'network',
    eligibility: 'review-required',
    riskClass: 'advanced',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Inspect an adapter-specific latency policy without applying it.',
      'pt-BR': 'Inspecionar uma política de latência específica do adaptador sem aplicá-la.',
    },
    expectedDirection: {
      en: 'May reduce timing variance for the scenario workload; direction is evidence-bound.',
      'pt-BR':
        'Pode reduzir a variação de tempo na carga simulada; a direção depende da evidência.',
    },
    evidence: {
      en: 'S02 adapter identity is current; workload evidence remains scenario-only.',
      'pt-BR':
        'A identidade do adaptador S02 está atualizada; a evidência de carga ainda é simulada.',
    },
    compatibility: {
      en: 'Compatible with the S02 fixture after full dependency review.',
      'pt-BR': 'Compatível com o cenário S02 após revisão completa das dependências.',
    },
    restartEffect: {
      en: 'Adapter interruption would be possible in a future real flow; preview changes nothing.',
      'pt-BR':
        'Uma interrupção do adaptador seria possível em um fluxo real futuro; a prévia não altera nada.',
    },
    previousValue: {
      en: 'Scenario baseline: system-managed adapter policy.',
      'pt-BR': 'Base do cenário: política do adaptador gerenciada pelo sistema.',
    },
    recoveryMethod: {
      en: 'Restore the captured adapter policy and verify connectivity.',
      'pt-BR': 'Restaurar a política capturada do adaptador e verificar a conectividade.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Adapter identity', 'pt-BR': 'Identidade do adaptador' },
      { en: 'Offline-safe recovery', 'pt-BR': 'Recuperação segura sem internet' },
      { en: 'Explicit confirmation', 'pt-BR': 'Confirmação explícita' },
    ],
  },
  {
    id: 'gpu-driver-hidden',
    name: {
      en: 'Tune unverified GPU driver source',
      'pt-BR': 'Ajustar uma origem de driver de GPU não verificada',
    },
    component: 'gpu',
    eligibility: 'excluded',
    riskClass: 'experimental',
    evidenceQuality: 'insufficient',
    exclusionReason: {
      en: 'GPU driver source is unavailable in S06, so compatibility cannot be established.',
      'pt-BR':
        'A origem do driver da GPU não está disponível no S06; a compatibilidade não pode ser confirmada.',
    },
    purpose: {
      en: 'Would inspect a vendor-specific setting only after evidence exists.',
      'pt-BR': 'Inspecionaria uma configuração do fabricante somente após existir evidência.',
    },
    expectedDirection: {
      en: 'Unknown. No directional claim is permitted while evidence is unavailable.',
      'pt-BR':
        'Desconhecida. Nenhuma direção de impacto é permitida enquanto não houver evidência.',
    },
    evidence: {
      en: 'S06 reports an unavailable GPU driver source.',
      'pt-BR': 'O S06 informa que a origem do driver da GPU não está disponível.',
    },
    compatibility: {
      en: 'Excluded fail-closed.',
      'pt-BR': 'Excluída com segurança.',
    },
    restartEffect: {
      en: 'Unknown; the operation is excluded before review.',
      'pt-BR': 'Desconhecido; a operação foi excluída antes da revisão.',
    },
    previousValue: {
      en: 'Unavailable — no defensible value exists.',
      'pt-BR': 'Indisponível — não existe um valor defensável.',
    },
    recoveryMethod: {
      en: 'Not applicable because no operation can be requested.',
      'pt-BR': 'Não se aplica, pois nenhuma operação pode ser solicitada.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Verified GPU driver source', 'pt-BR': 'Origem verificada do driver da GPU' },
    ],
  },
  {
    id: 'memory-background-pressure-review',
    name: {
      en: 'Review background memory pressure',
      'pt-BR': 'Revisar pressão de memória em segundo plano',
    },
    component: 'memory',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Identify optional processes competing with the selected game for memory.',
      'pt-BR': 'Identificar processos opcionais que disputam memória com o jogo selecionado.',
    },
    expectedDirection: {
      en: 'May increase available memory before launch without using unsafe memory cleaners.',
      'pt-BR':
        'Pode aumentar a memória disponível antes do jogo sem usar limpadores de memória inseguros.',
    },
    evidence: {
      en: 'The fixture includes bounded process and working-set data.',
      'pt-BR': 'O cenário inclui dados limitados de processos e conjuntos de trabalho.',
    },
    compatibility: {
      en: 'Compatible after protecting system and user-allowlisted processes.',
      'pt-BR': 'Compatível após proteger processos do sistema e os permitidos pelo usuário.',
    },
    restartEffect: {
      en: 'No system restart.',
      'pt-BR': 'Sem reinicialização do sistema.',
    },
    previousValue: {
      en: 'Scenario baseline: optional applications remain open.',
      'pt-BR': 'Base do cenário: aplicativos opcionais permanecem abertos.',
    },
    recoveryMethod: {
      en: 'Reopen only applications explicitly closed by the future plan.',
      'pt-BR': 'Reabrir somente os aplicativos fechados explicitamente pelo plano futuro.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Process allowlist', 'pt-BR': 'Lista de processos permitidos' },
      { en: 'User review', 'pt-BR': 'Revisão do usuário' },
    ],
  },
  {
    id: 'storage-indexing-review',
    name: {
      en: 'Review game-library indexing',
      'pt-BR': 'Revisar indexação da biblioteca de jogos',
    },
    component: 'storage',
    eligibility: 'review-required',
    riskClass: 'advanced',
    evidenceQuality: 'degraded',
    purpose: {
      en: 'Evaluate indexing activity around game-library paths without disabling search globally.',
      'pt-BR':
        'Avaliar a indexação nas pastas de jogos sem desativar a pesquisa do Windows globalmente.',
    },
    expectedDirection: {
      en: 'May reduce background storage activity during a session.',
      'pt-BR': 'Pode reduzir atividade de armazenamento em segundo plano durante a sessão.',
    },
    evidence: {
      en: 'Storage impact is modeled until the real device is measured.',
      'pt-BR': 'O impacto no armazenamento é modelado até que o dispositivo real seja medido.',
    },
    compatibility: {
      en: 'Requires verified game paths and storage-health checks.',
      'pt-BR': 'Exige pastas de jogos verificadas e checagem da saúde do armazenamento.',
    },
    restartEffect: {
      en: 'No Windows restart; indexing state would be revalidated.',
      'pt-BR': 'Sem reinicialização do Windows; o estado da indexação seria revalidado.',
    },
    previousValue: {
      en: 'Scenario baseline: system-managed indexing.',
      'pt-BR': 'Base do cenário: indexação gerenciada pelo sistema.',
    },
    recoveryMethod: {
      en: 'Restore the exact captured indexing scope.',
      'pt-BR': 'Restaurar o escopo exato de indexação capturado.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Verified library paths', 'pt-BR': 'Pastas da biblioteca verificadas' },
      { en: 'Storage health', 'pt-BR': 'Saúde do armazenamento' },
    ],
  },
  {
    id: 'thermal-headroom-review',
    name: {
      en: 'Review thermal headroom',
      'pt-BR': 'Revisar margem térmica',
    },
    component: 'thermals',
    eligibility: 'ready',
    riskClass: 'verified',
    evidenceQuality: 'verified',
    purpose: {
      en: 'Confirm that performance recommendations stay inside the represented thermal margin.',
      'pt-BR':
        'Confirmar que as recomendações de desempenho permanecem dentro da margem térmica representada.',
    },
    expectedDirection: {
      en: 'Protects stability by blocking recommendations without sufficient thermal margin.',
      'pt-BR': 'Protege a estabilidade bloqueando recomendações sem margem térmica suficiente.',
    },
    evidence: {
      en: 'The S01 fixture includes bounded CPU and GPU temperature ranges.',
      'pt-BR': 'O cenário S01 inclui faixas limitadas de temperatura da CPU e GPU.',
    },
    compatibility: {
      en: 'Compatible as a review gate; it does not control fans or firmware.',
      'pt-BR': 'Compatível como etapa de revisão; não controla ventoinhas nem o firmware.',
    },
    restartEffect: {
      en: 'No restart.',
      'pt-BR': 'Sem reinicialização.',
    },
    previousValue: {
      en: 'Scenario baseline: thermal state within the represented range.',
      'pt-BR': 'Base do cenário: estado térmico dentro da faixa representada.',
    },
    recoveryMethod: {
      en: 'No system change is made; remove dependent recommendations if the gate fails.',
      'pt-BR':
        'Nenhuma alteração é feita; remover recomendações dependentes se a verificação falhar.',
    },
    provenance: 'fixture',
    dependencies: [
      { en: 'Temperature evidence', 'pt-BR': 'Evidência de temperatura' },
      { en: 'Cooling classification', 'pt-BR': 'Classificação da refrigeração' },
    ],
  },
] as const satisfies readonly TechnicalOperation[]);

const operationById = (id: string | undefined): TechnicalOperation =>
  GOLDEN_OPERATIONS.find((operation) => operation.id === id) ?? GOLDEN_OPERATIONS[0];

const capabilityStateFor = (eligibility: OperationEligibility): CapabilityState => {
  switch (eligibility) {
    case 'ready':
      return 'compatible';
    case 'review-required':
      return 'restricted';
    case 'excluded':
      return 'unsupported';
  }
};

const riskForDesignSystem = (risk: OperationRisk): RiskLevel => risk;

const riskLabelFor = (risk: OperationRisk, locale: ShellLocale): string =>
  localized(
    {
      en: risk.charAt(0).toUpperCase() + risk.slice(1),
      'pt-BR': {
        verified: 'Verificada',
        advanced: 'Avançada',
        experimental: 'Experimental',
        extreme: 'Extrema',
      }[risk],
    },
    locale,
  );

const capabilityLabelFor = (state: CapabilityState, locale: ShellLocale): string =>
  localized(
    {
      en: state,
      'pt-BR': {
        compatible: 'compatível',
        unsupported: 'incompatível',
        hidden: 'disponível em outro objetivo',
        restricted: 'exige revisão',
      }[state],
    },
    locale,
  );

const exclusionReasonFor = (
  operation: TechnicalOperation,
  locale: ShellLocale,
): string | undefined =>
  operation.exclusionReason === undefined
    ? undefined
    : localized(operation.exclusionReason, locale);

const createBoundary = (
  scenarioId: string,
  locale: ShellLocale,
  capability: string,
  owningPhase: string,
): PhaseBoundaryExplanation =>
  Object.freeze({
    kind: 'phase-boundary',
    capability,
    owningPhase,
    availableScenarioId: scenarioId as DesktopScenarioId,
    explanation:
      locale === 'pt-BR'
        ? `A interface está completa, mas ${capability} depende da ${owningPhase}. Revise o cenário disponível sem executar nada.`
        : `The interface is complete, but ${capability} belongs to ${owningPhase}. Review the available scenario without executing anything.`,
  });

const GoalsView = ({
  locale,
  onNavigate,
  selectedGoal,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly selectedGoal: ImproveGoal;
}) => (
  <section
    aria-labelledby="improve-goals-title"
    className="lb-optimization-overview"
    data-lb-region
    data-selected-goal={selectedGoal}
  >
    <h2 id="improve-goals-title">
      {localized(
        { en: 'What should improve first?', 'pt-BR': 'O que deve melhorar primeiro?' },
        locale,
      )}
    </h2>
    <nav
      aria-label={localized({ en: 'Improvement goals', 'pt-BR': 'Objetivos de melhoria' }, locale)}
    >
      {IMPROVE_GOALS.map((goal) => (
        <LbButton
          key={goal}
          onPress={() => onNavigate?.('goals', goal)}
          variant={goal === selectedGoal ? 'primary' : 'quiet'}
        >
          {localized(GOAL_COPY[goal].label, locale)}
        </LbButton>
      ))}
    </nav>
    <p>{localized(GOAL_COPY[selectedGoal].detail, locale)}</p>
    <FreshFinding locale={locale} selectedGoal={selectedGoal} />
    <section
      aria-label={localized(
        { en: 'Applicable components', 'pt-BR': 'Componentes aplicáveis' },
        locale,
      )}
      className="lb-component-grid"
    >
      {IMPROVE_COMPONENTS.map((component) => {
        const copy = COMPONENT_COPY[component];
        const applicable = copy.relevance.includes(selectedGoal);
        return (
          <article className="lb-component-card" data-component-id={component} key={component}>
            <ProductIcon
              className="lb-component-glyph"
              name={COMPONENT_ICONS[component]}
              size={20}
            />
            <h3>{localized(copy.label, locale)}</h3>
            <CapabilityReason
              capability={localized(copy.label, locale)}
              reason={
                applicable
                  ? localized(
                      {
                        en: `Relevant to the ${GOAL_COPY[selectedGoal].label.en} goal; inspect evidence before review.`,
                        'pt-BR': `Relevante para ${GOAL_COPY[selectedGoal].label['pt-BR']}; inspecione a evidência antes da revisão.`,
                      },
                      locale,
                    )
                  : localized(
                      {
                        en: 'Available through another goal; nothing is hidden.',
                        'pt-BR': 'Disponível em outro objetivo; nada fica oculto.',
                      },
                      locale,
                    )
              }
              state={applicable ? 'compatible' : 'hidden'}
              stateLabel={capabilityLabelFor(applicable ? 'compatible' : 'hidden', locale)}
            />
            <LbButton onPress={() => onNavigate?.('component', component)} variant="secondary">
              {localized({ en: 'Open', 'pt-BR': 'Abrir' }, locale)}
            </LbButton>
          </article>
        );
      })}
    </section>
  </section>
);

const FreshFinding = ({
  locale,
  selectedGoal,
}: {
  readonly locale: ShellLocale;
  readonly selectedGoal: ImproveGoal;
}) => (
  <aside aria-label={localized({ en: 'Current finding', 'pt-BR': 'Constatação atual' }, locale)}>
    <StatusSignal
      detail={localized(
        {
          en: `Fixture evidence for ${GOAL_COPY[selectedGoal].label.en} is current; one recommendation is ready.`,
          'pt-BR': `A evidência de cenário para ${GOAL_COPY[selectedGoal].label['pt-BR']} está atual; uma recomendação está pronta.`,
        },
        locale,
      )}
      locale={locale}
      state="fixture"
    />
    <ProvenanceMark detail="S01 · FIXTURE · 2030-01-15T18:00:00Z" kind="fixture" locale={locale} />
  </aside>
);

const ComponentView = ({
  component,
  locale,
  onNavigate,
}: {
  readonly component: ImproveComponent;
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
}) => {
  const operations = GOLDEN_OPERATIONS.filter((operation) => operation.component === component);
  const readyOperations = operations.filter(
    (operation) => operation.eligibility === 'ready',
  ).length;
  const reviewOperations = operations.filter(
    (operation) => operation.eligibility === 'review-required',
  ).length;

  return (
    <section
      aria-labelledby="improve-component-title"
      className="lb-component-workspace"
      data-component-id={component}
      data-lb-region
    >
      <header className="lb-component-hero">
        <div className="lb-component-hero-icon">
          <ProductIcon name={COMPONENT_ICONS[component]} size={28} />
        </div>
        <div>
          <span className="lb-component-context">
            {localized({ en: 'Optimization center', 'pt-BR': 'Central de otimização' }, locale)}
          </span>
          <h2 id="improve-component-title">{localized(COMPONENT_COPY[component].label, locale)}</h2>
          <p>
            {localized(
              {
                en: 'Review compatible adjustments, evidence and recovery before building a plan.',
                'pt-BR':
                  'Revise ajustes compatíveis, evidências e recuperação antes de montar um plano.',
              },
              locale,
            )}
          </p>
        </div>
        <div className="lb-component-count" aria-label={String(operations.length)}>
          <strong>{operations.length}</strong>
          <span>
            {localized(
              {
                en: operations.length === 1 ? 'adjustment available' : 'adjustments available',
                'pt-BR': operations.length === 1 ? 'ajuste disponível' : 'ajustes disponíveis',
              },
              locale,
            )}
          </span>
        </div>
      </header>

      <section
        className="lb-component-operation-list"
        aria-label={localized(
          { en: 'Recommended adjustments', 'pt-BR': 'Ajustes recomendados' },
          locale,
        )}
      >
        <header>
          <div>
            <h3>
              {localized(
                { en: 'Recommended adjustments', 'pt-BR': 'Ajustes recomendados' },
                locale,
              )}
            </h3>
            <p>
              {localized(
                {
                  en: 'Nothing is applied from this screen. Open an adjustment to review every consequence.',
                  'pt-BR':
                    'Nada é aplicado nesta tela. Abra um ajuste para revisar todas as consequências.',
                },
                locale,
              )}
            </p>
          </div>
          <span className="lb-component-readiness">
            {String(readyOperations)} {localized({ en: 'ready', 'pt-BR': 'prontos' }, locale)}
            {reviewOperations > 0
              ? ` · ${String(reviewOperations)} ${localized(
                  { en: 'require review', 'pt-BR': 'exigem revisão' },
                  locale,
                )}`
              : ''}
          </span>
        </header>
        {operations.map((operation) => (
          <article
            className="lb-component-operation"
            data-eligibility={operation.eligibility}
            key={operation.id}
          >
            <OperationRow
              actionLabel={localized(
                { en: 'Review adjustment', 'pt-BR': 'Revisar ajuste' },
                locale,
              )}
              detail={localized(operation.expectedDirection, locale)}
              name={localized(operation.name, locale)}
              onInspect={() => onNavigate?.('operation', operation.id)}
              risk={riskForDesignSystem(operation.riskClass)}
              riskLabel={riskLabelFor(operation.riskClass, locale)}
            />
            <CapabilityReason
              capability={localized(operation.name, locale)}
              reason={
                exclusionReasonFor(operation, locale) ?? localized(operation.compatibility, locale)
              }
              state={capabilityStateFor(operation.eligibility)}
              stateLabel={capabilityLabelFor(capabilityStateFor(operation.eligibility), locale)}
            />
          </article>
        ))}
        {operations.length === 0 ? (
          <StatusSignal
            detail={localized(
              {
                en: 'No operation is authored for this component in the golden scenario. Phase 7 owns the verified catalog; inspect the component evidence now.',
                'pt-BR':
                  'Nenhuma operação foi criada para este componente no cenário principal. A Fase 7 é responsável pelo catálogo verificado; inspecione agora a evidência do componente.',
              },
              locale,
            )}
            locale={locale}
            state="empty"
          />
        ) : null}
      </section>

      <footer className="lb-component-plan-footer">
        <div className="lb-component-proof">
          <div>
            <ProductIcon name="shield" size={17} />
            <span>
              <small>{localized({ en: 'Evidence', 'pt-BR': 'Evidência' }, locale)}</small>
              <strong>
                {localized({ en: 'Simulated scenario', 'pt-BR': 'Cenário simulado' }, locale)}
              </strong>
            </span>
          </div>
          <div>
            <ProductIcon name="recovery" size={17} />
            <span>
              <small>{localized({ en: 'Recovery', 'pt-BR': 'Recuperação' }, locale)}</small>
              <strong>
                {localized({ en: 'Planned before changes', 'pt-BR': 'Planejada antes' }, locale)}
              </strong>
            </span>
          </div>
          <ProvenanceMark
            detail={`S01 · FIXTURE · ${component.toUpperCase()}`}
            kind="fixture"
            locale={locale}
          />
        </div>
        <div>
          <p>
            {localized(
              {
                en: 'Build one reviewable plan from the compatible adjustments above.',
                'pt-BR': 'Monte um único plano revisável com os ajustes compatíveis acima.',
              },
              locale,
            )}
          </p>
          <LbButton
            onPress={() => onNavigate?.('plan-review', 'recommended-plan')}
            variant="primary"
          >
            {localized(
              { en: 'Review recommended plan', 'pt-BR': 'Revisar plano recomendado' },
              locale,
            )}
          </LbButton>
        </div>
      </footer>
    </section>
  );
};

const OperationView = ({
  locale,
  onNavigate,
  operation,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly operation: TechnicalOperation;
}) => (
  <section
    aria-labelledby="improve-operation-title"
    data-eligibility={operation.eligibility}
    data-lb-region
  >
    <h2 id="improve-operation-title">
      {localized({ en: 'Operation detail', 'pt-BR': 'Detalhe da operação' }, locale)}
    </h2>
    <OperationInspector
      operation={localized(operation.name, locale)}
      operationLabel={localized({ en: 'Operation', 'pt-BR': 'Operação' }, locale)}
    >
      <dl>
        <dt>{localized({ en: 'Purpose', 'pt-BR': 'Objetivo' }, locale)}</dt>
        <dd>{localized(operation.purpose, locale)}</dd>
        <dt>{localized({ en: 'Expected direction', 'pt-BR': 'Direção esperada' }, locale)}</dt>
        <dd>{localized(operation.expectedDirection, locale)}</dd>
        <dt>{localized({ en: 'Risk', 'pt-BR': 'Risco' }, locale)}</dt>
        <dd>
          <RiskClass
            label={riskLabelFor(operation.riskClass, locale)}
            level={riskForDesignSystem(operation.riskClass)}
          />
        </dd>
        <dt>{localized({ en: 'Evidence', 'pt-BR': 'Evidência' }, locale)}</dt>
        <dd>{localized(operation.evidence, locale)}</dd>
        <dt>{localized({ en: 'Compatibility', 'pt-BR': 'Compatibilidade' }, locale)}</dt>
        <dd>{localized(operation.compatibility, locale)}</dd>
        <dt>{localized({ en: 'Restart effect', 'pt-BR': 'Efeito de reinicialização' }, locale)}</dt>
        <dd>{localized(operation.restartEffect, locale)}</dd>
        <dt>{localized({ en: 'Previous value', 'pt-BR': 'Valor anterior' }, locale)}</dt>
        <dd>{localized(operation.previousValue, locale)}</dd>
        <dt>{localized({ en: 'Recovery method', 'pt-BR': 'Método de recuperação' }, locale)}</dt>
        <dd>{localized(operation.recoveryMethod, locale)}</dd>
        <dt>{localized({ en: 'Provenance', 'pt-BR': 'Proveniência' }, locale)}</dt>
        <dd>
          <ProvenanceMark detail="SIMULATED SCENARIO" kind={operation.provenance} locale={locale} />
        </dd>
      </dl>
      <QualityMark locale={locale} quality={operation.evidenceQuality} />
      {operation.eligibility === 'excluded' ? (
        <StatusSignal
          detail={
            exclusionReasonFor(operation, locale) ?? localized(operation.compatibility, locale)
          }
          locale={locale}
          state="unsupported"
        />
      ) : (
        <LbButton onPress={() => onNavigate?.('plan-review', operation.id)} variant="primary">
          {operation.eligibility === 'review-required'
            ? localized(
                { en: 'Open full Advanced review', 'pt-BR': 'Abrir revisão Avançada completa' },
                locale,
              )
            : localized(
                { en: 'Add to preview plan', 'pt-BR': 'Adicionar ao plano de prévia' },
                locale,
              )}
        </LbButton>
      )}
    </OperationInspector>
  </section>
);

const PlanReviewView = ({
  locale,
  onNavigate,
  onRiskPolicyChange,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly onRiskPolicyChange?: ImproveSurfaceProps['onRiskPolicyChange'];
}) => (
  <section aria-labelledby="improve-plan-title" data-critical-path="complete" data-lb-region>
    <h2 id="improve-plan-title">
      {localized(
        { en: 'Golden recommendation review', 'pt-BR': 'Revisão da recomendação principal' },
        locale,
      )}
    </h2>
    <p>
      {localized(
        {
          en: 'Compatible adjustments are grouped here for a complete consequence and recovery review.',
          'pt-BR':
            'Os ajustes compatíveis estão reunidos aqui para uma revisão completa de consequências e recuperação.',
        },
        locale,
      )}
    </p>
    <LbRadioGroup
      label={localized({ en: 'Global risk policy', 'pt-BR': 'Política global de risco' }, locale)}
      onChange={(risk) => {
        if ((IMPROVE_RISK_POLICIES as readonly string[]).includes(risk)) {
          onRiskPolicyChange?.(risk as OperationRisk);
        }
      }}
      options={IMPROVE_RISK_POLICIES.map((risk) => ({
        label: riskLabelFor(risk, locale),
        value: risk,
      }))}
      value="verified"
    />
    {GOLDEN_OPERATIONS.map((operation) => (
      <article data-eligibility={operation.eligibility} key={operation.id}>
        <OperationRow
          actionLabel={localized({ en: 'Review adjustment', 'pt-BR': 'Revisar ajuste' }, locale)}
          detail={
            exclusionReasonFor(operation, locale) ?? localized(operation.expectedDirection, locale)
          }
          name={localized(operation.name, locale)}
          onInspect={() => onNavigate?.('operation', operation.id)}
          risk={riskForDesignSystem(operation.riskClass)}
          riskLabel={riskLabelFor(operation.riskClass, locale)}
        />
        <QualityMark locale={locale} quality={operation.evidenceQuality} />
      </article>
    ))}
    <PlanDependencyList
      dependencies={[
        {
          id: 'inventory',
          label: localized(
            { en: 'Trusted scenario inventory', 'pt-BR': 'Inventário confiável do cenário' },
            locale,
          ),
          state: 'complete',
        },
        {
          id: 'recovery',
          label: localized(
            {
              en: 'No-effect recovery checkpoint',
              'pt-BR': 'Ponto de recuperação sem alterações',
            },
            locale,
          ),
          state: 'ready',
        },
        {
          id: 'driver',
          label: localized({ en: 'GPU driver source', 'pt-BR': 'Origem do driver da GPU' }, locale),
          state: 'blocked',
        },
      ]}
    />
    <p>
      {localized(
        {
          en: 'Expected impact is directional and evidence-bound. No gain is guaranteed.',
          'pt-BR':
            'O impacto esperado é direcional e limitado pela evidência. Nenhum ganho é garantido.',
        },
        locale,
      )}
    </p>
    <LbButton onPress={() => onNavigate?.('confirmation')} variant="primary">
      {localized(
        { en: 'Review preview confirmation', 'pt-BR': 'Revisar confirmação da prévia' },
        locale,
      )}
    </LbButton>
  </section>
);

const ConfirmationView = ({
  locale,
  onNavigate,
  scenarioId,
}: {
  readonly locale: ShellLocale;
  readonly onNavigate?: ImproveSurfaceProps['onNavigate'];
  readonly scenarioId: string;
}) => {
  const boundary = createBoundary(scenarioId, locale, 'Privileged plan execution', 'Phase 6');

  return (
    <section aria-labelledby="improve-confirm-title" data-critical-path="complete" data-lb-region>
      <h2 id="improve-confirm-title">
        {localized({ en: 'Preview confirmation', 'pt-BR': 'Confirmação da prévia' }, locale)}
      </h2>
      <RiskGate
        explanation={localized(
          {
            en: 'Advanced review names dependencies, interruption risk, and exact recovery before any future request.',
            'pt-BR':
              'A revisão Avançada informa dependências, risco de interrupção e recuperação antes de qualquer solicitação futura.',
          },
          locale,
        )}
        risk="advanced"
        snapshotReady
      >
        <p>
          {localized(
            {
              en: 'This Phase 2 action creates only a no-change scenario receipt.',
              'pt-BR': 'Esta ação da Fase 2 cria apenas um recibo de cenário sem alterações.',
            },
            locale,
          )}
        </p>
        <LbButton onPress={() => onNavigate?.('no-change-receipt')} variant="primary">
          {localized(
            { en: 'Complete no-change preview', 'pt-BR': 'Concluir prévia sem alterações' },
            locale,
          )}
        </LbButton>
      </RiskGate>
      <aside aria-label="Phase boundary">
        <strong>{boundary.capability}</strong>
        <p>{boundary.explanation}</p>
        <p>{boundary.owningPhase}</p>
      </aside>
    </section>
  );
};

const RestartView = ({ locale }: { readonly locale: ShellLocale }) => (
  <RestartPlanner>
    <p>
      {localized(
        {
          en: 'The scenario explains restart implications, but no restart is scheduled by this preview.',
          'pt-BR':
            'O cenário explica a reinicialização, mas nenhuma reinicialização é agendada pela prévia.',
        },
        locale,
      )}
    </p>
  </RestartPlanner>
);

const RecoveryHistoryView = ({ locale }: { readonly locale: ShellLocale }) => (
  <section aria-labelledby="improve-recovery-title" data-lb-region>
    <h2 id="improve-recovery-title">
      {localized({ en: 'Recovery history', 'pt-BR': 'Histórico de recuperação' }, locale)}
    </h2>
    <ChangeLedger
      entries={[
        {
          id: 'review-started',
          change: localized(
            { en: 'Golden plan reviewed', 'pt-BR': 'Plano principal revisado' },
            locale,
          ),
          result: 'no-change',
          timestamp: '2030-01-15T18:10:00.000Z',
        },
        {
          id: 'preview-complete',
          change: localized(
            { en: 'No-effect preview verified', 'pt-BR': 'Prévia sem efeito verificada' },
            locale,
          ),
          result: 'no-change',
          timestamp: '2030-01-15T18:12:00.000Z',
        },
      ]}
    />
  </section>
);

const NoChangeReceiptView = ({
  locale,
  scenarioId,
}: {
  readonly locale: ShellLocale;
  readonly scenarioId: string;
}) => (
  <section aria-labelledby="improve-receipt-title" data-lb-region>
    <h2 id="improve-receipt-title">
      {localized({ en: 'Preview result', 'pt-BR': 'Resultado da prévia' }, locale)}
    </h2>
    <VerificationReceipt
      detail={localized(
        {
          en: 'Preview complete — no changes were made to this PC. The Verified and Advanced requests were reviewed; the excluded operation remained blocked.',
          'pt-BR':
            'Prévia concluída — nenhuma alteração foi feita neste PC. As solicitações Verificada e Avançada foram revisadas; a operação excluída permaneceu bloqueada.',
        },
        locale,
      )}
      receiptId={`${scenarioId}-IMPROVE-NO-CHANGE`}
    />
  </section>
);

export const ImproveSurface = ({
  locale,
  onNavigate,
  onRiskPolicyChange,
  scenarioId,
  selectedComponent = 'cpu-power',
  selectedGoal = 'performance',
  selectedOperationId,
  view,
}: ImproveSurfaceProps) => {
  const operation = operationById(selectedOperationId);

  return (
    <main
      aria-label={localized({ en: 'Improve workspace', 'pt-BR': 'Área de melhoria' }, locale)}
      data-improve-view={view}
      data-locale={locale}
      data-scenario-id={scenarioId}
    >
      <ScenarioMarker scenarioId={scenarioId} />
      <RouteHeader
        breadcrumbs={[
          { label: localized({ en: 'Improve', 'pt-BR': 'Melhorar' }, locale) },
          { label: view },
        ]}
        purpose={localized(
          {
            en: 'Choose a performance goal and review every recommended adjustment before applying it.',
            'pt-BR':
              'Escolha um objetivo de desempenho e revise cada ajuste recomendado antes de aplicar.',
          },
          locale,
        )}
        title={localized({ en: 'Optimization', 'pt-BR': 'Otimização' }, locale)}
      />

      {view === 'goals' ? (
        <GoalsView locale={locale} onNavigate={onNavigate} selectedGoal={selectedGoal} />
      ) : null}
      {view === 'component' ? (
        <ComponentView component={selectedComponent} locale={locale} onNavigate={onNavigate} />
      ) : null}
      {view === 'operation' ? (
        <OperationView locale={locale} onNavigate={onNavigate} operation={operation} />
      ) : null}
      {view === 'plan-review' ? (
        <PlanReviewView
          locale={locale}
          onNavigate={onNavigate}
          onRiskPolicyChange={onRiskPolicyChange}
        />
      ) : null}
      {view === 'confirmation' ? (
        <ConfirmationView locale={locale} onNavigate={onNavigate} scenarioId={scenarioId} />
      ) : null}
      {view === 'restart' ? <RestartView locale={locale} /> : null}
      {view === 'recovery-history' ? <RecoveryHistoryView locale={locale} /> : null}
      {view === 'no-change-receipt' ? (
        <NoChangeReceiptView locale={locale} scenarioId={scenarioId} />
      ) : null}
    </main>
  );
};

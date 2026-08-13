import {
  CapabilityReason,
  ChangeLedger,
  ExecutionTimeline,
  LbButton,
  LbPanel,
  LbRadioGroup,
  LbSwitch,
  OperationInspector,
  OperationRow,
  PlanDependencyList,
  PlanRevisionSummary,
  ProductIcon,
  ProvenanceMark,
  QualityMark,
  RestartPlanner,
  RiskClass,
  RiskGate,
  RouteHeader,
  ScenarioMarker,
  StatusSignal,
  VerifiedReceiptDetails,
  VerificationReceipt,
  type CapabilityState,
  type EvidenceQuality,
  type ProductIconName,
  type RiskLevel,
} from '@liiiraa/design-system';
import type {
  PlanOperationJson,
  RiskClassJson,
  TransactionReceiptDocumentJson,
  TransactionalRecoveryDocumentJson,
} from '@liiiraa/contracts-ts';
import type {
  DesktopScenarioId,
  PhaseBoundaryExplanation,
  PlanAuthority,
  PlanAuthoritySnapshot,
  RecommendationState,
} from '@liiiraa/desktop-client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

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
  readonly approvalProofReference?: string;
  readonly authority?: PlanAuthority;
  readonly evidenceReferences?: readonly string[];
  readonly goalReferences?: readonly string[];
  readonly locale: ShellLocale;
  readonly onCancelSafely?: (transactionId: string) => void;
  readonly onNavigate?: (view: ImproveView, targetId?: string) => void;
  readonly onRiskPolicyChange?: (risk: OperationRisk) => void;
  readonly scenarioId: string;
  readonly selectedComponent?: ImproveComponent;
  readonly selectedGoal?: ImproveGoal;
  readonly selectedOperationId?: string;
  readonly validatedDocuments?: readonly TransactionalRecoveryDocumentJson[];
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

const operationIconFor = (operation: TechnicalOperation): ProductIconName => {
  if (operation.id.includes('game')) return 'game';
  if (operation.id.includes('background')) return 'cpu';
  if (operation.id.includes('visual')) return 'monitor';
  if (operation.id.includes('power')) return 'zap';
  if (operation.id.includes('boost')) return 'gauge';
  if (operation.id.includes('gpu')) return 'microchip';
  if (operation.id.includes('network')) return 'network';
  if (operation.id.includes('memory')) return 'memory';
  if (operation.id.includes('storage')) return 'database';
  if (operation.id.includes('thermal')) return 'temperature';
  if (operation.id.includes('usb')) return 'usb';
  if (operation.id.includes('security')) return 'shield';
  return COMPONENT_ICONS[operation.component];
};

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
  const [selectedOperationIds, setSelectedOperationIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        GOLDEN_OPERATIONS.filter((operation) => operation.eligibility === 'ready').map(
          (operation) => operation.id,
        ),
      ),
  );
  const readyOperations = operations.filter(
    (operation) => operation.eligibility === 'ready',
  ).length;
  const reviewOperations = operations.filter(
    (operation) => operation.eligibility === 'review-required',
  ).length;
  const selectedOperations = operations.filter((operation) =>
    selectedOperationIds.has(operation.id),
  );

  const updateSelection = (operationId: string, selected: boolean): void => {
    setSelectedOperationIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(operationId);
      } else {
        next.delete(operationId);
      }
      return next;
    });
  };

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
                  en: 'Choose which adjustments enter the simulated plan. Nothing changes in Windows yet.',
                  'pt-BR':
                    'Escolha quais ajustes entram no plano simulado. Nada muda no Windows ainda.',
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
            data-preview-selected={selectedOperationIds.has(operation.id)}
            key={operation.id}
          >
            <span className="lb-component-operation-icon">
              <ProductIcon name={operationIconFor(operation)} size={21} />
            </span>
            <OperationRow
              actionLabel={localized({ en: 'Details', 'pt-BR': 'Detalhes' }, locale)}
              detail={localized(operation.expectedDirection, locale)}
              name={localized(operation.name, locale)}
              onInspect={() => onNavigate?.('operation', operation.id)}
              risk={riskForDesignSystem(operation.riskClass)}
              riskLabel={riskLabelFor(operation.riskClass, locale)}
            />
            <div className="lb-component-operation-controls">
              <span className="lb-component-operation-info">
                <button
                  aria-describedby={`operation-tooltip-${operation.id}`}
                  aria-label={localized(
                    {
                      en: `What ${operation.name.en} does`,
                      'pt-BR': `O que ${operation.name['pt-BR']} faz`,
                    },
                    locale,
                  )}
                  onClick={() => onNavigate?.('operation', operation.id)}
                  type="button"
                >
                  <ProductIcon name="info" size={17} />
                </button>
                <span
                  className="lb-component-operation-tooltip"
                  id={`operation-tooltip-${operation.id}`}
                  role="tooltip"
                >
                  <strong>{localized({ en: 'What it does', 'pt-BR': 'O que faz' }, locale)}</strong>
                  <span>{localized(operation.purpose, locale)}</span>
                  <small>
                    {exclusionReasonFor(operation, locale) ??
                      localized(operation.compatibility, locale)}
                  </small>
                </span>
              </span>
              <LbSwitch
                isDisabled={operation.eligibility === 'excluded'}
                isSelected={selectedOperationIds.has(operation.id)}
                onChange={(selected) => {
                  updateSelection(operation.id, selected);
                }}
              >
                <span className="lb-component-switch-copy">
                  <strong>
                    {operation.eligibility === 'excluded'
                      ? localized({ en: 'Unavailable', 'pt-BR': 'Indisponível' }, locale)
                      : selectedOperationIds.has(operation.id)
                        ? localized({ en: 'Enabled', 'pt-BR': 'Ativado' }, locale)
                        : localized({ en: 'Disabled', 'pt-BR': 'Desativado' }, locale)}
                  </strong>
                  <small>
                    {localized(
                      {
                        en: 'In this preview',
                        'pt-BR': 'Nesta prévia',
                      },
                      locale,
                    )}
                  </small>
                </span>
              </LbSwitch>
            </div>
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
          <strong className="lb-component-selected-count">
            {selectedOperations.length}{' '}
            {localized(
              {
                en:
                  selectedOperations.length === 1 ? 'adjustment selected' : 'adjustments selected',
                'pt-BR':
                  selectedOperations.length === 1 ? 'ajuste selecionado' : 'ajustes selecionados',
              },
              locale,
            )}
          </strong>
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
            isDisabled={selectedOperations.length === 0}
            onPress={() => onNavigate?.('plan-review', 'recommended-plan')}
            variant="primary"
          >
            {localized(
              { en: 'Review selected plan', 'pt-BR': 'Revisar plano selecionado' },
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

const AUTHORITY_RISK_ORDER = Object.freeze([
  'verified',
  'advanced',
  'experimental',
  'extreme-locked',
] as const satisfies readonly RiskClassJson[]);

const authorityRiskLevel = (risk: RiskClassJson): RiskLevel =>
  risk === 'extreme-locked' ? 'extreme' : risk;

const authorityRiskLabel = (risk: RiskClassJson, locale: ShellLocale): string => {
  const labels = {
    advanced: { en: 'Advanced', 'pt-BR': 'Avançado' },
    experimental: { en: 'Experimental', 'pt-BR': 'Experimental' },
    'extreme-locked': { en: 'Extreme', 'pt-BR': 'Extremo' },
    verified: { en: 'Verified', 'pt-BR': 'Verificado' },
  } satisfies Record<RiskClassJson, LocalizedCopy>;
  return localized(labels[risk], locale);
};

const exactStateText = (state: PlanOperationJson['previousValue']): string => {
  if (state.state === 'observed') {
    return `${state.schemeId} · ${state.canonicalStateHash}`;
  }
  return `${state.state}: ${state.reason}`;
};

const approvalMatchesPlan = (snapshot: PlanAuthoritySnapshot): boolean => {
  const { approval, plan } = snapshot;
  return (
    plan !== null &&
    approval !== null &&
    approval.planId === plan.planId &&
    approval.planRevision === plan.revision &&
    approval.revisionFingerprint === plan.revisionFingerprint &&
    approval.evidenceFingerprint === plan.evidenceFingerprint &&
    approval.approvedRisk === plan.effectiveRisk &&
    approval.operationVersionIds.length === plan.operations.length &&
    approval.operationVersionIds.every(
      (operationVersionId, index) =>
        operationVersionId === plan.operations[index]?.operationVersionId,
    )
  );
};

const usePlanAuthoritySnapshot = (authority: PlanAuthority): PlanAuthoritySnapshot => {
  const subscribe = useCallback(
    (listener: Parameters<PlanAuthority['subscribe']>[0]) => authority.subscribe(listener),
    [authority],
  );
  const getSnapshot = useCallback(() => authority.snapshot(), [authority]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const AuthorityStatus = ({
  locale,
  snapshot,
}: {
  readonly locale: ShellLocale;
  readonly snapshot: PlanAuthoritySnapshot;
}) => {
  if (snapshot.status === 'idle') {
    return (
      <div aria-live="polite" role="status">
        <StatusSignal
          detail={localized(
            {
              en: 'Loading the authoritative plan snapshot. The last admitted truth remains unchanged.',
              'pt-BR':
                'Carregando o snapshot autorizado do plano. A última verdade admitida permanece inalterada.',
            },
            locale,
          )}
          locale={locale}
          state="loading"
        />
      </div>
    );
  }
  if (snapshot.status === 'reconnecting' || snapshot.stale) {
    return (
      <div aria-live="assertive" role="status">
        <StatusSignal
          detail={localized(
            {
              en: 'The plan projection is stale. Reconnecting to native authority before any action is admitted.',
              'pt-BR':
                'A projeção do plano está desatualizada. Reconectando à autoridade nativa antes de admitir qualquer ação.',
            },
            locale,
          )}
          locale={locale}
          state="stale"
        />
      </div>
    );
  }
  if (snapshot.status === 'unknown') {
    return (
      <div aria-live="assertive" role="status">
        <StatusSignal
          detail={localized(
            {
              en: 'The result is still unknown. Liiiraa Boost will observe Windows before offering another attempt.',
              'pt-BR':
                'O resultado ainda é desconhecido. O Liiiraa Boost observará o Windows antes de oferecer uma nova tentativa.',
            },
            locale,
          )}
          locale={locale}
          state="critical"
        />
      </div>
    );
  }
  if (snapshot.status === 'error') {
    return (
      <div aria-live="assertive" role="status">
        <StatusSignal
          detail={localized(
            {
              en: 'Native plan authority could not be reached. No operation was authorized; recovery remains available offline.',
              'pt-BR':
                'Não foi possível acessar a autoridade nativa do plano. Nenhuma operação foi autorizada; a recuperação continua disponível offline.',
            },
            locale,
          )}
          locale={locale}
          state="critical"
        />
      </div>
    );
  }
  return null;
};

const AuthorityOperation = ({
  includedCount,
  locale,
  onInclusionChange,
  operation,
}: {
  readonly includedCount: number;
  readonly locale: ShellLocale;
  readonly onInclusionChange: (operationVersionId: string, included: boolean) => void;
  readonly operation: PlanOperationJson;
}) => {
  const blockerId = `operation-${operation.operationVersionId}-blocker`;
  const blocked = operation.compatibility.verdict !== 'compatible';
  const evidence = operation.evidence[0];

  return (
    <article
      className="lb-component-operation"
      data-compatibility={operation.compatibility.verdict}
      data-operation-version={operation.operationVersionId}
    >
      <OperationRow
        actionLabel={localized({ en: 'Review operation', 'pt-BR': 'Revisar operação' }, locale)}
        detail={operation.expectedImpact}
        name={operation.purpose}
        risk={authorityRiskLevel(operation.risk)}
        riskLabel={authorityRiskLabel(operation.risk, locale)}
      />
      <LbSwitch
        aria-describedby={blocked ? blockerId : undefined}
        isDisabled={blocked}
        isSelected
        onChange={(selected) => {
          onInclusionChange(operation.operationVersionId, selected);
        }}
      >
        {localized(
          {
            en: `Included · ${String(includedCount)} selected · ${authorityRiskLabel(operation.risk, locale)} plan`,
            'pt-BR': `Incluída · ${String(includedCount)} selecionadas · plano ${authorityRiskLabel(operation.risk, locale)}`,
          },
          locale,
        )}
      </LbSwitch>
      {blocked ? <p id={blockerId}>{operation.compatibility.reasons.join(' · ')}</p> : null}
      <OperationInspector
        operation={operation.purpose}
        operationLabel={localized({ en: 'Operation', 'pt-BR': 'Operação' }, locale)}
      >
        <dl className="lb-receipt-details">
          <div>
            <dt>{localized({ en: 'Operation version', 'pt-BR': 'Versão da operação' }, locale)}</dt>
            <dd>
              <code>{operation.operationVersionId}</code>
            </dd>
          </div>
          <div>
            <dt>{localized({ en: 'Purpose', 'pt-BR': 'Objetivo' }, locale)}</dt>
            <dd>{operation.purpose}</dd>
          </div>
          <div>
            <dt>{localized({ en: 'Expected impact', 'pt-BR': 'Impacto esperado' }, locale)}</dt>
            <dd>{operation.expectedImpact}</dd>
          </div>
          <div>
            <dt>{localized({ en: 'Immutable risk', 'pt-BR': 'Risco imutável' }, locale)}</dt>
            <dd>{authorityRiskLabel(operation.risk, locale)}</dd>
          </div>
          <div>
            <dt>
              {localized({ en: 'Evidence and freshness', 'pt-BR': 'Evidência e validade' }, locale)}
            </dt>
            <dd>{`${evidence.evidenceId} · ${evidence.quality} · ${evidence.capturedAt} → ${evidence.validUntil}`}</dd>
          </div>
          <div>
            <dt>{localized({ en: 'Compatibility', 'pt-BR': 'Compatibilidade' }, locale)}</dt>
            <dd>{`${operation.compatibility.verdict} · ${operation.compatibility.reasons.join(' · ')}`}</dd>
          </div>
          <div>
            <dt>
              {localized({ en: 'Restart effect', 'pt-BR': 'Efeito de reinicialização' }, locale)}
            </dt>
            <dd>{operation.restartEffect}</dd>
          </div>
          <div>
            <dt>
              {localized({ en: 'Exact prior value', 'pt-BR': 'Valor anterior exato' }, locale)}
            </dt>
            <dd>
              <code>{exactStateText(operation.previousValue)}</code>
            </dd>
          </div>
          <div>
            <dt>{localized({ en: 'Requested value', 'pt-BR': 'Valor solicitado' }, locale)}</dt>
            <dd>
              <code>{exactStateText(operation.requestedValue)}</code>
            </dd>
          </div>
          <div>
            <dt>
              {localized({ en: 'Dependency group', 'pt-BR': 'Grupo de dependência' }, locale)}
            </dt>
            <dd>
              <code>{operation.dependencyGroupId}</code>
            </dd>
          </div>
          <div>
            <dt>
              {localized({ en: 'Recovery method', 'pt-BR': 'Método de recuperação' }, locale)}
            </dt>
            <dd>{operation.recoveryMethod}</dd>
          </div>
        </dl>
      </OperationInspector>
    </article>
  );
};

const stageIndex = (state: NonNullable<PlanAuthoritySnapshot['progress']>['state']): number => {
  const indexes = {
    applying: 1,
    'awaiting-restart': 2,
    blocked: 2,
    completed: 4,
    observing: 2,
    paused: 1,
    preparing: 0,
    queued: 0,
    recovering: 2,
    verifying: 3,
  } as const;
  return indexes[state];
};

const AuthorityExecution = ({
  authority,
  locale,
  onCancelSafely,
  receipt,
  snapshot,
}: {
  readonly authority: PlanAuthority;
  readonly locale: ShellLocale;
  readonly onCancelSafely?: (transactionId: string) => void;
  readonly receipt?: TransactionReceiptDocumentJson;
  readonly snapshot: PlanAuthoritySnapshot;
}) => {
  const { progress, transactionId } = snapshot;
  useEffect(() => {
    if (transactionId === null) return undefined;
    let active = true;
    let detach = (): void => undefined;
    void authority.reconnect(transactionId);
    void authority.subscribeExecution({ transactionId }).then((result) => {
      if (active && result.ok) detach = result.value;
      else if (result.ok) result.value();
    });
    return () => {
      active = false;
      detach();
    };
  }, [authority, transactionId]);

  if (progress === null || transactionId === null) return null;
  const currentIndex = stageIndex(progress.state);
  const labels =
    locale === 'pt-BR'
      ? [
          'Preparando recuperação',
          'Aplicando',
          'Observando o Windows',
          'Verificando resultado',
          'Comprovante verificado',
        ]
      : [
          'Preparing recovery',
          'Applying',
          'Observing Windows',
          'Verifying result',
          'Verified receipt',
        ];
  const stages = labels.map((label, index) => ({
    id: `stage-${String(index)}`,
    label,
    state:
      index < currentIndex
        ? ('complete' as const)
        : index === currentIndex
          ? ('current' as const)
          : ('pending' as const),
    ...(index === currentIndex ? { detail: progress.displayText } : {}),
    ...(index === currentIndex
      ? { timestamp: 'updatedAt' in progress ? progress.updatedAt : progress.occurredAt }
      : {}),
  }));

  return (
    <section
      aria-label={localized({ en: 'Execution workspace', 'pt-BR': 'Área de execução' }, locale)}
    >
      <ExecutionTimeline
        currentStageId={`stage-${String(currentIndex)}`}
        locale={locale}
        stages={stages}
      />
      {progress.state === 'completed' && receipt === undefined ? (
        <StatusSignal
          detail={localized(
            {
              en: 'Verified receipt pending. Completion is not claimed until the immutable receipt is available.',
              'pt-BR':
                'Comprovante verificado pendente. A conclusão não é declarada até o comprovante imutável estar disponível.',
            },
            locale,
          )}
          locale={locale}
          state="warning"
        />
      ) : null}
      {receipt !== undefined ? (
        <>
          <h2>
            {localized(
              { en: 'Plan applied and verified', 'pt-BR': 'Plano aplicado e verificado' },
              locale,
            )}
          </h2>
          <VerifiedReceiptDetails
            details={{
              completedAt: receipt.completedAt,
              diagnosticIdentity: snapshot.diagnostic?.exportId ?? 'not-exported',
              journalCorrelation: receipt.journalHeadHash,
              observedState: exactStateText(receipt.exactObservedState),
              operationVersion: receipt.operationVersionId,
              priorState: exactStateText(receipt.exactPriorState),
              recoveryMethod: receipt.recoveryMethod,
              requestedState: exactStateText(receipt.exactRequestedState),
              startedAt: snapshot.transaction?.startedAt ?? receipt.completedAt,
              transactionId: receipt.transactionId,
            }}
            locale={locale}
            receiptId={receipt.receiptId}
            summary={receipt.humanSummary}
            verification={localized(
              { en: 'Observed state verified', 'pt-BR': 'Estado observado verificado' },
              locale,
            )}
          />
        </>
      ) : null}
      {progress.state === 'awaiting-restart' ? (
        <RestartPlanner>
          <LbButton variant="secondary">
            {localized({ en: 'Restart later', 'pt-BR': 'Reiniciar depois' }, locale)}
          </LbButton>
          <LbButton variant="primary">
            {localized(
              { en: 'Open restart plan', 'pt-BR': 'Abrir plano de reinicialização' },
              locale,
            )}
          </LbButton>
        </RestartPlanner>
      ) : null}
      {onCancelSafely === undefined ? (
        <button
          aria-describedby="cancel-safe-blocker"
          className="lb-button"
          data-lb-control
          data-lb-variant="secondary"
          disabled
          type="button"
        >
          {localized({ en: 'Cancel safely', 'pt-BR': 'Cancelar com segurança' }, locale)}
        </button>
      ) : (
        <LbButton
          onPress={() => {
            onCancelSafely(transactionId);
          }}
          variant="secondary"
        >
          {localized({ en: 'Cancel safely', 'pt-BR': 'Cancelar com segurança' }, locale)}
        </LbButton>
      )}
      {onCancelSafely === undefined ? (
        <p id="cancel-safe-blocker">
          {localized(
            {
              en: 'Safe-boundary cancellation is unavailable in the current native authority. No new operation is requested.',
              'pt-BR':
                'O cancelamento no limite seguro não está disponível na autoridade nativa atual. Nenhuma nova operação é solicitada.',
            },
            locale,
          )}
        </p>
      ) : null}
    </section>
  );
};

const AuthoritativeImproveSurface = ({
  approvalProofReference,
  authority,
  evidenceReferences = [],
  goalReferences = [],
  locale,
  onCancelSafely,
  validatedDocuments = [],
  view,
}: ImproveSurfaceProps & Readonly<{ authority: PlanAuthority }>) => {
  const snapshot = usePlanAuthoritySnapshot(authority);
  const diffHeadingRef = useRef<HTMLHeadingElement>(null);
  const [experimentalPhrase, setExperimentalPhrase] = useState('');
  const { approval, plan } = snapshot;
  const approvalValid = approvalMatchesPlan(snapshot);
  const hasStaleApproval = approval !== null && plan !== null && !approvalValid;
  const receipt = validatedDocuments.find(
    (document): document is TransactionReceiptDocumentJson =>
      document.kind === 'transaction-receipt' && document.transactionId === snapshot.transactionId,
  );

  useEffect(() => {
    if (hasStaleApproval) diffHeadingRef.current?.focus();
  }, [hasStaleApproval, plan?.revision]);

  if (plan === null) {
    return (
      <main data-authority-origin={snapshot.origin} data-improve-view={view}>
        <RouteHeader
          purpose={localized(
            {
              en: "Refresh this PC's evidence and choose your goals to generate a plan.",
              'pt-BR': 'Atualize as evidências do PC e escolha seus objetivos para gerar um plano.',
            },
            locale,
          )}
          title={localized({ en: 'No plan is ready', 'pt-BR': 'Nenhum plano pronto' }, locale)}
        />
        <AuthorityStatus locale={locale} snapshot={snapshot} />
        <LbButton
          isDisabled={snapshot.status !== 'ready' && snapshot.status !== 'idle'}
          onPress={() => {
            void authority.compose({
              request: { goalReferences, evidenceReferences, riskCeiling: 'verified' },
            });
          }}
          variant="primary"
        >
          {localized({ en: 'Generate safe plan', 'pt-BR': 'Gerar plano seguro' }, locale)}
        </LbButton>
      </main>
    );
  }

  const blockedByCompatibility = plan.operations.some(
    (operationValue) => operationValue.compatibility.verdict !== 'compatible',
  );
  const mutationBlocked =
    snapshot.stale ||
    snapshot.status !== 'ready' ||
    blockedByCompatibility ||
    plan.lifecycle === 'blocked' ||
    plan.effectiveRisk === 'extreme-locked';
  const proofRequired = plan.effectiveRisk !== 'verified';
  const phraseRequired = plan.effectiveRisk === 'experimental';
  const expectedPhrase =
    locale === 'pt-BR' ? 'APLICAR PLANO EXPERIMENTAL' : 'APPLY EXPERIMENTAL PLAN';
  const confirmationBlocked =
    mutationBlocked ||
    (proofRequired && approvalProofReference === undefined) ||
    (phraseRequired && experimentalPhrase !== expectedPhrase);
  const applyBlocked = mutationBlocked || !approvalValid;
  const evidenceState = snapshot.stale ? 'stale' : blockedByCompatibility ? 'blocked' : 'current';

  const requestRevision = (changeReference: string): void => {
    void authority.revise({
      request: {
        planId: plan.planId,
        planRevision: plan.revision,
        changeReferences: [changeReference],
      },
    });
  };

  return (
    <main
      aria-label={localized({ en: 'Improve workspace', 'pt-BR': 'Área de melhoria' }, locale)}
      data-authority-origin={snapshot.origin}
      data-improve-view={view}
      data-locale={locale}
    >
      <RouteHeader
        purpose={localized(
          {
            en: 'Review immutable evidence, exact changes, risk, and recovery before requesting an operation.',
            'pt-BR':
              'Revise evidências imutáveis, mudanças exatas, risco e recuperação antes de solicitar uma operação.',
          },
          locale,
        )}
        title={localized({ en: 'Optimization', 'pt-BR': 'Otimização' }, locale)}
      />
      <AuthorityStatus locale={locale} snapshot={snapshot} />
      <div className="lb-transaction-layout">
        <section aria-label={localized({ en: 'Plan review', 'pt-BR': 'Revisão do plano' }, locale)}>
          <PlanRevisionSummary
            action={
              <span>
                {localized(
                  {
                    en: 'Next safe action: review every included operation.',
                    'pt-BR': 'Próxima ação segura: revisar cada operação incluída.',
                  },
                  locale,
                )}
              </span>
            }
            approvalValid={approvalValid}
            evidenceFingerprint={plan.evidenceFingerprint}
            evidenceState={evidenceState}
            extremeExplanation={localized(
              {
                en: 'Extreme operations remain visible for explanation only.',
                'pt-BR': 'Operações Extremas permanecem visíveis apenas para explicação.',
              },
              locale,
            )}
            highestRisk={authorityRiskLevel(plan.effectiveRisk)}
            locale={locale}
            operationCount={plan.operations.length}
            recoveryReady={approval?.recoveryCoverage === 'ready'}
            revisionId={`${plan.planId} · revision ${String(plan.revision)}`}
          />

          <LbRadioGroup
            label={localized(
              { en: 'Maximum risk ceiling', 'pt-BR': 'Limite máximo de risco' },
              locale,
            )}
            onChange={(risk) => {
              if (
                risk !== 'extreme-locked' &&
                AUTHORITY_RISK_ORDER.includes(risk as RiskClassJson)
              ) {
                requestRevision(`risk-ceiling:${risk}`);
              }
            }}
            options={AUTHORITY_RISK_ORDER.filter((risk) => risk !== 'extreme-locked').map(
              (risk) => ({
                label: authorityRiskLabel(risk, locale),
                value: risk,
              }),
            )}
            value={plan.riskCeiling === 'extreme-locked' ? 'experimental' : plan.riskCeiling}
          />
          <p>
            {localized(
              {
                en: 'The maximum risk ceiling never selects operations automatically.',
                'pt-BR': 'O limite máximo de risco nunca seleciona operações automaticamente.',
              },
              locale,
            )}
          </p>

          {AUTHORITY_RISK_ORDER.map((risk) => {
            const operations = plan.operations.filter(
              (operationValue) => operationValue.risk === risk,
            );
            if (operations.length === 0) return null;
            return (
              <section aria-labelledby={`risk-${risk}`} data-risk-group={risk} key={risk}>
                <h2 id={`risk-${risk}`}>{authorityRiskLabel(risk, locale)}</h2>
                {plan.dependencyGroups.map((group) => {
                  const groupOperations = group.operationVersionIds
                    .map((id) =>
                      operations.find((operationValue) => operationValue.operationVersionId === id),
                    )
                    .filter(
                      (operationValue): operationValue is PlanOperationJson =>
                        operationValue !== undefined,
                    );
                  if (groupOperations.length === 0) return null;
                  return (
                    <section
                      aria-labelledby={`group-${group.dependencyGroupId}`}
                      key={group.dependencyGroupId}
                    >
                      <h3 id={`group-${group.dependencyGroupId}`}>{group.dependencyGroupId}</h3>
                      <p>
                        {localized(
                          { en: 'Apply order preserved', 'pt-BR': 'Ordem de aplicação preservada' },
                          locale,
                        )}
                      </p>
                      {groupOperations.map((operationValue) => (
                        <AuthorityOperation
                          includedCount={plan.operations.length}
                          key={operationValue.operationVersionId}
                          locale={locale}
                          onInclusionChange={(operationVersionId, included) => {
                            requestRevision(
                              `${included ? 'include' : 'exclude'}:${operationVersionId}`,
                            );
                          }}
                          operation={operationValue}
                        />
                      ))}
                    </section>
                  );
                })}
              </section>
            );
          })}

          {hasStaleApproval ? (
            <section aria-labelledby="approval-diff-heading" className="lb-approval-diff">
              <h2 id="approval-diff-heading" ref={diffHeadingRef} tabIndex={-1}>
                {localized(
                  {
                    en: 'The plan changed after approval',
                    'pt-BR': 'O plano mudou desde a aprovação',
                  },
                  locale,
                )}
              </h2>
              <p>
                {localized(
                  {
                    en: 'Review the differences before confirming again.',
                    'pt-BR': 'Revise as diferenças antes de confirmar novamente.',
                  },
                  locale,
                )}
              </p>
              <dl>
                <div>
                  <dt>
                    {localized({ en: 'Approved revision', 'pt-BR': 'Revisão aprovada' }, locale)}
                  </dt>
                  <dd>{String(approval.planRevision)}</dd>
                </div>
                <div>
                  <dt>{localized({ en: 'Current revision', 'pt-BR': 'Revisão atual' }, locale)}</dt>
                  <dd>{String(plan.revision)}</dd>
                </div>
                <div>
                  <dt>
                    {localized(
                      { en: 'Approved fingerprint', 'pt-BR': 'Fingerprint aprovado' },
                      locale,
                    )}
                  </dt>
                  <dd>
                    <code>{approval.revisionFingerprint}</code>
                  </dd>
                </div>
                <div>
                  <dt>
                    {localized({ en: 'Current fingerprint', 'pt-BR': 'Fingerprint atual' }, locale)}
                  </dt>
                  <dd>
                    <code>{plan.revisionFingerprint}</code>
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          {plan.effectiveRisk !== 'extreme-locked' && !approvalValid ? (
            <section aria-labelledby="confirmation-heading">
              <h2 id="confirmation-heading">
                {localized(
                  { en: 'Fresh plan approval', 'pt-BR': 'Nova aprovação do plano' },
                  locale,
                )}
              </h2>
              {proofRequired ? (
                <StatusSignal
                  detail={
                    approvalProofReference === undefined
                      ? localized(
                          {
                            en: 'Fresh strong authentication is pending.',
                            'pt-BR': 'A autenticação forte atual está pendente.',
                          },
                          locale,
                        )
                      : localized(
                          {
                            en: 'Fresh strong-auth proof reference received.',
                            'pt-BR': 'Referência atual de autenticação forte recebida.',
                          },
                          locale,
                        )
                  }
                  locale={locale}
                  state={approvalProofReference === undefined ? 'warning' : 'success'}
                />
              ) : null}
              {phraseRequired ? (
                <label>
                  <span>{expectedPhrase}</span>
                  <input
                    autoComplete="off"
                    onChange={(event) => {
                      setExperimentalPhrase(event.currentTarget.value);
                    }}
                    spellCheck={false}
                    type="text"
                    value={experimentalPhrase}
                  />
                </label>
              ) : null}
              {confirmationBlocked ? (
                <button
                  aria-describedby="plan-confirmation-blocker"
                  className="lb-button"
                  data-lb-control
                  data-lb-variant="primary"
                  disabled
                  type="button"
                >
                  {localized(
                    { en: 'Apply verified plan', 'pt-BR': 'Aplicar plano verificado' },
                    locale,
                  )}
                </button>
              ) : (
                <LbButton
                  onPress={() => {
                    void authority.approve({
                      request: {
                        planId: plan.planId,
                        planRevision: plan.revision,
                        intent: 'apply',
                        proofReference: approvalProofReference ?? 'verified-local-review',
                      },
                    });
                  }}
                  variant="primary"
                >
                  {localized(
                    { en: 'Apply verified plan', 'pt-BR': 'Aplicar plano verificado' },
                    locale,
                  )}
                </LbButton>
              )}
              {confirmationBlocked ? (
                <p id="plan-confirmation-blocker">
                  {localized(
                    {
                      en: 'Approval is blocked until evidence, compatibility, recovery, and proportional confirmation are current.',
                      'pt-BR':
                        'A aprovação fica bloqueada até evidência, compatibilidade, recuperação e confirmação proporcional estarem atuais.',
                    },
                    locale,
                  )}
                </p>
              ) : null}
            </section>
          ) : null}

          {plan.effectiveRisk !== 'extreme-locked' && approvalValid && approval !== null ? (
            <section aria-labelledby="apply-heading">
              <h2 id="apply-heading">
                {localized(
                  { en: 'Apply reviewed plan', 'pt-BR': 'Aplicar plano revisado' },
                  locale,
                )}
              </h2>
              {applyBlocked ? (
                <button
                  aria-describedby="plan-apply-blocker"
                  className="lb-button"
                  data-lb-control
                  data-lb-variant="primary"
                  disabled
                  type="button"
                >
                  {localized(
                    { en: 'Apply verified plan', 'pt-BR': 'Aplicar plano verificado' },
                    locale,
                  )}
                </button>
              ) : (
                <LbButton
                  onPress={() => {
                    void authority.apply({
                      request: {
                        planId: plan.planId,
                        planRevision: plan.revision,
                        approvalId: approval.approvalId,
                      },
                    });
                  }}
                  variant="primary"
                >
                  {localized(
                    { en: 'Apply verified plan', 'pt-BR': 'Aplicar plano verificado' },
                    locale,
                  )}
                </LbButton>
              )}
              {applyBlocked ? (
                <p id="plan-apply-blocker">
                  {localized(
                    {
                      en: 'Apply is blocked by stale or incomplete authority.',
                      'pt-BR':
                        'A aplicação está bloqueada por autoridade desatualizada ou incompleta.',
                    },
                    locale,
                  )}
                </p>
              ) : null}
            </section>
          ) : null}
          {hasStaleApproval ? (
            <>
              <button
                aria-describedby="plan-apply-blocker"
                className="lb-button"
                data-lb-control
                data-lb-variant="primary"
                disabled
                type="button"
              >
                {localized(
                  { en: 'Apply verified plan', 'pt-BR': 'Aplicar plano verificado' },
                  locale,
                )}
              </button>
              <p id="plan-apply-blocker">
                {localized(
                  {
                    en: 'Apply is blocked until this revision receives fresh approval.',
                    'pt-BR': 'A aplicação está bloqueada até esta revisão receber nova aprovação.',
                  },
                  locale,
                )}
              </p>
            </>
          ) : null}
        </section>

        <aside
          aria-label={localized({ en: 'Safety summary', 'pt-BR': 'Resumo de segurança' }, locale)}
        >
          <LbPanel
            label={localized(
              { en: 'Protected authority', 'pt-BR': 'Autoridade protegida' },
              locale,
            )}
          >
            <p>{`${localized({ en: 'Device', 'pt-BR': 'Dispositivo' }, locale)}: ${plan.device.deviceBindingId}`}</p>
            <p>{`${localized({ en: 'Lifecycle', 'pt-BR': 'Ciclo de vida' }, locale)}: ${plan.lifecycle}`}</p>
            <LbButton onPress={() => undefined} variant="secondary">
              {localized(
                { en: 'Open Recovery Center', 'pt-BR': 'Abrir Central de Recuperação' },
                locale,
              )}
            </LbButton>
          </LbPanel>
        </aside>
      </div>
      <AuthorityExecution
        authority={authority}
        locale={locale}
        {...(onCancelSafely === undefined ? {} : { onCancelSafely })}
        {...(receipt === undefined ? {} : { receipt })}
        snapshot={snapshot}
      />
    </main>
  );
};

export const ImproveSurface = ({
  approvalProofReference,
  authority,
  evidenceReferences,
  goalReferences,
  locale,
  onCancelSafely,
  onNavigate,
  onRiskPolicyChange,
  scenarioId,
  selectedComponent = 'cpu-power',
  selectedGoal = 'performance',
  selectedOperationId,
  validatedDocuments,
  view,
}: ImproveSurfaceProps) => {
  if (authority !== undefined) {
    return (
      <AuthoritativeImproveSurface
        {...(approvalProofReference === undefined ? {} : { approvalProofReference })}
        authority={authority}
        {...(evidenceReferences === undefined ? {} : { evidenceReferences })}
        {...(goalReferences === undefined ? {} : { goalReferences })}
        locale={locale}
        {...(onCancelSafely === undefined ? {} : { onCancelSafely })}
        {...(validatedDocuments === undefined ? {} : { validatedDocuments })}
        scenarioId={scenarioId}
        view={view}
      />
    );
  }
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

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { RealProductStage, StatusSignal } from './home-web-components';
import { validateWebDocument } from '@liiiraa/web-core';
import type { ReactNode } from 'react';

import homeEnJson from '../content/public/home.en.json';
import homePtBrJson from '../content/public/home.pt-BR.json';
import { publicBoundaryHref } from '../public-boundary';
import { PublicProductIcon } from '../public-product-icon';
import { getPublicCatalog } from './public-catalog';

export type HomeLocale = 'pt-BR' | 'en';

type HomeEvidence = Readonly<{
  applicableVersion: string;
  provenance: Readonly<{
    kind: string;
    observedAt: string;
    source: string;
    value: string;
  }>;
  scope: string;
  source: string;
  unproven: boolean;
  validationState: string;
}>;

export type HomeChapter = Readonly<{
  claim: string;
  evidenceIndex: number;
  id: 'prepare' | 'prove' | 'restore' | 'compatibility' | 'decisions' | 'releases';
  summary: string;
  title: string;
  unprovenBoundary: string;
}>;

export type HomeClaimRecord = Readonly<{
  chapter: HomeChapter;
  evidence: HomeEvidence;
}>;

type HomeProductStage = Readonly<{
  alt: string;
  assetId: string;
  expectedPath: string;
  fullScreenshotLabel: string;
  provenanceLabel: string;
  provenanceSummary: string;
  scenarioId: string;
  sidecarPath: string;
  unavailableBody: string;
  unavailableTitle: string;
}>;

export type HomeLocaleRecord = Readonly<{
  availability: string;
  body: string;
  chapters: readonly HomeChapter[];
  document: Readonly<{
    channel: string;
    evidence: readonly HomeEvidence[];
    indexing: string;
    locale: HomeLocale;
    owner: string;
    routeId: string;
    validationState: string;
    version: string;
  }>;
  finalJourney: Readonly<{
    actionLabel: string;
    body: string;
    distributionNote: string;
    routeId: string;
    title: string;
  }>;
  hero: Readonly<{
    primaryAction: Readonly<{ label: string; routeId: string }>;
    promise: string;
    secondaryAction: Readonly<{ label: string; routeId: string }>;
    summary: string;
    trustBoundary: Readonly<{ body: string; title: string }>;
  }>;
  metadata: Readonly<{
    description: string;
    socialImageId: string;
    title: string;
  }>;
  productStage: HomeProductStage;
  summary: string;
  title: string;
  translationKey: string;
  warnings: readonly string[];
}>;

type CaptureFailureCode =
  'CAPTURE_MISSING' | 'CHECKSUM_MISMATCH' | 'PROVENANCE_INVALID' | 'PROVENANCE_MISMATCH';

export type HomeCaptureAdmission =
  | Readonly<{
      code: 'CAPTURE_ADMITTED';
      height: number;
      href: string;
      ok: true;
      provenance: string;
      src: string;
      width: number;
    }>
  | Readonly<{
      code: CaptureFailureCode;
      ok: false;
    }>;

const PRODUCT_CAPTURE_DIRECTORY = join(process.cwd(), 'public', 'product');

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const admitHomeRecord = (candidate: unknown, locale: HomeLocale): HomeLocaleRecord => {
  if (!isObject(candidate) || !isObject(candidate['document'])) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:record`);
  }

  const validation = validateWebDocument(candidate['document']);
  if (!validation.ok || !('routeId' in validation.value)) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:document`);
  }

  if (
    validation.value.routeId !== 'public-home' ||
    validation.value.locale !== locale ||
    validation.value.owner !== 'public-content' ||
    validation.value.indexing !== 'index' ||
    validation.value.validationState !== 'validated'
  ) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:authority`);
  }

  if (!Array.isArray(candidate['chapters'])) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:chapters`);
  }

  const record = candidate as unknown as HomeLocaleRecord;
  if (
    record.translationKey !== 'public-home' ||
    record.chapters.length !== record.document.evidence.length ||
    record.hero.primaryAction.routeId !== 'public-compatibility' ||
    record.finalJourney.routeId !== 'public-compatibility'
  ) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:contract`);
  }

  for (const chapter of record.chapters) {
    const evidence = record.document.evidence[chapter.evidenceIndex];
    if (
      evidence?.applicableVersion !== record.document.version ||
      evidence.validationState !== 'validated' ||
      evidence.unproven ||
      chapter.unprovenBoundary.trim().length === 0
    ) {
      throw new Error(`HOME_CONTENT_INVALID:${locale}:evidence:${chapter.id}`);
    }
  }

  return record;
};

const HOME_CONTENT = Object.freeze({
  en: admitHomeRecord(homeEnJson, 'en'),
  'pt-BR': admitHomeRecord(homePtBrJson, 'pt-BR'),
});

export const getHomeContent = (locale: HomeLocale): HomeLocaleRecord => HOME_CONTENT[locale];

export const getHomeClaims = (locale: HomeLocale): readonly HomeClaimRecord[] => {
  const content = getHomeContent(locale);
  return content.chapters.map((chapter) => {
    const evidence = content.document.evidence[chapter.evidenceIndex];
    if (evidence === undefined) {
      throw new Error(`HOME_CONTENT_INVALID:${locale}:evidence:${chapter.id}`);
    }
    return { chapter, evidence };
  });
};

const viewportDimensions = (
  viewport: string,
): Readonly<{ height: number; width: number }> | undefined => {
  const match = /^(?<width>[1-9]\d{2,4})x(?<height>[1-9]\d{2,4})$/u.exec(viewport);
  const width = Number(match?.groups?.['width']);
  const height = Number(match?.groups?.['height']);
  return Number.isInteger(width) && Number.isInteger(height) ? { height, width } : undefined;
};

export const resolveHomeProductCapture = async (
  locale: HomeLocale,
  captureDirectory = PRODUCT_CAPTURE_DIRECTORY,
): Promise<HomeCaptureAdmission> => {
  const content = getHomeContent(locale);
  const imageName = content.productStage.expectedPath.split('/').at(-1);
  const sidecarName = content.productStage.sidecarPath.split('/').at(-1);
  if (imageName === undefined || sidecarName === undefined) {
    return { code: 'PROVENANCE_MISMATCH', ok: false };
  }

  let image: Buffer;
  let sidecar: unknown;
  try {
    [image, sidecar] = await Promise.all([
      readFile(join(captureDirectory, imageName)),
      readFile(join(captureDirectory, sidecarName), 'utf8').then(
        (source) => JSON.parse(source) as unknown,
      ),
    ]);
  } catch {
    return { code: 'CAPTURE_MISSING', ok: false };
  }

  const validation = validateWebDocument(sidecar);
  if (!validation.ok || !('scenarioId' in validation.value)) {
    return { code: 'PROVENANCE_INVALID', ok: false };
  }

  const provenance = validation.value;
  const dimensions = viewportDimensions(provenance.viewport);
  if (
    provenance.locale !== locale ||
    provenance.version !== content.document.version ||
    provenance.scenarioId !== content.productStage.scenarioId ||
    provenance.reviewState !== 'approved' ||
    provenance.sourceCommit.trim().length < 7 ||
    !/(?:desktop|tauri|@liiiraa\/web-evidence.*--capture)/iu.test(provenance.captureCommand) ||
    dimensions === undefined
  ) {
    return { code: 'PROVENANCE_MISMATCH', ok: false };
  }

  const checksum = createHash('sha256').update(image).digest('hex');
  if (checksum !== provenance.checksum) {
    return { code: 'CHECKSUM_MISMATCH', ok: false };
  }

  const provenanceLabel =
    locale === 'pt-BR'
      ? `Captura aprovada · ${provenance.scenarioId} · ${provenance.viewport} · commit ${provenance.sourceCommit}`
      : `Approved capture · ${provenance.scenarioId} · ${provenance.viewport} · commit ${provenance.sourceCommit}`;

  return {
    code: 'CAPTURE_ADMITTED',
    height: dimensions.height,
    href: content.productStage.expectedPath,
    ok: true,
    provenance: provenanceLabel,
    src: content.productStage.expectedPath,
    width: dimensions.width,
  };
};

const EVIDENCE_LABELS = Object.freeze({
  en: Object.freeze({
    scope: 'Scope',
    source: 'Source',
    unprovenBoundary: 'What remains unproven',
    validationState: 'Validation state',
    version: 'Version',
  }),
  'pt-BR': Object.freeze({
    scope: 'Escopo',
    source: 'Fonte',
    unprovenBoundary: 'O que permanece não comprovado',
    validationState: 'Estado de validação',
    version: 'Versão',
  }),
});

const EvidenceDisclosure = ({
  claim,
  locale,
}: Readonly<{ claim: HomeClaimRecord; locale: HomeLocale }>) => (
  <details className="home-evidence-disclosure">
    <summary>{locale === 'pt-BR' ? 'Inspecionar evidência' : 'Inspect evidence'}</summary>
    <div>
      <p>{claim.chapter.claim}</p>
      <dl>
        <div>
          <dt>{EVIDENCE_LABELS[locale].source}</dt>
          <dd>{claim.evidence.source}</dd>
        </div>
        <div>
          <dt>{EVIDENCE_LABELS[locale].scope}</dt>
          <dd>{claim.evidence.scope}</dd>
        </div>
        <div>
          <dt>{EVIDENCE_LABELS[locale].version}</dt>
          <dd>{claim.evidence.applicableVersion}</dd>
        </div>
        <div>
          <dt>{EVIDENCE_LABELS[locale].validationState}</dt>
          <dd>{locale === 'pt-BR' ? 'Validado' : 'Validated'}</dd>
        </div>
      </dl>
      <p>
        <strong>{EVIDENCE_LABELS[locale].unprovenBoundary}: </strong>
        {claim.chapter.unprovenBoundary}
      </p>
    </div>
  </details>
);

const ProductStageGate = ({
  admission,
  locale,
}: Readonly<{ admission: HomeCaptureAdmission; locale: HomeLocale }>) => {
  const content = getHomeContent(locale);
  if (admission.ok) {
    return (
      <RealProductStage
        alt={content.productStage.alt}
        completeScreenshotHref={admission.href}
        completeScreenshotLabel={content.productStage.fullScreenshotLabel}
        height={admission.height}
        locale={locale}
        provenance={admission.provenance}
        provenanceLabel={content.productStage.provenanceLabel}
        provenanceSummary={content.productStage.provenanceSummary}
        src={admission.src}
        width={admission.width}
      />
    );
  }

  return (
    <aside
      aria-labelledby="home-product-stage-unavailable"
      className="home-product-gate"
      data-evidence-gate={admission.code}
      role="status"
    >
      <div className="home-product-gate__status">
        <StatusSignal
          detail={locale === 'pt-BR' ? 'Nenhum substituto permitido' : 'No substitute allowed'}
          label={locale === 'pt-BR' ? 'Evidência indisponível' : 'Evidence unavailable'}
          state="unavailable"
        />
        <code>{admission.code}</code>
      </div>
      <h2 id="home-product-stage-unavailable">{content.productStage.unavailableTitle}</h2>
      <p>{content.productStage.unavailableBody}</p>
      <p className="home-product-gate__requirement">
        {locale === 'pt-BR'
          ? 'Acesso à captura completa será habilitado junto da imagem real aprovada.'
          : 'Full screenshot access will be enabled with the approved real image.'}
      </p>
    </aside>
  );
};

const HomeAction = ({
  children,
  href,
  primary = false,
}: Readonly<{ children: ReactNode; href: string; primary?: boolean }>) => (
  <a className={primary ? 'home-action home-action--primary' : 'home-action'} href={href}>
    {children}
  </a>
);

const splitHeroPromise = (promise: string): readonly string[] => {
  const lines = promise.match(/[^.]+\./gu)?.map((line) => line.trim()) ?? [];
  if (lines.length !== 3 || lines.join(' ') !== promise) {
    throw new Error('HOME_CONTENT_INVALID:hero-promise');
  }
  return lines;
};

const HOME_SALES_COPY = Object.freeze({
  en: Object.freeze({
    download: 'Download free',
    faq: [
      [
        'Is Free a trial?',
        'No. Essential Mode is free forever, with no card, ads, or daily limits.',
      ],
      [
        'Does it guarantee more FPS?',
        'No. Liiiraa Boost measures your PC and reports only comparable results.',
      ],
      [
        'Can I undo an adjustment?',
        'Yes. History and restoration remain available on Free and Premium.',
      ],
      [
        'Where is PC analysis performed?',
        'In the Windows desktop app. The website never performs deep machine analysis.',
      ],
    ],
    faqTitle: 'Questions worth answering before you install',
    finalBody:
      'Start with Essential Mode. Analyze the PC, review the plan, and decide from your own results.',
    finalTitle: 'Your first result starts free',
    modesLead:
      'Use the essentials manually or let Competitive Mode prepare each game session around your hardware.',
    modesTitle: 'One safe foundation. Two ways to use it.',
    painBody:
      'Background processes, startup weight, power behavior, and generic settings can compete with the game. Liiiraa Boost identifies what matters before changing anything.',
    painTitle: 'Your game should not compete with everything Windows happens to be running.',
    resultsBody:
      'Same PC, same game, visible conditions. Measurements stay separate from estimates and unavailable data.',
    resultsTitle: 'A result is useful only when you can verify it',
    safetyBody:
      'Every reviewed change keeps a trace. Session-specific Competitive actions end with the game and restore the previous state automatically.',
    safetyTitle: 'Performance includes the path back',
    workflowTitle: 'Analyze. Optimize. Prove.',
  }),
  'pt-BR': Object.freeze({
    download: 'Baixar grátis',
    faq: [
      [
        'O Free é um trial?',
        'Não. O Modo Essencial é grátis para sempre, sem cartão, anúncios ou limites diários.',
      ],
      [
        'O app garante mais FPS?',
        'Não. O Liiiraa Boost mede o seu PC e mostra somente resultados comparáveis.',
      ],
      [
        'Posso desfazer um ajuste?',
        'Sim. Histórico e restauração permanecem disponíveis no Free e no Premium.',
      ],
      [
        'Onde o PC é analisado?',
        'No aplicativo desktop para Windows. A web nunca faz análise profunda da máquina.',
      ],
    ],
    faqTitle: 'Perguntas que merecem resposta antes de instalar',
    finalBody:
      'Comece pelo Modo Essencial. Analise o PC, revise o plano e decida usando os seus próprios resultados.',
    finalTitle: 'Seu primeiro resultado começa grátis',
    modesLead:
      'Use o essencial manualmente ou deixe o Modo Competitivo preparar cada sessão de acordo com o seu hardware.',
    modesTitle: 'Uma base segura. Duas formas de usar.',
    painBody:
      'Processos em segundo plano, inicialização pesada, energia e ajustes genéricos podem disputar recursos com o jogo. O Liiiraa Boost identifica o que importa antes de mudar qualquer coisa.',
    painTitle: 'Seu jogo não deveria disputar recursos com tudo o que o Windows resolveu executar.',
    resultsBody:
      'Mesmo PC, mesmo jogo e condições visíveis. Medições ficam separadas de estimativas e dados indisponíveis.',
    resultsTitle: 'Um resultado só vale quando você consegue conferir',
    safetyBody:
      'Toda mudança revisada deixa um registro. Ações temporárias do Modo Competitivo terminam junto com o jogo e restauram o estado anterior automaticamente.',
    safetyTitle: 'Desempenho também é ter um caminho de volta',
    workflowTitle: 'Analise. Otimize. Comprove.',
  }),
});

const IgnitionHero = ({
  artifact,
  downloadHref,
  lead,
  locale,
  promise,
  proofNote,
  resultsHref,
}: Readonly<{
  artifact: ReactNode;
  downloadHref: string;
  lead: string;
  locale: HomeLocale;
  promise: string;
  proofNote: string;
  resultsHref: string;
}>) => (
  <section className="home-ignition-hero" data-hero-layout="centered-product-stage">
    <div className="home-ignition-hero__copy">
      <p className="home-ignition-hero__eyebrow">
        {locale === 'pt-BR'
          ? 'Liiiraa Boost para Windows 10 e 11'
          : 'Liiiraa Boost for Windows 10 and 11'}
      </p>
      <h1 aria-label={promise} className="home-ignition-hero__promise">
        {splitHeroPromise(promise).map((line) => (
          <span aria-hidden="true" key={line}>
            {line}
          </span>
        ))}
      </h1>
      <p className="home-ignition-hero__lead">{lead}</p>
      <div className="home-ignition-hero__actions">
        <HomeAction href={downloadHref} primary>
          {HOME_SALES_COPY[locale].download}
        </HomeAction>
        <HomeAction href={resultsHref}>
          {locale === 'pt-BR' ? 'Ver resultados' : 'View results'}
        </HomeAction>
      </div>
      <aside className="home-trust-boundary" role="note">
        <p>{proofNote}</p>
      </aside>
    </div>
    <div
      className="home-ignition-hero__stage"
      data-stage-max-top="560"
      data-stage-max-width="1120"
      data-stage-min-visible="260"
      id="product-stage"
    >
      {artifact}
    </div>
    <a className="home-next-movement" href="#player-problem">
      <span>{locale === 'pt-BR' ? 'A seguir' : 'Next'}</span>
      {locale === 'pt-BR' ? 'Por que ajustar com contexto' : 'Why context matters'}
    </a>
  </section>
);

export const CommandRunwayHome = async ({ locale }: Readonly<{ locale: HomeLocale }>) => {
  const content = getHomeContent(locale);
  const claims = getHomeClaims(locale);
  const catalog = getPublicCatalog(locale);
  const capture = await resolveHomeProductCapture(locale);
  const compatibilityHref = publicBoundaryHref('public-compatibility', locale);
  const downloadHref = publicBoundaryHref('public-download', locale);
  const plansHref = publicBoundaryHref('public-plans', locale);
  const resultsHref = publicBoundaryHref('public-results', locale);
  const planRecord = catalog.records.find(({ routeId }) => routeId === 'public-plans');
  const essential = planRecord?.plans?.find(({ id }) => id === 'essential-free');
  const competitive = planRecord?.plans?.find(({ id }) => id === 'competitive-premium');
  const proofClaims = claims.slice(0, 3);
  const proofClaim = proofClaims[1];
  const restoreClaim = claims.find(({ chapter }) => chapter.id === 'restore');
  const heroProofNote = content.warnings[0];
  if (
    proofClaims.length !== 3 ||
    proofClaim === undefined ||
    restoreClaim === undefined ||
    essential === undefined ||
    competitive === undefined ||
    heroProofNote === undefined
  ) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:hero`);
  }

  return (
    <div className="public-home" data-capture-state={capture.code}>
      <IgnitionHero
        artifact={<ProductStageGate admission={capture} locale={locale} />}
        downloadHref={downloadHref}
        lead={content.summary}
        locale={locale}
        promise={content.hero.promise}
        proofNote={heroProofNote}
        resultsHref={resultsHref}
      />

      <section
        aria-labelledby="home-problem-title"
        className="home-player-problem"
        id="player-problem"
      >
        <p>{locale === 'pt-BR' ? 'O problema' : 'The problem'}</p>
        <h2 id="home-problem-title">{HOME_SALES_COPY[locale].painTitle}</h2>
        <p>{HOME_SALES_COPY[locale].painBody}</p>
      </section>

      <section
        aria-labelledby="home-workflow-title"
        className="home-workflow"
        id="prepare-prove-restore"
      >
        <header>
          <p>{locale === 'pt-BR' ? 'Como funciona' : 'How it works'}</p>
          <h2 id="home-workflow-title">{HOME_SALES_COPY[locale].workflowTitle}</h2>
          <span>{content.body}</span>
        </header>
        <ol className="home-proof-sequence">
          {proofClaims.map((claim, index) => (
            <li data-stage={claim.chapter.id} key={claim.chapter.id}>
              <span aria-hidden="true">0{String(index + 1)}</span>
              <div>
                <h3>{claim.chapter.title}</h3>
                <p>{claim.chapter.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="home-modes-title" className="home-mode-split">
        <header>
          <p>{locale === 'pt-BR' ? 'Escolha seu ritmo' : 'Choose your pace'}</p>
          <h2 id="home-modes-title">{HOME_SALES_COPY[locale].modesTitle}</h2>
          <span>{HOME_SALES_COPY[locale].modesLead}</span>
        </header>
        <div className="home-mode-split__plans">
          {[essential, competitive].map((plan) => (
            <article data-plan={plan.id} key={plan.id}>
              <div className="home-mode-split__heading">
                <PublicProductIcon
                  name={plan.id === 'essential-free' ? 'gauge' : 'crown'}
                  size={24}
                  weight="duotone"
                />
                <h3>{plan.name}</h3>
              </div>
              <p className="home-mode-split__price">
                <strong>{plan.price}</strong>
                <span>{plan.billingPeriod}</span>
              </p>
              <ul>
                {plan.capabilities.map(({ name }) => (
                  <li key={name}>
                    <PublicProductIcon name="check" size={17} weight="bold" />
                    {name}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <HomeAction href={plansHref}>
          {locale === 'pt-BR' ? 'Comparar planos' : 'Compare plans'}
        </HomeAction>
      </section>

      <section aria-labelledby="home-results-title" className="home-results-method">
        <div>
          <p>{locale === 'pt-BR' ? 'Sem números inventados' : 'No invented numbers'}</p>
          <h2 id="home-results-title">{HOME_SALES_COPY[locale].resultsTitle}</h2>
          <span>{HOME_SALES_COPY[locale].resultsBody}</span>
          <HomeAction href={resultsHref}>
            {locale === 'pt-BR' ? 'Entender os resultados' : 'Understand results'}
          </HomeAction>
        </div>
        <EvidenceDisclosure claim={proofClaim} locale={locale} />
      </section>

      <section aria-labelledby="home-safety-title" className="home-safety-runway">
        <PublicProductIcon name="recovery" size={32} weight="duotone" />
        <div>
          <p>{locale === 'pt-BR' ? 'Segurança e restauração' : 'Safety and restoration'}</p>
          <h2 id="home-safety-title">{HOME_SALES_COPY[locale].safetyTitle}</h2>
          <span>{HOME_SALES_COPY[locale].safetyBody}</span>
        </div>
        <EvidenceDisclosure claim={restoreClaim} locale={locale} />
      </section>

      <section aria-labelledby="home-faq-title" className="home-faq">
        <h2 id="home-faq-title">{HOME_SALES_COPY[locale].faqTitle}</h2>
        <div>
          {HOME_SALES_COPY[locale].faq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="home-final-title" className="home-final-cta">
        <div>
          <p>Free · {locale === 'pt-BR' ? 'Modo Essencial' : 'Essential Mode'}</p>
          <h2 id="home-final-title">{HOME_SALES_COPY[locale].finalTitle}</h2>
          <span>{HOME_SALES_COPY[locale].finalBody}</span>
        </div>
        <div>
          <HomeAction href={downloadHref} primary>
            {HOME_SALES_COPY[locale].download}
          </HomeAction>
          <HomeAction href={compatibilityHref}>{content.finalJourney.actionLabel}</HomeAction>
        </div>
      </section>
    </div>
  );
};

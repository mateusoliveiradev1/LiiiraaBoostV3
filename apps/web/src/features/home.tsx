import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  CommandRunwayHero,
  RealProductStage,
  StatusSignal,
} from './home-web-components';
import { validateWebDocument } from '@liiiraa/web-core';
import type { ReactNode } from 'react';

import homeEnJson from '../content/public/home.en.json';
import homePtBrJson from '../content/public/home.pt-BR.json';
import { publicBoundaryHref } from '../public-boundary';

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

export const CommandRunwayHome = async ({ locale }: Readonly<{ locale: HomeLocale }>) => {
  const content = getHomeContent(locale);
  const claims = getHomeClaims(locale);
  const capture = await resolveHomeProductCapture(locale);
  const compatibilityHref = publicBoundaryHref('public-compatibility', locale);
  const evidenceHref = publicBoundaryHref('public-evidence', locale);
  const releasesHref = publicBoundaryHref('releases-index', locale);
  const proofClaims = claims.slice(0, 3);
  const compatibilityClaim = claims.find(({ chapter }) => chapter.id === 'compatibility');
  if (compatibilityClaim === undefined) {
    throw new Error(`HOME_CONTENT_INVALID:${locale}:compatibility`);
  }

  return (
    <div className="public-home" data-capture-state={capture.code}>
      <CommandRunwayHero
        artifact={<ProductStageGate admission={capture} locale={locale} />}
        boundary={
          <aside className="home-trust-boundary" role="note">
            <strong>{locale === 'pt-BR' ? 'O limite da promessa' : 'The promise boundary'}</strong>
            <p>{content.warnings[0]}</p>
          </aside>
        }
        cta={
          <>
            <HomeAction href={compatibilityHref} primary>
              {content.hero.primaryAction.label}
            </HomeAction>
            <HomeAction href={evidenceHref}>{content.hero.secondaryAction.label}</HomeAction>
          </>
        }
        promise={content.hero.promise}
        summary={content.hero.summary}
      />

      <section aria-labelledby="home-evidence-title" className="home-evidence-stage">
        <header className="home-evidence-stage__introduction">
          <h2 id="home-evidence-title">
            {locale === 'pt-BR'
              ? 'Desempenho é uma sequência que pode ser revisada'
              : 'Performance is a sequence you can review'}
          </h2>
          <p>{content.body}</p>
        </header>

        <ol className="home-proof-sequence">
          {proofClaims.map((claim, index) => (
            <li data-stage={claim.chapter.id} key={claim.chapter.id}>
              <span aria-hidden="true" className="home-proof-sequence__number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="home-proof-sequence__copy">
                <h3>{claim.chapter.title}</h3>
                <p>{claim.chapter.summary}</p>
              </div>
              <EvidenceDisclosure claim={claim} locale={locale} />
            </li>
          ))}
        </ol>

        <div className="home-compatibility-bridge">
          <div>
            <h2>{compatibilityClaim.chapter.title}</h2>
            <p>{compatibilityClaim.chapter.summary}</p>
          </div>
          <div>
            <HomeAction href={compatibilityHref}>{content.finalJourney.actionLabel}</HomeAction>
            <EvidenceDisclosure claim={compatibilityClaim} locale={locale} />
          </div>
        </div>
      </section>

      <section aria-labelledby="home-release-gate-title" className="home-release-gate">
        <div>
          <StatusSignal
            label={locale === 'pt-BR' ? 'Distribuição bloqueada' : 'Distribution blocked'}
            state="unavailable"
          />
          <h2 id="home-release-gate-title">
            {locale === 'pt-BR'
              ? 'Download público ainda não disponível'
              : 'Public download is not available yet'}
          </h2>
        </div>
        <div>
          <p>{content.warnings[1]}</p>
          <HomeAction href={releasesHref}>
            {locale === 'pt-BR' ? 'Consultar o estado das versões' : 'Review release status'}
          </HomeAction>
        </div>
      </section>
    </div>
  );
};

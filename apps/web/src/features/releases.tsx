import type { ReactNode } from 'react';
import {
  decideDownload,
  matchWebRoute,
  routeHref,
  WEB_CHANNELS,
  WEB_LOCALES,
  WEB_VERSIONS,
  type DownloadBlockedReason,
  type DownloadDecision,
  type WebChannel,
  type WebLocale,
  type WebRouteId,
  type WebVersion,
} from '@liiiraa/web-core';
import {
  ArticleMetadata,
  BoundaryTransitionNotice,
  DownloadAvailabilityGate,
  ManifestFieldList,
  PostDownloadGuide,
  ReleaseChannelSelector,
  ReleaseIntegrityPanel,
  SignatureVerificationGuide,
  StatusSignal,
} from './release-ui';

import releaseEnJson from '../content/releases/releases.en.json';
import releaseMetadataJson from '../content/releases/releases.metadata.json';
import releasePtBrJson from '../content/releases/releases.pt-BR.json';
import { publicBoundaryHref } from '../public-boundary';

type ReleaseContent = typeof releaseEnJson;
type ReleaseMetadata = typeof releaseMetadataJson;

export type ReleaseRouteId = Extract<
  WebRouteId,
  | 'releases-index'
  | 'releases-channel'
  | 'releases-version'
  | 'releases-integrity'
  | 'releases-download'
  | 'releases-install'
>;

export type ReleasePageResolution = Readonly<{
  channel: WebChannel;
  locale: WebLocale;
  routeId: ReleaseRouteId;
  version: WebVersion;
}>;

const RELEASE_ROUTE_IDS = Object.freeze([
  'releases-index',
  'releases-channel',
  'releases-version',
  'releases-integrity',
  'releases-download',
  'releases-install',
] as const satisfies readonly ReleaseRouteId[]);

const RELEASE_NOTE_IDS = Object.freeze([
  'changes',
  'risks',
  'corrections',
  'compatibility',
  'migration',
  'recovery',
] as const);

const VERIFICATION_IDS = Object.freeze([
  'authenticode',
  'sha256',
  'size',
  'version',
  'compatibility',
  'manifest',
] as const);

const BLOCKED_REASONS = Object.freeze([
  'artifact-unavailable',
  'channel-selection-blocked',
  'development-artifact-rejected',
  'distribution-not-approved',
  'historical-release-unavailable',
  'historical-release-unsafe',
  'integrity-disagreement',
  'official-artifact-unavailable',
  'record-invalid',
] as const satisfies readonly DownloadBlockedReason[]);

const MANIFEST_FIELDS = Object.freeze([
  'manifestId',
  'artifactId',
  'channel',
  'version',
  'architecture',
  'windowsLifecycle',
  'compatibility',
  'publisher',
  'sha256',
  'sizeBytes',
  'signatureState',
  'origin',
  'provenance',
  'publicDistributionApproved',
  'artifactAvailable',
] as const);

const FORBIDDEN_ARTIFACT_IDENTITIES = [
  /Liiiraa Boost_0\.0\.0/iu,
  /liiiraa-desktop\.exe/iu,
  /quality\/evidence\/phase-02/iu,
  /target\/release/iu,
  /55D6403DE15473B2A50AE82B7831C457629CC298/iu,
  /18A8E899D7AF432F2BE2F236416D5FA98910D50FC0AC793BA46889B9DF1AF2F0/iu,
  /FEA8FBD9483A26918E41E66CB539B625EE0D48A0A5B6B76CA207DE08E69C021B/iu,
] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasExactIdentity = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && expected.every((entry) => actual.includes(entry));

const deepFreeze = <Value,>(value: Value): Readonly<Value> => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

const admitReleaseMetadata = (candidate: unknown): ReleaseMetadata => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    !isNonEmptyString(candidate['contentVersion']) ||
    !isNonEmptyString(candidate['lastReviewedAt']) ||
    !isRecord(candidate['releaseRecord']) ||
    !isRecord(candidate['demonstrativeManifest']) ||
    !Array.isArray(candidate['history']) ||
    !Array.isArray(candidate['integrityDisagreementFields'])
  ) {
    throw new Error('RELEASE_METADATA_INVALID:root');
  }

  const record = candidate['releaseRecord'];
  if (
    record['channel'] !== 'stable' ||
    record['availability'] !== 'unavailable' ||
    record['publicDistributionApproved'] !== false ||
    record['officialArtifact'] !== 'unavailable' ||
    'artifactEvidence' in record
  ) {
    throw new Error('RELEASE_METADATA_INVALID:generated-record-truth');
  }

  const decision = decideDownload({ record, historyState: 'current' });
  if (decision.status !== 'blocked' || decision.reason !== 'distribution-not-approved') {
    throw new Error('RELEASE_METADATA_INVALID:generated-admission');
  }

  const manifest = candidate['demonstrativeManifest'];
  if (
    manifest['classification'] !== 'demonstrative-not-official' ||
    manifest['publicDistributionApproved'] !== false ||
    manifest['artifactAvailable'] !== false ||
    MANIFEST_FIELDS.some((field) => manifest[field] === undefined)
  ) {
    throw new Error('RELEASE_METADATA_INVALID:demonstrative-boundary');
  }

  const history = candidate['history'];
  if (
    history.length === 0 ||
    history.some(
      (entry) =>
        !isRecord(entry) ||
        !isNonEmptyString(entry['channel']) ||
        !isNonEmptyString(entry['version']) ||
        !isNonEmptyString(entry['historyState']) ||
        !isNonEmptyString(entry['status']) ||
        !isNonEmptyString(entry['sha256']),
    )
  ) {
    throw new Error('RELEASE_METADATA_INVALID:history');
  }

  if (
    !hasExactIdentity(candidate['integrityDisagreementFields'].filter(isNonEmptyString), [
      ...MANIFEST_FIELDS,
      'artifactIdentity',
    ])
  ) {
    throw new Error('RELEASE_METADATA_INVALID:integrity-fields');
  }

  const serialized = JSON.stringify(candidate).replaceAll('\\', '/');
  if (FORBIDDEN_ARTIFACT_IDENTITIES.some((identity) => identity.test(serialized))) {
    throw new Error('RELEASE_METADATA_INVALID:development-artifact-identity');
  }

  return deepFreeze(candidate as unknown as ReleaseMetadata) as ReleaseMetadata;
};

const admitReleaseContent = (candidate: unknown, locale: WebLocale): ReleaseContent => {
  if (
    !isRecord(candidate) ||
    candidate['schemaVersion'] !== 1 ||
    candidate['locale'] !== locale ||
    !isRecord(candidate['metadata']) ||
    !isRecord(candidate['identity']) ||
    !isRecord(candidate['navigation']) ||
    !Array.isArray(candidate['channels']) ||
    !isRecord(candidate['releaseNotes']) ||
    !isRecord(candidate['manifest']) ||
    !isRecord(candidate['verification']) ||
    !isRecord(candidate['history']) ||
    !isRecord(candidate['downloadGate']) ||
    !isRecord(candidate['installation']) ||
    !isRecord(candidate['analytics'])
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:root`);
  }

  const channels = candidate['channels'];
  if (
    !hasExactIdentity(
      channels.flatMap((channel) =>
        isRecord(channel) && isNonEmptyString(channel['id']) ? [channel['id']] : [],
      ),
      WEB_CHANNELS,
    ) ||
    channels.some(
      (channel) =>
        !isRecord(channel) ||
        !isNonEmptyString(channel['name']) ||
        typeof channel['default'] !== 'boolean' ||
        typeof channel['requiresOptIn'] !== 'boolean' ||
        !isNonEmptyString(channel['audience']) ||
        !isNonEmptyString(channel['risk']) ||
        !isNonEmptyString(channel['support']) ||
        !isNonEmptyString(channel['updates']) ||
        !isNonEmptyString(channel['account']),
    )
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:channels`);
  }

  const stable = channels.find((channel) => isRecord(channel) && channel['id'] === 'stable');
  if (
    !isRecord(stable) ||
    stable['default'] !== true ||
    stable['requiresOptIn'] !== false ||
    channels
      .filter((channel) => isRecord(channel) && channel['id'] !== 'stable')
      .some((channel) => !isRecord(channel) || channel['requiresOptIn'] !== true)
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:channel-policy`);
  }

  const notes = candidate['releaseNotes'];
  const noteSections = notes['sections'];
  if (
    !isNonEmptyString(notes['title']) ||
    !isNonEmptyString(notes['summary']) ||
    !Array.isArray(noteSections) ||
    !hasExactIdentity(
      noteSections.flatMap((section) =>
        isRecord(section) && isNonEmptyString(section['id']) ? [section['id']] : [],
      ),
      RELEASE_NOTE_IDS,
    ) ||
    noteSections.some(
      (section) =>
        !isRecord(section) ||
        !isNonEmptyString(section['title']) ||
        !isNonEmptyString(section['body']),
    )
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:release-notes`);
  }

  const verification = candidate['verification'];
  const verificationSteps = verification['steps'];
  if (
    !Array.isArray(verificationSteps) ||
    !hasExactIdentity(
      verificationSteps.flatMap((step) =>
        isRecord(step) && isNonEmptyString(step['id']) ? [step['id']] : [],
      ),
      VERIFICATION_IDS,
    ) ||
    verificationSteps.some(
      (step) =>
        !isRecord(step) || !isNonEmptyString(step['title']) || !isNonEmptyString(step['body']),
    ) ||
    !isNonEmptyString(verification['blocked'])
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:verification`);
  }

  const manifest = candidate['manifest'];
  const manifestCopy = manifest['fields'];
  if (
    !isRecord(manifestCopy) ||
    !hasExactIdentity(Object.keys(manifestCopy), MANIFEST_FIELDS) ||
    Object.values(manifestCopy).some((value) => !isNonEmptyString(value))
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:manifest-fields`);
  }

  const gate = candidate['downloadGate'];
  const reasons = gate['reasons'];
  if (
    !isRecord(reasons) ||
    !hasExactIdentity(Object.keys(reasons), BLOCKED_REASONS) ||
    Object.values(reasons).some((value) => !isNonEmptyString(value)) ||
    !isNonEmptyString(gate['assertive'])
  ) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:download-gate`);
  }

  const serialized = JSON.stringify(candidate).replaceAll('\\', '/');
  if (FORBIDDEN_ARTIFACT_IDENTITIES.some((identity) => identity.test(serialized))) {
    throw new Error(`RELEASE_CONTENT_INVALID:${locale}:development-artifact-identity`);
  }

  return deepFreeze(candidate as unknown as ReleaseContent) as ReleaseContent;
};

const RELEASE_METADATA = admitReleaseMetadata(releaseMetadataJson);
const RELEASE_CONTENT = Object.freeze({
  en: admitReleaseContent(releaseEnJson, 'en'),
  'pt-BR': admitReleaseContent(releasePtBrJson, 'pt-BR'),
});

const localeParity = (content: ReleaseContent): string =>
  JSON.stringify({
    channels: content.channels.map(({ id }) => id),
    notes: content.releaseNotes.sections.map(({ id }) => id),
    verification: content.verification.steps.map(({ id }) => id),
    history: Object.keys(content.history.records),
    reasons: Object.keys(content.downloadGate.reasons),
  });

if (localeParity(RELEASE_CONTENT.en) !== localeParity(RELEASE_CONTENT['pt-BR'])) {
  throw new Error('RELEASE_CONTENT_LOCALE_PARITY_MISMATCH');
}

export const getReleaseContent = (locale: WebLocale): ReleaseContent => RELEASE_CONTENT[locale];
export const getReleaseMetadata = (): ReleaseMetadata => RELEASE_METADATA;

const isOneOf = <Value extends string>(values: readonly Value[], value: string): value is Value =>
  values.includes(value as Value);

const requiredHref = (
  routeId: ReleaseRouteId,
  parameters: Readonly<Record<string, string>>,
): string => {
  const result = routeHref(routeId, parameters);
  if (!result.ok) {
    throw new Error(`RELEASE_ROUTE_INVALID:${routeId}:${result.error.code}`);
  }
  return result.value;
};

const releasePathResolution = (pathname: string): ReleasePageResolution | undefined => {
  const match = matchWebRoute({ pathname, securityBoundary: 'public-origin' });
  if (!match.ok || !isOneOf(RELEASE_ROUTE_IDS, match.value.route.id)) return undefined;

  const locale = match.value.parameters['locale'];
  const channel = match.value.parameters['channel'] ?? 'stable';
  const version = match.value.parameters['version'] ?? 'current';
  if (
    locale === undefined ||
    !isOneOf(WEB_LOCALES, locale) ||
    !isOneOf(WEB_CHANNELS, channel) ||
    !isOneOf(WEB_VERSIONS, version)
  ) {
    return undefined;
  }

  return deepFreeze({
    channel,
    locale,
    routeId: match.value.route.id,
    version,
  }) as ReleasePageResolution;
};

export const resolveReleasePage = (
  input: Readonly<{
    locale: string;
    release?: readonly string[] | undefined;
  }>,
): ReleasePageResolution | undefined => {
  const suffix = input.release?.join('/') ?? '';
  return releasePathResolution(
    `/${input.locale}/releases${suffix.length === 0 ? '' : `/${suffix}`}`,
  );
};

export const resolveDownloadPage = (
  input: Readonly<{
    channel: string;
    locale: string;
    version: string;
  }>,
): ReleasePageResolution | undefined =>
  releasePathResolution(`/${input.locale}/download/${input.channel}/${input.version}`);

export const getReleasePageMetadata = (locale: WebLocale) => {
  const content = getReleaseContent(locale);
  return content.metadata;
};

const assertNever = (value: never): never => {
  throw new Error(`Unreachable release renderer variant: ${JSON.stringify(value)}`);
};

export const releaseBlockedReasonCopy = (
  reason: DownloadBlockedReason,
  content: ReleaseContent,
): string => {
  switch (reason) {
    case 'artifact-unavailable':
      return content.downloadGate.reasons['artifact-unavailable'];
    case 'channel-selection-blocked':
      return content.downloadGate.reasons['channel-selection-blocked'];
    case 'development-artifact-rejected':
      return content.downloadGate.reasons['development-artifact-rejected'];
    case 'distribution-not-approved':
      return content.downloadGate.reasons['distribution-not-approved'];
    case 'historical-release-unavailable':
      return content.downloadGate.reasons['historical-release-unavailable'];
    case 'historical-release-unsafe':
      return content.downloadGate.reasons['historical-release-unsafe'];
    case 'integrity-disagreement':
      return content.downloadGate.reasons['integrity-disagreement'];
    case 'official-artifact-unavailable':
      return content.downloadGate.reasons['official-artifact-unavailable'];
    case 'record-invalid':
      return content.downloadGate.reasons['record-invalid'];
    default:
      return assertNever(reason);
  }
};

const ChannelNavigation = ({
  channel,
  content,
  locale,
  version,
}: Readonly<{
  channel: WebChannel;
  content: ReleaseContent;
  locale: WebLocale;
  version: WebVersion;
}>) => (
  <aside>
    <details open>
      <summary>{content.navigation.label}</summary>
      <nav aria-label={content.navigation.label} className="lb-web-documentation-index">
        <ul>
          <li>
            <a href={requiredHref('releases-index', { locale })}>{content.navigation.index}</a>
          </li>
          <li>
            <a href={requiredHref('releases-channel', { channel, locale })}>
              {content.navigation.channel}
            </a>
          </li>
          <li>
            <a href={requiredHref('releases-version', { channel, locale, version })}>
              {content.navigation.notes}
            </a>
          </li>
          <li>
            <a href={requiredHref('releases-integrity', { channel, locale, version })}>
              {content.navigation.integrity}
            </a>
          </li>
          <li>
            <a href={requiredHref('releases-download', { channel, locale, version })}>
              {content.navigation.download}
            </a>
          </li>
          <li>
            <a href={requiredHref('releases-install', { channel, locale, version })}>
              {content.navigation.install}
            </a>
          </li>
        </ul>
      </nav>
    </details>
  </aside>
);

const ChannelPolicies = ({
  content,
  locale,
  selectedChannel,
}: Readonly<{
  content: ReleaseContent;
  locale: WebLocale;
  selectedChannel: WebChannel;
}>) => (
  <ReleaseChannelSelector
    description={
      locale === 'pt-BR'
        ? 'Estável é o padrão. Beta exige adesão explícita. Experimental permanece separado por risco, público, suporte e atualização.'
        : 'Stable is the default. Beta requires explicit opt-in. Experimental remains separate by risk, audience, support, and updates.'
    }
    title={content.navigation.channel}
  >
    <nav aria-label={content.navigation.channel} className="lb-web-version-selector">
      {content.channels.map((channel) => (
        <a
          aria-current={channel.id === selectedChannel ? 'page' : undefined}
          className={
            channel.id === selectedChannel
              ? 'public-action public-action--primary'
              : 'public-action'
          }
          href={requiredHref('releases-channel', { channel: channel.id, locale })}
          key={channel.id}
        >
          {channel.name}
        </a>
      ))}
    </nav>
    <div className="release-channel-ledger">
      {content.channels.map((channel) => (
        <section aria-labelledby={`release-channel-${channel.id}`} key={channel.id}>
          <h3 id={`release-channel-${channel.id}`}>{channel.name}</h3>
          <StatusSignal
            {...(channel.default
              ? locale === 'pt-BR'
                ? { detail: 'Canal padrão' }
                : { detail: 'Default channel' }
              : channel.requiresOptIn
                ? locale === 'pt-BR'
                  ? { detail: 'Adesão explícita obrigatória' }
                  : { detail: 'Explicit opt-in required' }
                : {})}
            label={channel.id}
            state={channel.id === 'stable' ? 'unavailable' : 'warning'}
          />
          <dl className="catalog-disclosure-list">
            <div>
              <dt>{locale === 'pt-BR' ? 'Público' : 'Audience'}</dt>
              <dd>{channel.audience}</dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Risco' : 'Risk'}</dt>
              <dd>{channel.risk}</dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Suporte' : 'Support'}</dt>
              <dd>{channel.support}</dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Atualizações' : 'Updates'}</dt>
              <dd>{channel.updates}</dd>
            </div>
            <div>
              <dt>{locale === 'pt-BR' ? 'Conta e consentimento' : 'Account and consent'}</dt>
              <dd>{channel.account}</dd>
            </div>
          </dl>
        </section>
      ))}
    </div>
  </ReleaseChannelSelector>
);

const RELEASE_MOVEMENT_ORDER = Object.freeze([
  'compatibility',
  'changes',
  'risks',
  'corrections',
  'migration',
  'recovery',
] as const);

const ReleaseNotes = ({
  content,
  resolution,
}: Readonly<{ content: ReleaseContent; resolution: ReleasePageResolution }>) => (
  <section aria-labelledby="release-notes-title" className="release-notes-movement">
    <h2 id="release-notes-title">{content.releaseNotes.title}</h2>
    <p>{content.releaseNotes.summary}</p>
    <div className="release-notes-flow">
      {RELEASE_MOVEMENT_ORDER.map((id) =>
        content.releaseNotes.sections.find((section) => section.id === id),
      ).map((section, index) => {
        if (section === undefined) throw new Error('RELEASE_CONTENT_INVALID:movement');
        return (
          <div key={section.id}>
            <section
              className={`release-movement release-${section.id}-movement`}
              id={`release-note-${section.id}`}
            >
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
            {index === 0 ? (
              <section className="release-movement release-integrity-movement">
                <h3>{content.manifest.title}</h3>
                <p>{content.manifest.notice}</p>
                <a
                  href={requiredHref('releases-integrity', {
                    channel: resolution.channel,
                    locale: resolution.locale,
                    version: resolution.version,
                  })}
                >
                  {content.navigation.integrity}
                </a>
              </section>
            ) : null}
          </div>
        );
      })}
    </div>
  </section>
);

const valueForManifestField = (field: (typeof MANIFEST_FIELDS)[number]): string => {
  const value = RELEASE_METADATA.demonstrativeManifest[field];
  return Array.isArray(value) ? value.join(' · ') : String(value);
};

const IntegrityReview = ({
  content,
  locale,
}: Readonly<{ content: ReleaseContent; locale: WebLocale }>) => (
  <ReleaseIntegrityPanel
    description={
      locale === 'pt-BR'
        ? 'Se qualquer evidência da versão divergir, não execute o artefato. Mantenha-o fechado e use as ações seguras acima.'
        : 'If any release evidence differs, do not run the artifact. Keep it closed and use the safe actions above.'
    }
    title={locale === 'pt-BR' ? 'Integridade e recuperação' : 'Integrity and recovery'}
  >
    <section
      aria-labelledby="release-integrity-disagreement-title"
      className="release-integrity-decision"
      role="alert"
    >
      <h3 id="release-integrity-disagreement-title">
        {locale === 'pt-BR'
          ? 'Toda divergência bloqueia o download'
          : 'Every integrity disagreement blocks download'}
      </h3>
      <p>{content.downloadGate.reasons['integrity-disagreement']}</p>
      <p>{content.verification.blocked}</p>
    </section>
    <details className="release-manifest-disclosure">
      <summary>
        {locale === 'pt-BR'
          ? 'Ver detalhes técnicos de integridade'
          : 'View technical integrity details'}
      </summary>
      <h3>{content.manifest.title}</h3>
      <p>{content.manifest.notice}</p>
      <BoundaryTransitionNotice
        description={content.identity.detail}
        title={content.identity.label}
      />
      <ManifestFieldList
        fields={MANIFEST_FIELDS.map((field) => ({
          label: content.manifest.fields[field],
          value: valueForManifestField(field),
        }))}
      />
      <p>
        {locale === 'pt-BR'
          ? 'Campos que devem concordar exatamente'
          : 'Fields that must agree exactly'}
      </p>
      <ul>
        {RELEASE_METADATA.integrityDisagreementFields.map((field) => (
          <li key={field}>
            <code>{field}</code>
          </li>
        ))}
      </ul>
    </details>
  </ReleaseIntegrityPanel>
);

const VerificationGuide = ({ content }: Readonly<{ content: ReleaseContent }>) => (
  <SignatureVerificationGuide
    description={content.verification.introduction}
    title={content.verification.title}
  >
    <ol className="lb-web-documentation-index">
      {content.verification.steps.map((step) => (
        <li key={step.id}>
          <strong>{step.title}</strong>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
    <p role="alert">{content.verification.blocked}</p>
  </SignatureVerificationGuide>
);

const ReleaseHistory = ({ content }: Readonly<{ content: ReleaseContent }>) => (
  <section aria-labelledby="release-history-title">
    <h2 id="release-history-title">{content.history.title}</h2>
    <p>{content.history.introduction}</p>
    <ol className="lb-web-documentation-index">
      {RELEASE_METADATA.history.map((record) => {
        const copy =
          content.history.records[record.version as keyof typeof content.history.records];
        if (copy === undefined)
          throw new Error(`RELEASE_CONTENT_INVALID:history:${record.version}`);
        return (
          <li key={`${record.channel}:${record.version}`}>
            <h3>{copy.title}</h3>
            <p>{copy.notes}</p>
            <dl className="catalog-disclosure-list">
              <div>
                <dt>SHA-256</dt>
                <dd>{copy.hash}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusSignal
                    label={copy.status}
                    state={
                      record.historyState === 'unsafe'
                        ? 'error'
                        : record.historyState === 'unavailable'
                          ? 'stale'
                          : 'unavailable'
                    }
                  />
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  </section>
);

const InstallationGuide = ({ content }: Readonly<{ content: ReleaseContent }>) => (
  <PostDownloadGuide description={content.installation.summary} title={content.installation.title}>
    <p>
      <strong>{content.installation.expectedWarnings}</strong>
    </p>
    <ol>
      {content.installation.steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
    <p>{content.installation.cancel}</p>
    <p>{content.installation.support}</p>
  </PostDownloadGuide>
);

const GateActions = ({
  content,
  locale,
}: Readonly<{ content: ReleaseContent; locale: WebLocale }>) => (
  <nav aria-label={content.downloadGate.title} className="public-not-found__actions">
    <a
      className="public-action public-action--primary"
      href={publicBoundaryHref('public-compatibility', locale)}
    >
      {content.navigation.compatibility}
    </a>
    <a className="public-action" href={requiredHref('releases-index', { locale })}>
      {content.navigation.cancel}
    </a>
    <a className="public-action" href={publicBoundaryHref('public-support', locale)}>
      {content.navigation.help}
    </a>
  </nav>
);

export const DownloadDecisionView = ({
  content,
  decision,
  locale,
}: Readonly<{
  content: ReleaseContent;
  decision: DownloadDecision;
  locale: WebLocale;
}>) => {
  switch (decision.status) {
    case 'blocked': {
      const reason = releaseBlockedReasonCopy(decision.reason, content);
      return (
        <DownloadAvailabilityGate
          description={content.downloadGate.summary}
          reason={reason}
          statusLabel={locale === 'pt-BR' ? 'Bloqueado' : 'Blocked'}
          title={content.downloadGate.title}
        >
          <p aria-live="assertive">{content.downloadGate.assertive}</p>
          <GateActions content={content} locale={locale} />
          <details className="release-decision-technical-context">
            <summary>
              {locale === 'pt-BR' ? 'Registro técnico da decisão' : 'Technical decision record'}
            </summary>
            <dl className="catalog-disclosure-list">
              <div>
                <dt>{locale === 'pt-BR' ? 'Motivo registrado' : 'Recorded reason'}</dt>
                <dd>
                  <code>{decision.reason}</code>
                </dd>
              </div>
              <div>
                <dt>{locale === 'pt-BR' ? 'Estado da versão' : 'Release state'}</dt>
                <dd>
                  <code>{decision.historyState}</code>
                </dd>
              </div>
            </dl>
          </details>
        </DownloadAvailabilityGate>
      );
    }
    case 'available':
      return (
        <section aria-labelledby="release-accepted-title">
          <StatusSignal
            detail={`${decision.artifact.origin} · ${decision.artifact.id}`}
            label={locale === 'pt-BR' ? 'Evidência aceita' : 'Evidence accepted'}
            state="success"
          />
          <h2 id="release-accepted-title">
            {locale === 'pt-BR'
              ? 'Elegibilidade verificada na fronteira de distribuição'
              : 'Eligibility verified at the distribution boundary'}
          </h2>
          <VerificationGuide content={content} />
          <InstallationGuide content={content} />
        </section>
      );
    default:
      return assertNever(decision);
  }
};

const decisionFor = (resolution: ReleasePageResolution): DownloadDecision => {
  const record = {
    ...RELEASE_METADATA.releaseRecord,
    channel: resolution.channel,
  };
  return decideDownload({
    record,
    historyState: resolution.version === 'current' ? 'current' : 'supported',
    channelRequest: { requested: resolution.channel },
  });
};

const AnalyticsDisclosure = ({ content }: Readonly<{ content: ReleaseContent }>) => (
  <section aria-labelledby="release-analytics-title">
    <h2 id="release-analytics-title">{content.analytics.title}</h2>
    <p>{content.analytics.body}</p>
  </section>
);

const RouteComposition = ({
  content,
  resolution,
}: Readonly<{
  content: ReleaseContent;
  resolution: ReleasePageResolution;
}>): ReactNode => {
  switch (resolution.routeId) {
    case 'releases-index':
      return (
        <>
          <ChannelPolicies
            content={content}
            locale={resolution.locale}
            selectedChannel={resolution.channel}
          />
          <ReleaseNotes content={content} resolution={resolution} />
          <ReleaseHistory content={content} />
          <AnalyticsDisclosure content={content} />
        </>
      );
    case 'releases-channel':
      return (
        <>
          <ChannelPolicies
            content={content}
            locale={resolution.locale}
            selectedChannel={resolution.channel}
          />
          <ReleaseNotes content={content} resolution={resolution} />
        </>
      );
    case 'releases-version':
      return (
        <>
          <ReleaseNotes content={content} resolution={resolution} />
          <ReleaseHistory content={content} />
        </>
      );
    case 'releases-integrity':
      return (
        <>
          <IntegrityReview content={content} locale={resolution.locale} />
          <VerificationGuide content={content} />
        </>
      );
    case 'releases-download':
      return (
        <>
          <IntegrityReview content={content} locale={resolution.locale} />
          <VerificationGuide content={content} />
          <AnalyticsDisclosure content={content} />
        </>
      );
    case 'releases-install':
      return (
        <>
          <VerificationGuide content={content} />
          <InstallationGuide content={content} />
        </>
      );
    default:
      return assertNever(resolution.routeId);
  }
};

export const ReleaseExperience = ({
  resolution,
}: Readonly<{ resolution: ReleasePageResolution }>) => {
  const content = getReleaseContent(resolution.locale);
  const decision = decisionFor(resolution);
  return (
    <div
      className="release-experience lb-web-product-frame"
      data-release-route={resolution.routeId}
    >
      <ChannelNavigation
        channel={resolution.channel}
        content={content}
        locale={resolution.locale}
        version={resolution.version}
      />
      <article className="public-catalog">
        <header className="release-state-header lb-web-route-header">
          <StatusSignal
            label={resolution.locale === 'pt-BR' ? 'Download bloqueado' : 'Download blocked'}
            state="unavailable"
          />
          <h1 tabIndex={-1}>{content.metadata.title}</h1>
          <p>{content.metadata.description}</p>
        </header>
        <DownloadDecisionView content={content} decision={decision} locale={resolution.locale} />
        <RouteComposition content={content} resolution={resolution} />
        <details className="release-technical-context">
          <summary>
            {resolution.locale === 'pt-BR'
              ? 'Canal, versão e origem desta informação'
              : 'Channel, version, and information source'}
          </summary>
          <ArticleMetadata
            entries={[
              { label: content.identity.label, value: content.identity.detail },
              {
                label: resolution.locale === 'pt-BR' ? 'Canal' : 'Channel',
                value: <code>{resolution.channel}</code>,
              },
              {
                label: resolution.locale === 'pt-BR' ? 'Versão' : 'Version',
                value: <code>{resolution.version}</code>,
              },
              {
                label: content.identity.reviewed,
                value: (
                  <time dateTime={RELEASE_METADATA.lastReviewedAt}>
                    {RELEASE_METADATA.lastReviewedAt.slice(0, 10)}
                  </time>
                ),
              },
              { label: content.identity.validation, value: <code>ReleaseRecord</code> },
            ]}
          />
        </details>
      </article>
    </div>
  );
};

import type { ReactNode } from 'react';
import {
  EmptyComposition,
  EvidenceDisclosure,
  LbButton,
  NoChangeReceipt,
  OperationalFailure,
  PreviewBoundary,
  ProvenanceLabel,
  ResponsiveDataTable,
  StatusSignal,
  WEB_PROVENANCE_KINDS,
  WEB_STATUS_STATES,
} from './components.js';
import { AccountPreviewRail, AdminViewportGate } from './shells.js';

export const WEB_STORY_AXES = Object.freeze({
  interaction: Object.freeze([
    'default',
    'hover',
    'focus-visible',
    'pressed',
    'disabled',
    'loading',
  ] as const),
  locale: Object.freeze(['pt-BR', 'en', 'pseudo'] as const),
  preference: Object.freeze([
    'default',
    'reduced-motion',
    'forced-colors',
    'keyboard',
    'screen-reader',
  ] as const),
  state: WEB_STATUS_STATES,
  viewport: Object.freeze([320, 390, 768, 960, 1440] as const),
});

const StoryStage = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => (
  <section aria-label={label} className="lb-web-story-stage">
    <h2>{label}</h2>
    {children}
  </section>
);

const storyMeta = {
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Web/Shared semantic vocabulary',
};

export default storyMeta;

export const InteractionStates = () => (
  <StoryStage label="Interaction states">
    {WEB_STORY_AXES.interaction.map((state) => (
      <div data-story-interaction={state} key={state}>
        <LbButton
          isDisabled={state === 'disabled'}
          isLoading={state === 'loading'}
          loadingLabel="Loading evidence"
        >
          {state === 'default' ? 'Check compatibility' : state}
        </LbButton>
      </div>
    ))}
  </StoryStage>
);

export const StateCatalog = () => (
  <StoryStage label="Operational state catalog">
    {WEB_STORY_AXES.state.map((state) => (
      <StatusSignal detail={`Authored ${state} composition`} key={state} state={state} />
    ))}
    <EmptyComposition
      description="Trusted data or an available action will appear here with its source identified."
      title="Nothing needs your attention"
    />
    <OperationalFailure
      affectedCapability="Release integrity"
      safeState="Documentation and compatibility guidance remain available."
    />
    <PreviewBoundary />
    <AccountPreviewRail />
    <AdminViewportGate highRiskAction={<LbButton>Review critical action</LbButton>}>
      Safe case review remains available.
    </AdminViewportGate>
    <NoChangeReceipt
      authority="Phase 4 authority"
      receiptId="storybook-no-change"
      reviewedObject="support request"
    />
  </StoryStage>
);

export const ProvenanceCatalog = () => (
  <StoryStage label="Provenance states">
    {WEB_STORY_AXES.locale.map((locale) => (
      <div data-locale={locale} key={locale}>
        {WEB_PROVENANCE_KINDS.map((kind) => (
          <ProvenanceLabel kind={kind} key={kind} locale={locale} />
        ))}
      </div>
    ))}
  </StoryStage>
);

export const ResponsiveTableCatalog = () => (
  <StoryStage label="Responsive table and detail rows">
    <ResponsiveDataTable
      caption="Release integrity"
      columns={[
        { id: 'version', label: 'Version' },
        { id: 'channel', label: 'Channel' },
        { essential: false, id: 'hash', label: 'SHA-256' },
      ]}
      rows={[
        {
          cells: {
            channel: 'Stable',
            hash: 'a'.repeat(64),
            version: '1.0.0',
          },
          detail: (
            <EvidenceDisclosure label="Complete manifest" provenance="measured">
              Publisher, signature state, architecture, Windows lifecycle, and canonical manifest.
            </EvidenceDisclosure>
          ),
          id: 'stable-1.0.0',
        },
      ]}
    />
  </StoryStage>
);

export const LocaleCatalog = () => (
  <StoryStage label="PT-BR, English, and pseudo-localized copy">
    <p lang="pt-BR">Prepare seu PC. Prove o resultado. Restaure com controle.</p>
    <p lang="en">Prepare your PC. Prove the result. Restore with control.</p>
    <p lang="en" data-locale="pseudo">
      [Ṕŕéṕáŕé ýóúŕ ṔĆ. Ṕŕóvé ţhé ŕéşúĺţ. Ŕéşţóŕé ŵíţh ćóńţŕóĺ.]
    </p>
  </StoryStage>
);

export const ViewportCatalog = () => (
  <StoryStage label="Locked viewport thresholds">
    {WEB_STORY_AXES.viewport.map((viewport) => (
      <article
        aria-label={`${String(viewport)} pixel viewport`}
        data-story-viewport={viewport}
        key={viewport}
        style={{ inlineSize: viewport, maxInlineSize: '100%' }}
      >
        <StatusSignal detail="No clipping or two-dimensional scrolling." state="preview" />
      </article>
    ))}
  </StoryStage>
);

export const AccessibilityModes = () => (
  <StoryStage label="Accessibility preference and input modes">
    {WEB_STORY_AXES.preference.map((preference) => (
      <section data-story-preference={preference} key={preference}>
        <h3>{preference}</h3>
        <LbButton>Keyboard-operable action</LbButton>
        <StatusSignal detail="Text, symbol, and pattern remain available." state="success" />
      </section>
    ))}
  </StoryStage>
);

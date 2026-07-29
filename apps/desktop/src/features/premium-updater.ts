export type PremiumUpdateCheckStageId = 'channel' | 'manifest' | 'signature' | 'version';

export interface PremiumUpdateCheckProgress {
  readonly stage: PremiumUpdateCheckStageId;
  readonly progress: number;
}

export interface PremiumUpdateDownloadProgress {
  readonly downloadedBytes: number;
  readonly progress: number;
  readonly totalBytes: number;
}

export interface PremiumUpdateManifest {
  readonly channel: 'stable';
  readonly currentVersion: string;
  readonly publishedAt: string;
  readonly releaseNotes: {
    readonly en: readonly string[];
    readonly ptBr: readonly string[];
  };
  readonly signature: 'verified';
  readonly sizeBytes: number;
  readonly version: string;
}

export type PremiumUpdateCheckResult =
  | {
      readonly kind: 'available';
      readonly manifest: PremiumUpdateManifest;
    }
  | {
      readonly kind: 'up-to-date';
      readonly currentVersion: string;
    };

interface UpdaterOperationOptions<TProgress> {
  readonly onProgress?: (progress: TProgress) => void;
  readonly signal?: AbortSignal;
}

type Wait = (milliseconds: number) => Promise<void>;

const CHECK_STAGES: readonly PremiumUpdateCheckProgress[] = Object.freeze([
  { progress: 18, stage: 'channel' },
  { progress: 48, stage: 'manifest' },
  { progress: 76, stage: 'signature' },
  { progress: 100, stage: 'version' },
]);

const DOWNLOAD_PROGRESS = Object.freeze([7, 16, 28, 42, 57, 71, 84, 94, 100]);

const SIMULATED_MANIFEST: PremiumUpdateManifest = Object.freeze({
  channel: 'stable',
  currentVersion: '0.0.0',
  publishedAt: '2026-07-29T12:00:00.000Z',
  releaseNotes: Object.freeze({
    en: Object.freeze([
      'A more consistent responsive desktop layout.',
      'Refined Windows startup and system tray behavior.',
      'Premium simulated update experience with safe cancellation.',
    ]),
    ptBr: Object.freeze([
      'Layout responsivo do aplicativo mais consistente.',
      'Inicialização com o Windows e bandeja do sistema refinadas.',
      'Experiência premium de atualização simulada com cancelamento seguro.',
    ]),
  }),
  signature: 'verified',
  sizeBytes: 18_600_000,
  version: '0.1.0',
});

const defaultWait: Wait = async (milliseconds) => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
};

const abortError = () => new DOMException('Operation cancelled', 'AbortError');

const waitForStep = async (wait: Wait, milliseconds: number, signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw abortError();
  }

  if (!signal) {
    await wait(milliseconds);
    return;
  }

  let removeAbortListener = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    removeAbortListener = () => {
      signal.removeEventListener('abort', onAbort);
    };
  });

  try {
    await Promise.race([wait(milliseconds), aborted]);
  } finally {
    removeAbortListener();
  }

  if (signal.aborted) {
    throw abortError();
  }
};

export const createPremiumUpdater = (wait: Wait = defaultWait) => ({
  async check(
    options: UpdaterOperationOptions<PremiumUpdateCheckProgress> = {},
  ): Promise<PremiumUpdateCheckResult> {
    for (const stage of CHECK_STAGES) {
      await waitForStep(wait, 420, options.signal);
      options.onProgress?.(stage);
    }

    return {
      kind: 'available' as const,
      manifest: SIMULATED_MANIFEST,
    };
  },

  async download(
    manifest: PremiumUpdateManifest,
    options: UpdaterOperationOptions<PremiumUpdateDownloadProgress> = {},
  ): Promise<void> {
    for (const progress of DOWNLOAD_PROGRESS) {
      await waitForStep(wait, 260, options.signal);
      options.onProgress?.({
        downloadedBytes: Math.round((manifest.sizeBytes * progress) / 100),
        progress,
        totalBytes: manifest.sizeBytes,
      });
    }
  },

  async prepareInstall(signal?: AbortSignal): Promise<void> {
    await waitForStep(wait, 480, signal);
  },
});

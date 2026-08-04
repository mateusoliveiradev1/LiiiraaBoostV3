export type DeviceClass = 'physical' | 'virtual';

export type DeviceComponentClass =
  'platform-trust' | 'virtual-platform' | 'cpu' | 'storage-controller' | 'gpu' | 'memory-topology';

export interface LocalProtectedComponent {
  readonly componentClass: DeviceComponentClass;
  readonly localDigest: string;
}

export interface LocalDeviceEvidence {
  readonly deviceClass: DeviceClass;
  readonly components: readonly LocalProtectedComponent[];
}

export interface ProtectedComponentEvidence {
  readonly componentClass: DeviceComponentClass;
  readonly protectedDigest: string;
}

export interface ProtectedDeviceEvidence {
  readonly deviceClass: DeviceClass;
  readonly keyVersion: number;
  readonly components: readonly ProtectedComponentEvidence[];
}

export type DeviceEvidenceOutcome =
  'same-pc' | 'revalidation-required' | 'replacement' | 'rejected';

export interface DeviceEvidenceComparison {
  readonly outcome: DeviceEvidenceOutcome;
  readonly score: number;
  readonly matchedComponents: readonly DeviceComponentClass[];
  readonly changedComponents: readonly DeviceComponentClass[];
  readonly reasons: readonly string[];
}

export interface DeriveProtectedDeviceEvidenceInput {
  readonly evidence: LocalDeviceEvidence;
  readonly accountSalt: string;
  readonly serverWrappingKey: string;
  readonly keyVersion: number;
}

const COMPONENT_WEIGHTS = {
  'platform-trust': 40,
  'virtual-platform': 40,
  cpu: 25,
  'storage-controller': 15,
  gpu: 10,
  'memory-topology': 10,
} as const satisfies Readonly<Record<DeviceComponentClass, number>>;

const COMPONENT_ORDER = [
  'platform-trust',
  'virtual-platform',
  'cpu',
  'storage-controller',
  'gpu',
  'memory-topology',
] as const satisfies readonly DeviceComponentClass[];

const SHA256_HEX = /^[0-9a-f]{64}$/u;
const SAME_PC_THRESHOLD = 65;
const REVALIDATION_THRESHOLD = 40;
const MINIMUM_COMPONENT_CLASSES = 3;
const TEXT_ENCODER = new TextEncoder();

const encodeHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const rejected = (reason: string): DeviceEvidenceComparison => ({
  outcome: 'rejected',
  score: 0,
  matchedComponents: [],
  changedComponents: [],
  reasons: [reason],
});

const validateLocalEvidence = (evidence: LocalDeviceEvidence): string | undefined => {
  if (evidence.components.length === 0) return 'evidence-empty';
  const seen = new Set<DeviceComponentClass>();
  for (const component of evidence.components) {
    if (seen.has(component.componentClass)) {
      return `evidence-contradictory:${component.componentClass}`;
    }
    if (!SHA256_HEX.test(component.localDigest)) {
      return `evidence-invalid-digest:${component.componentClass}`;
    }
    seen.add(component.componentClass);
  }
  if (seen.size < MINIMUM_COMPONENT_CLASSES) return 'evidence-below-minimum';
  if (!seen.has('platform-trust') && !seen.has('virtual-platform') && !seen.has('cpu')) {
    return 'evidence-missing-anchor';
  }
  if (evidence.deviceClass === 'physical' && seen.has('virtual-platform')) {
    return 'evidence-device-class-contradiction';
  }
  if (
    evidence.deviceClass === 'virtual' &&
    (!seen.has('virtual-platform') || seen.has('platform-trust'))
  ) {
    return 'evidence-device-class-contradiction';
  }
  return undefined;
};

const validateEvidence = (evidence: ProtectedDeviceEvidence): string | undefined => {
  if (evidence.components.length === 0) return 'evidence-empty';
  if (!Number.isSafeInteger(evidence.keyVersion) || evidence.keyVersion < 1) {
    return 'evidence-invalid-key-version';
  }

  const seen = new Map<DeviceComponentClass, string>();
  for (const component of evidence.components) {
    const previous = seen.get(component.componentClass);
    if (previous !== undefined) {
      return `evidence-contradictory:${component.componentClass}`;
    }
    if (!SHA256_HEX.test(component.protectedDigest)) {
      return `evidence-invalid-digest:${component.componentClass}`;
    }
    seen.set(component.componentClass, component.protectedDigest);
  }

  if (seen.size < MINIMUM_COMPONENT_CLASSES) return 'evidence-below-minimum';
  if (!seen.has('platform-trust') && !seen.has('virtual-platform') && !seen.has('cpu')) {
    return 'evidence-missing-anchor';
  }
  if (evidence.deviceClass === 'physical' && seen.has('virtual-platform')) {
    return 'evidence-device-class-contradiction';
  }
  if (
    evidence.deviceClass === 'virtual' &&
    (!seen.has('virtual-platform') || seen.has('platform-trust'))
  ) {
    return 'evidence-device-class-contradiction';
  }

  return undefined;
};

export const deriveProtectedDeviceEvidence = async ({
  evidence,
  accountSalt,
  serverWrappingKey,
  keyVersion,
}: DeriveProtectedDeviceEvidenceInput): Promise<ProtectedDeviceEvidence> => {
  if (accountSalt.length === 0 || serverWrappingKey.length === 0) {
    throw new Error('device evidence protection requires account salt and wrapping key');
  }
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new Error('device evidence key version must be a positive safe integer');
  }
  const evidenceProblem = validateLocalEvidence(evidence);
  if (evidenceProblem !== undefined) {
    throw new Error(`device evidence rejected: ${evidenceProblem}`);
  }

  const wrappingKey = await globalThis.crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(serverWrappingKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const components = (
    await Promise.all(
      evidence.components.map(async ({ componentClass, localDigest }) => {
        const message = [
          'liiiraa-device-evidence-server-wrap-v1',
          String(keyVersion),
          accountSalt,
          componentClass,
          localDigest,
        ].join('\0');
        const protectedDigest = encodeHex(
          await globalThis.crypto.subtle.sign('HMAC', wrappingKey, TEXT_ENCODER.encode(message)),
        );
        return { componentClass, protectedDigest };
      }),
    )
  ).sort(
    (left, right) =>
      COMPONENT_ORDER.indexOf(left.componentClass) - COMPONENT_ORDER.indexOf(right.componentClass),
  );

  return { deviceClass: evidence.deviceClass, keyVersion, components };
};

export const compareDeviceEvidence = (
  expected: ProtectedDeviceEvidence,
  observed: ProtectedDeviceEvidence,
): DeviceEvidenceComparison => {
  const expectedProblem = validateEvidence(expected);
  if (expectedProblem !== undefined) return rejected(expectedProblem);
  const observedProblem = validateEvidence(observed);
  if (observedProblem !== undefined) return rejected(observedProblem);
  if (expected.deviceClass !== observed.deviceClass) {
    return rejected('physical-virtual-evidence-mismatch');
  }
  if (expected.keyVersion !== observed.keyVersion) {
    return rejected('evidence-key-version-mismatch');
  }

  const expectedByClass = new Map(
    expected.components.map((component) => [component.componentClass, component.protectedDigest]),
  );
  const observedByClass = new Map(
    observed.components.map((component) => [component.componentClass, component.protectedDigest]),
  );
  const matchedComponents: DeviceComponentClass[] = [];
  const changedComponents: DeviceComponentClass[] = [];
  let score = 0;

  for (const componentClass of COMPONENT_ORDER) {
    const expectedDigest = expectedByClass.get(componentClass);
    const observedDigest = observedByClass.get(componentClass);
    if (expectedDigest === undefined && observedDigest === undefined) continue;
    if (expectedDigest !== undefined && expectedDigest === observedDigest) {
      matchedComponents.push(componentClass);
      score += COMPONENT_WEIGHTS[componentClass];
    } else {
      changedComponents.push(componentClass);
    }
  }

  const reasons = changedComponents.map((componentClass) => `component-changed:${componentClass}`);
  if (score >= SAME_PC_THRESHOLD) {
    return { outcome: 'same-pc', score, matchedComponents, changedComponents, reasons };
  }
  if (score >= REVALIDATION_THRESHOLD) {
    return {
      outcome: 'revalidation-required',
      score,
      matchedComponents,
      changedComponents,
      reasons: [...reasons, 'score-requires-online-revalidation'],
    };
  }
  return {
    outcome: 'replacement',
    score,
    matchedComponents,
    changedComponents,
    reasons: [...reasons, 'score-indicates-replacement'],
  };
};

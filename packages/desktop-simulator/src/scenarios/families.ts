import type {
  GameFixture,
  HardwareFixture,
  ProfileFixture,
  ScenarioFamilyId,
} from '@liiiraa/desktop-client';

export interface ScenarioFamily {
  readonly id: ScenarioFamilyId;
  readonly name: string;
  readonly baseline: Readonly<{
    hardware: HardwareFixture;
    game: GameFixture;
    profile: ProfileFixture;
  }>;
}

const freezeFamily = (family: ScenarioFamily): ScenarioFamily =>
  Object.freeze({
    ...family,
    baseline: Object.freeze({
      hardware: Object.freeze({ ...family.baseline.hardware }),
      game: Object.freeze({ ...family.baseline.game }),
      profile: Object.freeze({ ...family.baseline.profile }),
    }),
  });

export const SCENARIO_FAMILIES: readonly ScenarioFamily[] = Object.freeze([
  freezeFamily({
    id: 'competitive-intel-nvidia' as ScenarioFamilyId,
    name: 'Competitive Intel and NVIDIA desktop',
    baseline: {
      hardware: {
        id: 'pc-intel-nvidia-mid',
        platform: 'windows-11',
        build: '23H2',
        cpuVendor: 'Intel',
        cpuModel: 'Core i5-12400F',
        gpuVendor: 'NVIDIA',
        gpuModel: 'GeForce RTX 3060',
        tier: 'mid-range',
      },
      game: {
        id: 'vector-strike-arena',
        displayName: 'Vector Strike Arena',
        kind: 'fictional-anchor',
        integrationQualification: 'deterministic-fixture',
        integrationValidated: false,
      },
      profile: {
        id: 'competitive-balanced',
        displayName: 'Competitive Balanced',
        riskPolicy: 'verified',
      },
    },
  }),
  freezeFamily({
    id: 'hybrid-amd-laptop' as ScenarioFamilyId,
    name: 'AMD laptop with hybrid NVIDIA graphics',
    baseline: {
      hardware: {
        id: 'laptop-amd-hybrid',
        platform: 'windows-11',
        build: '23H2',
        cpuVendor: 'AMD',
        cpuModel: 'Ryzen 7 7840HS',
        gpuVendor: 'NVIDIA',
        gpuModel: 'GeForce RTX 4060 Laptop',
        tier: 'mid-range',
      },
      game: {
        id: 'vector-strike-arena',
        displayName: 'Vector Strike Arena',
        kind: 'fictional-anchor',
        integrationQualification: 'deterministic-fixture',
        integrationValidated: false,
      },
      profile: {
        id: 'hybrid-gpu-competitive',
        displayName: 'Hybrid GPU Competitive',
        riskPolicy: 'verified',
      },
    },
  }),
  freezeFamily({
    id: 'high-end-amd' as ScenarioFamilyId,
    name: 'High-end AMD desktop',
    baseline: {
      hardware: {
        id: 'pc-amd-radeon-high',
        platform: 'windows-11',
        build: '23H2',
        cpuVendor: 'AMD',
        cpuModel: 'Ryzen 9 7900X',
        gpuVendor: 'AMD',
        gpuModel: 'Radeon RX 7900 XTX',
        tier: 'high-end',
      },
      game: {
        id: 'vector-strike-arena',
        displayName: 'Vector Strike Arena',
        kind: 'fictional-anchor',
        integrationQualification: 'deterministic-fixture',
        integrationValidated: false,
      },
      profile: {
        id: 'quality-stable',
        displayName: 'Quality Stable',
        riskPolicy: 'verified',
      },
    },
  }),
]);

const familyById = new Map<string, ScenarioFamily>(
  SCENARIO_FAMILIES.map((family) => [family.id, family]),
);

export const isScenarioFamilyId = (value: unknown): value is ScenarioFamilyId =>
  typeof value === 'string' && familyById.has(value);

export const getScenarioFamily = (id: string): ScenarioFamily | undefined => familyById.get(id);

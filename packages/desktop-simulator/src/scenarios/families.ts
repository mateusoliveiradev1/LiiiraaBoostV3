import type { DesktopScenarioId, ScenarioFamilyId } from '@liiiraa/desktop-client';

export interface ScenarioFamily {
  readonly id: ScenarioFamilyId;
  readonly name: string;
  readonly baselineScenarioId: DesktopScenarioId;
}

export const SCENARIO_FAMILIES: readonly ScenarioFamily[] = Object.freeze([
  Object.freeze({
    id: 'competitive-intel-nvidia' as ScenarioFamilyId,
    name: 'Competitive Intel and NVIDIA desktop',
    baselineScenarioId: 'S01' as DesktopScenarioId,
  }),
  Object.freeze({
    id: 'hybrid-amd-laptop' as ScenarioFamilyId,
    name: 'AMD laptop with hybrid NVIDIA graphics',
    baselineScenarioId: 'S02' as DesktopScenarioId,
  }),
  Object.freeze({
    id: 'high-end-amd' as ScenarioFamilyId,
    name: 'High-end AMD desktop',
    baselineScenarioId: 'S03' as DesktopScenarioId,
  }),
]);

export const isScenarioFamilyId = (value: unknown): value is ScenarioFamilyId =>
  typeof value === 'string' && SCENARIO_FAMILIES.some(({ id }) => id === value);

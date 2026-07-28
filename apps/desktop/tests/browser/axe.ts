import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

export const expectNoAxeViolations = async (
  page: Page,
  includeSelectors: readonly string[] = [],
): Promise<void> => {
  let audit = new AxeBuilder({ page });
  for (const selector of includeSelectors) {
    audit = audit.include(selector);
  }

  const results = await audit.analyze();
  const blockingViolations = results.violations
    .filter((violation) => violation.impact !== null && BLOCKING_IMPACTS.has(violation.impact))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    }));

  expect(
    blockingViolations,
    `Serious or critical axe violations:\n${JSON.stringify(blockingViolations, null, 2)}`,
  ).toEqual([]);
};

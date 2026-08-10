import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('admin governance UI', () => {
  it('offers an explicit way to leave a read-only function simulation', () => {
    const source = readFileSync(
      new URL('./features/admin-access-governance.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("Readonly<{ kind: 'exit-simulation' }>");
    expect(source).toContain("onPress={() => onAction?.({ kind: 'exit-simulation' })}");
    expect(source).toContain("if (action.kind === 'exit-simulation') {");
    expect(source).toContain('setSimulatedFunction(undefined);');
  });
});

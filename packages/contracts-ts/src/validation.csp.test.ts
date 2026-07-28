import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFunction = globalThis.Function;

afterEach(() => {
  globalThis.Function = originalFunction;
  vi.resetModules();
});

describe('contract validation under the desktop CSP', () => {
  it('initializes without dynamic JavaScript code generation', async () => {
    globalThis.Function = function blockedDynamicCodeGeneration(): never {
      throw new EvalError('dynamic code generation blocked by CSP');
    } as unknown as FunctionConstructor;
    vi.resetModules();

    await expect(import('./validation.js')).resolves.toBeDefined();
  });
});

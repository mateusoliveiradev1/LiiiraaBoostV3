import { describe, expect, it } from 'vitest';

const DEVICE_CONCURRENCY_RED_OWNER = '04-14-01';
const CONCURRENT_BIND_COUNT = 20;

type DeviceApplicationModule = Readonly<{
  bindDevice?: (...args: readonly unknown[]) => Promise<unknown>;
  transferDevice?: (...args: readonly unknown[]) => Promise<unknown>;
}>;

const loadDeviceApplication = async (): Promise<DeviceApplicationModule> =>
  import('@liiiraa/control-plane-application').catch((): DeviceApplicationModule => ({}));

const requireDeviceAuthority = async () => {
  const module = await loadDeviceApplication();
  if (typeof module.bindDevice !== 'function' || typeof module.transferDevice !== 'function') {
    throw new Error(
      `EXPECTED_RED[${DEVICE_CONCURRENCY_RED_OWNER}]: transactional device authority is not implemented`,
    );
  }
  return module;
};

describe('device-concurrency pre-implementation PostgreSQL witnesses', () => {
  it('IDEN-04 serializes a 20-way bind race to exactly one active PC', async () => {
    const concurrentBindAttempts = Array.from(
      { length: CONCURRENT_BIND_COUNT },
      (_, index) => `bind-attempt-${String(index + 1).padStart(2, '0')}`,
    );

    expect(concurrentBindAttempts).toHaveLength(20);
    expect(new Set(concurrentBindAttempts)).toHaveLength(20);
    await requireDeviceAuthority();
  });

  it('WEB-05 preserves the replacement cooldown under concurrent revoke and replace requests', async () => {
    await requireDeviceAuthority();
  });
});

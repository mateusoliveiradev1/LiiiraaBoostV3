import type { ProtectedDeviceEvidence } from '@liiiraa/control-plane-domain/runtime-control-plane';

import {
  executeDeviceMutation,
  type DeviceAuthorityDependencies,
  type DeviceAuthorityResult,
} from './bind-device.ts';

interface DeviceCommandBase {
  readonly commandId: string;
  readonly actorAccountId: string;
  readonly accountId: string;
  readonly expectedVersion: bigint;
  readonly correlationId: string;
}

export interface TransferDeviceInput extends DeviceCommandBase {
  readonly action: 'transfer';
  readonly bindingId: string;
  readonly deviceDigest: string;
  readonly deviceLabel: string;
  readonly evidence: ProtectedDeviceEvidence;
  readonly reason: 'ordinary' | 'theft';
  readonly confirmedByCustomer: boolean;
  readonly exceptionId?: string;
}

export interface RevokeDeviceInput extends DeviceCommandBase {
  readonly action: 'revoke';
  readonly reason: 'theft' | 'customer-request';
}

export interface RevalidateDeviceInput extends DeviceCommandBase {
  readonly action: 'revalidate';
  readonly observedEvidence: ProtectedDeviceEvidence;
}

export type TransferDeviceAuthorityInput =
  TransferDeviceInput | RevokeDeviceInput | RevalidateDeviceInput;

export const transferDevice = (
  dependencies: DeviceAuthorityDependencies,
  input: TransferDeviceAuthorityInput,
): Promise<DeviceAuthorityResult> =>
  executeDeviceMutation(dependencies, {
    commandId: input.commandId,
    actorAccountId: input.actorAccountId,
    accountId: input.accountId,
    expectedVersion: input.expectedVersion,
    correlationId: input.correlationId,
    scope:
      input.action === 'revoke'
        ? 'device-revoke'
        : input.action === 'revalidate'
          ? 'device-revalidation'
          : 'device-transfer',
    createCommand: async (transaction, now) => {
      if (input.action === 'revoke') {
        return { kind: 'revoke', reason: input.reason, now };
      }
      if (input.action === 'revalidate') {
        return { kind: 'revalidate', observedEvidence: input.observedEvidence, now };
      }
      const exception = input.exceptionId
        ? await transaction.lockException(input.exceptionId)
        : undefined;
      return {
        kind: 'transfer',
        bindingId: input.bindingId,
        deviceDigest: input.deviceDigest,
        deviceLabel: input.deviceLabel,
        evidence: input.evidence,
        reason: input.reason,
        confirmedByCustomer: input.confirmedByCustomer,
        now,
        ...(exception ? { exception } : {}),
      };
    },
  });

import { describe, expect, it } from 'vitest';

import { adminOverviewStatusLabel } from '../admin-production-routes';

describe('Admin overview localized status labels', () => {
  it.each([
    ['live', 'Atualizado', 'Live'],
    ['stale', 'Dados antigos', 'Stale'],
    ['reconnecting', 'Atualizando', 'Refreshing'],
    ['offline', 'Sem conexão', 'Offline'],
    ['degraded', 'Parcialmente disponível', 'Partially available'],
    ['unavailable', 'Indisponível', 'Unavailable'],
  ] as const)('localizes %s without exposing the transport enum', (status, pt, en) => {
    expect(adminOverviewStatusLabel('pt-BR', status)).toBe(pt);
    expect(adminOverviewStatusLabel('en', status)).toBe(en);
  });
});

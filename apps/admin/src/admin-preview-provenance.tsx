'use client';

import { ProvenanceMark } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';

export function AdminPreviewProvenance({
  detail,
  locale,
}: Readonly<{ detail: string; locale: WebLocale }>) {
  return <ProvenanceMark detail={detail} kind="fixture" locale={locale} />;
}

'use client';

import {
  ProductIcon as DesignSystemProductIcon,
  type ProductIconName,
  type ProductIconWeight,
} from '@liiiraa/design-system';

export type PublicProductIconProps = Readonly<{
  className?: string;
  name: ProductIconName;
  size?: number;
  weight?: ProductIconWeight;
}>;

export const PublicProductIcon = (props: PublicProductIconProps) => (
  <DesignSystemProductIcon {...props} />
);

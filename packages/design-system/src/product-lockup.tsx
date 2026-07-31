export const PRODUCT_LOCKUP_VARIANTS = ['compact', 'full'] as const;

export type ProductLockupVariant = (typeof PRODUCT_LOCKUP_VARIANTS)[number];

export interface ProductLockupProps {
  readonly productName?: string;
  readonly variant?: ProductLockupVariant;
}

export const ProductLockup = ({
  productName = 'Liiiraa Boost',
  variant = 'full',
}: ProductLockupProps) => (
  <strong
    aria-label={productName}
    className="lb-product-brand"
    data-variant={variant}
  >
    <svg aria-hidden="true" className="lb-product-mark" viewBox="0 0 36 28">
      <path
        className="lb-product-mark-primary"
        d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z"
      />
      <path
        className="lb-product-mark-accent"
        d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z"
      />
    </svg>
    <span className="lb-visually-hidden">{productName}</span>
    {variant === 'full' ? (
      <span aria-hidden="true" className="lb-product-wordmark">
        <span>Liiiraa</span>
        <span>Boost</span>
      </span>
    ) : null}
  </strong>
);

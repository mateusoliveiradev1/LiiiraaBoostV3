import { ProductIcon } from '@liiiraa/design-system';
import type { ProductIconName } from '@liiiraa/design-system';
import type { ShellLocale } from '@liiiraa/feature-shell';
import type { ReactNode } from 'react';

export type PremiumToastTone = 'info' | 'success' | 'warning';

export interface PremiumToastMessage {
  readonly id: number;
  readonly message: string;
  readonly tone: PremiumToastTone;
}

interface PremiumToastProps {
  readonly locale: ShellLocale;
  readonly onClose: () => void;
  readonly toast: PremiumToastMessage;
}

const ICON_BY_TONE: Readonly<Record<PremiumToastTone, ProductIconName>> = Object.freeze({
  info: 'info',
  success: 'check',
  warning: 'warning',
});

export const PremiumToast = ({ locale, onClose, toast }: PremiumToastProps): ReactNode => (
  <aside
    aria-atomic="true"
    aria-live={toast.tone === 'warning' ? 'assertive' : 'polite'}
    className="premium-toast premium-toast-complete"
    data-tone={toast.tone}
    role={toast.tone === 'warning' ? 'alert' : 'status'}
  >
    <span className="premium-toast-icon">
      <ProductIcon name={ICON_BY_TONE[toast.tone]} size={20} weight="duotone" />
    </span>
    <span className="premium-toast-copy">
      <strong>
        {toast.tone === 'success'
          ? locale === 'pt-BR'
            ? 'Concluído'
            : 'Completed'
          : toast.tone === 'warning'
            ? locale === 'pt-BR'
              ? 'Atenção'
              : 'Attention'
            : locale === 'pt-BR'
              ? 'Atualização'
              : 'Update'}
      </strong>
      <small>{toast.message}</small>
    </span>
    <button
      aria-label={locale === 'pt-BR' ? 'Fechar notificação' : 'Close notification'}
      onClick={onClose}
      type="button"
    >
      <ProductIcon name="close" size={17} />
    </button>
    <span aria-hidden="true" className="premium-toast-timeout" />
  </aside>
);

import { LbButton, LbIconButton, ProductIcon, type ActivityItem } from '@liiiraa/design-system';
import { useEffect, useRef } from 'react';

import type { ShellLocale } from '@liiiraa/feature-shell';

export interface NotificationCenterProps {
  readonly items: readonly ActivityItem[];
  readonly locale: ShellLocale;
  readonly onClose: () => void;
  readonly onOpenActivity: () => void;
}

const copyFor = (locale: ShellLocale) =>
  locale === 'pt-BR'
    ? {
        action: 'Revisar agora',
        attention: 'requer atenção',
        close: 'Fechar notificações',
        description: 'Acompanhe avisos importantes, recuperações e resultados recentes do seu PC.',
        empty: 'Nenhuma notificação nova.',
        eyebrow: 'Central do sistema',
        footer: 'Ver todas as atividades',
        title: 'Notificações',
      }
    : {
        action: 'Review now',
        attention: 'requires attention',
        close: 'Close notifications',
        description: 'Track important alerts, recovery steps, and recent PC results.',
        empty: 'No new notifications.',
        eyebrow: 'System center',
        footer: 'View all activity',
        title: 'Notifications',
      };

const stateLabelFor = (item: ActivityItem, locale: ShellLocale): string => {
  const labels: Readonly<Record<ActivityItem['state'], readonly [string, string]>> = {
    'contradictory-evidence': ['Evidência contraditória', 'Contradictory evidence'],
    empty: ['Sem atividade', 'No activity'],
    'expired-entitlement': ['Acesso expirado', 'Expired access'],
    fixture: ['Dados de teste', 'Test data'],
    loading: ['Atualizando', 'Updating'],
    offline: ['Offline', 'Offline'],
    'partial-failure': ['Falha parcial', 'Partial failure'],
    permission: ['Permissão necessária', 'Permission required'],
    recovery: ['Recuperação', 'Recovery'],
    'restart-pending': ['Reinicialização pendente', 'Restart pending'],
    'stale-evidence': ['Dados desatualizados', 'Stale data'],
    unsupported: ['Indisponível', 'Unavailable'],
  };
  return labels[item.state][locale === 'pt-BR' ? 0 : 1];
};

export const NotificationCenter = ({
  items,
  locale,
  onClose,
  onOpenActivity,
}: NotificationCenterProps) => {
  const copy = copyFor(locale);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  const openActivity = (): void => {
    onClose();
    onOpenActivity();
  };

  return (
    <div
      className="desktop-notification-layer"
      data-notification-layer
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="presentation"
    >
      <aside
        aria-describedby="desktop-notification-description"
        aria-labelledby="desktop-notification-title"
        aria-modal="true"
        className="desktop-notification-drawer"
        data-lb-region
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="desktop-notification-header">
          <div className="desktop-notification-heading">
            <span className="desktop-notification-mark">
              <ProductIcon name="bell" size={20} />
            </span>
            <div>
              <span>{copy.eyebrow}</span>
              <h2 id="desktop-notification-title">{copy.title}</h2>
            </div>
          </div>
          <LbIconButton
            icon={<ProductIcon name="close" size={18} />}
            label={copy.close}
            onPress={onClose}
            variant="quiet"
          />
        </header>

        <p className="desktop-notification-description" id="desktop-notification-description">
          {copy.description}
        </p>

        <div className="desktop-notification-summary">
          <strong>{items.length}</strong>
          <span>{copy.attention}</span>
          <span aria-hidden="true" className="desktop-notification-summary-line" />
        </div>

        <div className="desktop-notification-feed">
          {items.length === 0 ? (
            <p className="desktop-notification-empty">{copy.empty}</p>
          ) : (
            items.map((item) => (
              <article
                className="desktop-notification-item"
                data-notification-state={item.state}
                key={item.id}
              >
                <span className="desktop-notification-item-icon">
                  <ProductIcon name="activity" size={19} />
                </span>
                <div className="desktop-notification-item-copy">
                  <span className="desktop-notification-item-meta">
                    {stateLabelFor(item, locale)}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <LbButton onPress={openActivity} variant="secondary">
                    {copy.action}
                  </LbButton>
                </div>
                <span aria-hidden="true" className="desktop-notification-unread" />
              </article>
            ))
          )}
        </div>

        <footer className="desktop-notification-footer">
          <LbButton onPress={openActivity} variant="quiet">
            {copy.footer}
          </LbButton>
        </footer>
      </aside>
    </div>
  );
};

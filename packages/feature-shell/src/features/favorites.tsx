import { LbButton, LbIconButton, ProductIcon, StatusSignal } from '@liiiraa/design-system';
import { useState } from 'react';

import {
  FAVORITE_LIMITS,
  HOME_PRIORITY_REGIONS,
  reduceFavorites,
  type Favorite,
  type FavoriteKind,
} from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export interface FavoriteCandidate extends Favorite {
  readonly eligibility: 'safe' | 'restricted';
  readonly restrictionReason?: string;
}

export interface FavoritesManagerProps {
  readonly candidates: readonly FavoriteCandidate[];
  readonly headingLevel?: 'h1' | 'h2';
  readonly initialFavorites: readonly Favorite[];
  readonly locale: ShellLocale;
  readonly onChange?: (favorites: readonly Favorite[]) => void;
}

const KIND_LABELS: Readonly<Record<ShellLocale, Readonly<Record<FavoriteKind, string>>>> = {
  en: { game: 'Games', metric: 'Metrics', 'safe-action': 'Safe actions' },
  'pt-BR': { game: 'Jogos', metric: 'Métricas', 'safe-action': 'Ações seguras' },
};

export const FavoritesManager = ({
  candidates,
  headingLevel = 'h1',
  initialFavorites,
  locale,
  onChange,
}: FavoritesManagerProps) => {
  const [favorites, setFavorites] = useState(() =>
    initialFavorites.reduce<readonly Favorite[]>(
      (current, favorite) => reduceFavorites(current, { type: 'pin', favorite }),
      [],
    ),
  );
  const [announcement, setAnnouncement] = useState('');
  const isPtBr = locale === 'pt-BR';
  const Heading = headingLevel;
  const SectionHeading = headingLevel === 'h1' ? 'h2' : 'h3';

  const update = (
    action:
      | Readonly<{ type: 'move'; id: string; direction: 'left' | 'right' }>
      | Readonly<{ type: 'pin'; favorite: Favorite }>
      | Readonly<{ type: 'remove'; id: string }>,
    message: string,
  ) => {
    const next = reduceFavorites(favorites, action);
    setFavorites(next);
    setAnnouncement(message);
    onChange?.(next);
  };

  return (
    <section aria-labelledby="favorites-manager-title" data-lb-region>
      <header>
        <Heading id="favorites-manager-title">
          {isPtBr ? 'Gerenciar favoritos' : 'Manage favorites'}
        </Heading>
        <p>
          {isPtBr
            ? 'Favoritos aparecem somente na linha designada e não alteram as três prioridades do Início.'
            : 'Favorites appear only in the designated row and never change the three Home priorities.'}
        </p>
      </header>

      <ol aria-label={isPtBr ? 'Prioridades fixas do Início' : 'Locked Home priorities'}>
        {HOME_PRIORITY_REGIONS.map((region) => (
          <li data-locked="true" key={region}>
            {region}
          </li>
        ))}
      </ol>

      <div aria-live="polite" role="status">
        {announcement}
      </div>

      {(Object.keys(FAVORITE_LIMITS) as FavoriteKind[]).map((kind) => {
        const items = favorites.filter((favorite) => favorite.kind === kind);
        return (
          <section aria-labelledby={`favorites-${kind}`} key={kind}>
            <SectionHeading id={`favorites-${kind}`}>{KIND_LABELS[locale][kind]}</SectionHeading>
            <p>
              {String(items.length)}/{String(FAVORITE_LIMITS[kind])}
            </p>
            {items.length === 0 ? (
              <StatusSignal
                detail={
                  isPtBr ? 'Nenhum favorito nesta categoria.' : 'No favorite in this category.'
                }
                locale={locale}
                state="empty"
              />
            ) : (
              <ol>
                {items.map((favorite, index) => (
                  <li key={favorite.id}>
                    <span>{favorite.label}</span>
                    <LbIconButton
                      icon={<ProductIcon name="chevronLeft" size={16} />}
                      isDisabled={index === 0}
                      label={isPtBr ? 'Mover para a esquerda' : 'Move left'}
                      onPress={() => {
                        update(
                          { type: 'move', id: favorite.id, direction: 'left' },
                          isPtBr
                            ? `${favorite.label} movido para a esquerda.`
                            : `${favorite.label} moved left.`,
                        );
                      }}
                      variant="quiet"
                    />
                    <LbIconButton
                      icon={<ProductIcon name="chevronRight" size={16} />}
                      isDisabled={index === items.length - 1}
                      label={isPtBr ? 'Mover para a direita' : 'Move right'}
                      onPress={() => {
                        update(
                          { type: 'move', id: favorite.id, direction: 'right' },
                          isPtBr
                            ? `${favorite.label} movido para a direita.`
                            : `${favorite.label} moved right.`,
                        );
                      }}
                      variant="quiet"
                    />
                    <LbIconButton
                      icon={<ProductIcon name="trash" size={16} />}
                      label={isPtBr ? 'Remover favorito' : 'Remove favorite'}
                      onPress={() => {
                        update(
                          { type: 'remove', id: favorite.id },
                          isPtBr ? `${favorite.label} removido.` : `${favorite.label} removed.`,
                        );
                      }}
                      variant="quiet"
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}

      <section aria-labelledby="favorite-candidates-title">
        <SectionHeading id="favorite-candidates-title">
          {isPtBr ? 'Itens disponíveis' : 'Available items'}
        </SectionHeading>
        <ul>
          {candidates.map((candidate) => {
            const atLimit =
              favorites.filter((favorite) => favorite.kind === candidate.kind).length >=
              FAVORITE_LIMITS[candidate.kind];
            const alreadyPinned = favorites.some((favorite) => favorite.id === candidate.id);
            const unavailable = candidate.eligibility !== 'safe' || atLimit || alreadyPinned;
            return (
              <li key={candidate.id}>
                <span>{candidate.label}</span>
                {candidate.eligibility === 'restricted' ? (
                  <StatusSignal
                    detail={
                      candidate.restrictionReason ??
                      (isPtBr
                        ? 'Ações privilegiadas ou destrutivas não podem ser favoritas.'
                        : 'Privileged or destructive actions cannot be favorites.')
                    }
                    locale={locale}
                    state="permission"
                  />
                ) : null}
                <LbButton
                  isDisabled={unavailable}
                  onPress={() => {
                    update(
                      { type: 'pin', favorite: candidate },
                      isPtBr ? `${candidate.label} fixado.` : `${candidate.label} pinned.`,
                    );
                  }}
                  variant="secondary"
                >
                  <ProductIcon name="pin" size={16} />
                  {isPtBr ? 'Fixar favorito' : 'Pin favorite'}
                </LbButton>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
};

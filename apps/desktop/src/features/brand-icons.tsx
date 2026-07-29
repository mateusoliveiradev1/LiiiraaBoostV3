import {
  si7zip,
  siAmd,
  siAndroidstudio,
  siBrave,
  siCounterstrike,
  siDocker,
  siDiscord,
  siEpicgames,
  siFirefoxbrowser,
  siFortnite,
  siIntel,
  siNvidia,
  siObsstudio,
  siPubg,
  siSteam,
  siValorant,
  type SimpleIcon,
} from 'simple-icons';
import type { CSSProperties, ReactNode } from 'react';

const BRAND_ICONS: Readonly<Record<string, SimpleIcon>> = Object.freeze({
  '7zip': si7zip,
  'amd-adrenalin': siAmd,
  'amd-chipset': siAmd,
  amd: siAmd,
  'android-studio': siAndroidstudio,
  brave: siBrave,
  'brave-installed': siBrave,
  'counter-strike-2': siCounterstrike,
  docker: siDocker,
  'docker-desktop': siDocker,
  discord: siDiscord,
  epic: siEpicgames,
  firefox: siFirefoxbrowser,
  fortnite: siFortnite,
  intel: siIntel,
  nvidia: siNvidia,
  'nvidia-app': siNvidia,
  obs: siObsstudio,
  pubg: siPubg,
  steam: siSteam,
  valorant: siValorant,
});

export interface BrandIconProps {
  readonly brand: string;
  readonly label?: string;
  readonly size?: number;
}

const normalizeBrand = (brand: string): string => {
  const normalized = brand.trim().toLocaleLowerCase('en-US');
  if (normalized.includes('nvidia') || normalized.includes('geforce')) return 'nvidia';
  if (normalized.includes('amd') || normalized.includes('ryzen') || normalized.includes('radeon'))
    return 'amd';
  if (normalized.includes('intel')) return 'intel';
  if (normalized.includes('counter-strike')) return 'counter-strike-2';
  if (normalized.includes('fortnite')) return 'fortnite';
  if (normalized.includes('pubg') || normalized.includes('battlegrounds')) return 'pubg';
  if (normalized.includes('valorant')) return 'valorant';
  return normalized;
};

const MicrosoftMark = ({ size }: { readonly size: number }): ReactNode => (
  <svg
    aria-hidden="true"
    className="premium-brand-svg premium-brand-svg-microsoft"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M2 2h9v9H2V2Z" fill="#f25022" />
    <path d="M13 2h9v9h-9V2Z" fill="#7fba00" />
    <path d="M2 13h9v9H2v-9Z" fill="#00a4ef" />
    <path d="M13 13h9v9h-9v-9Z" fill="#ffb900" />
  </svg>
);

const WindowsMark = ({ size }: { readonly size: number }): ReactNode => (
  <svg
    aria-hidden="true"
    className="premium-brand-svg premium-brand-svg-windows"
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="m2 4.7 8.3-1.1v8H2V4.7Zm9.5-1.3L22 2v9.6H11.5V3.4ZM2 12.8h8.3v8L2 19.7v-6.9Zm9.5 0H22V22l-10.5-1.4v-7.8Z" />
  </svg>
);

const OpenAIMark = ({ size }: { readonly size: number }): ReactNode => (
  <svg
    aria-hidden="true"
    className="premium-brand-svg premium-brand-svg-openai"
    height={size}
    viewBox="0 0 256 260"
    width={size}
  >
    <path d="M239.184 106.203a64.72 64.72 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.72 64.72 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.67 64.67 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.77 64.77 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483m-97.56 136.338a48.4 48.4 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.6 8.6 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601M37.158 197.93a48.35 48.35 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.34 8.34 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803M23.549 85.38a48.5 48.5 0 0 1 25.58-21.333v61.39a8.29 8.29 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.82.82 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405zm179.466 41.695-63.08-36.63L161.73 77.86a.82.82 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.54 8.54 0 0 0-4.4-7.213m21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.72.72 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391zM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.6 8.6 0 0 0-4.246 7.367zm11.868-25.58L128.067 97.3l28.188 16.218v32.434l-28.086 16.218-28.188-16.218z" />
  </svg>
);

export const BrandIcon = ({ brand, label, size = 24 }: BrandIconProps): ReactNode => {
  const normalized = normalizeBrand(brand);
  const icon = BRAND_ICONS[normalized];
  const accessibleLabel = label ?? brand;
  const specialColor =
    normalized === 'windows'
      ? '0078D4'
      : normalized === 'chatgpt' || normalized === 'openai'
        ? '10A37F'
        : '7f91a8';
  const style = { '--brand-color': `#${icon?.hex ?? specialColor}` } as CSSProperties;

  if (normalized.includes('windows')) {
    return (
      <span
        aria-label={accessibleLabel}
        className="premium-brand-icon"
        data-brand={normalized}
        data-brand-source="local-official-mark"
        role="img"
        style={style}
      >
        <WindowsMark size={size} />
      </span>
    );
  }

  if (
    normalized.includes('microsoft') ||
    normalized.includes('webview') ||
    normalized.includes('xbox')
  ) {
    return (
      <span
        aria-label={accessibleLabel}
        className="premium-brand-icon"
        data-brand={normalized}
        data-brand-source="local-official-mark"
        role="img"
        style={style}
      >
        <MicrosoftMark size={size} />
      </span>
    );
  }

  if (normalized === 'chatgpt' || normalized === 'openai') {
    return (
      <span
        aria-label={accessibleLabel}
        className="premium-brand-icon"
        data-brand={normalized}
        data-brand-source="local-official-mark"
        role="img"
        style={style}
      >
        <OpenAIMark size={size} />
      </span>
    );
  }

  if (icon === undefined) {
    return (
      <span
        aria-label={accessibleLabel}
        className="premium-brand-icon premium-brand-icon-fallback"
        data-brand={normalized}
        data-brand-source="fallback"
        role="img"
        style={style}
      >
        {accessibleLabel.slice(0, 2).toLocaleUpperCase('pt-BR')}
      </span>
    );
  }

  return (
    <span
      aria-label={accessibleLabel}
      className="premium-brand-icon"
      data-brand={normalized}
      data-brand-source="simple-icons"
      role="img"
      style={style}
    >
      <svg
        aria-hidden="true"
        className="premium-brand-svg"
        height={size}
        viewBox="0 0 24 24"
        width={size}
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
};

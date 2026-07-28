declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  export interface Root {
    readonly render: (children: ReactNode) => void;
    readonly unmount: () => void;
  }

  export const createRoot: (container: Element | DocumentFragment) => Root;
}

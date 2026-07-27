declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: string[],
    options: {
      cwd: string;
      encoding: 'utf8';
      maxBuffer: number;
      windowsHide: boolean;
    },
    callback: (
      error: (Error & { code?: string | number }) | null,
      stdout: string,
      stderr: string,
    ) => void,
  ): void;
}

declare module 'node:crypto' {
  interface Hash {
    update(value: string): Hash;
    digest(encoding: 'hex'): string;
  }

  export function createHash(algorithm: 'sha256'): Hash;
}

declare module 'node:fs/promises' {
  export function mkdtemp(prefix: string): Promise<string>;
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
  export function rm(
    path: string,
    options?: { force?: boolean; recursive?: boolean },
  ): Promise<void>;
  export function writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function basename(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  argv: string[];
  exitCode?: number;
};

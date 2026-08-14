declare module 'node:crypto' {
  interface Hash {
    update(value: string | Uint8Array, inputEncoding?: 'utf8'): Hash;
    digest(encoding: 'hex'): string;
  }

  export function createHash(algorithm: 'sha256'): Hash;
}

declare module 'node:fs' {
  interface Dirent {
    name: string;
    isDirectory(): boolean;
  }

  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: string): Buffer;
  export function writeFileSync(
    path: string,
    data: string | Uint8Array,
    options?: { flag?: string } | string,
  ): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function mkdtempSync(prefix: string): string;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function renameSync(oldPath: string, newPath: string): void;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function unlinkSync(path: string): void;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:child_process' {
  export interface SpawnSyncReturns<T> {
    pid: number;
    output: unknown[];
    stdout: T;
    stderr: T;
    status: number | null;
    signal: string | null;
  }

  export function spawnSync(
    command: string,
    args?: readonly string[],
    options?: { encoding?: string },
  ): SpawnSyncReturns<string | Buffer>;
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string;
  export function pathToFileURL(path: string): { href: string };
}

declare const process: {
  argv: string[];
  pid: number;
  exitCode?: number;
  cwd(): string;
  chdir(path: string): void;
  stderr: { write(value: string): void };
  stdout: { write(value: string): void };
};

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}

declare const Buffer: {
  alloc(size: number): Buffer;
  from(value: string): Buffer;
  byteLength(value: string, encoding?: string): number;
};

declare module 'node:fs/promises' {
  interface DirectoryEntry {
    readonly name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  export function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
  export function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<DirectoryEntry[]>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
  export function rm(
    path: string,
    options?: { force?: boolean; recursive?: boolean },
  ): Promise<void>;
  export function writeFile(path: string, data: string, encoding: 'utf8'): Promise<void>;
}

declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: {
      cwd: string;
      encoding: 'utf8';
      env?: Record<string, string | undefined>;
      maxBuffer: number;
      windowsHide: boolean;
    },
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  execPath: string;
  exitCode?: number;
  pid: number;
};

interface ImportMeta {
  readonly url: string;
}

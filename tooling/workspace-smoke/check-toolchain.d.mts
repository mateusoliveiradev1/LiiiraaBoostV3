export interface WorkspaceSnapshot {
  packageManifest: {
    packageManager: string;
    devEngines: {
      runtime: { name: string; version: string };
      packageManager: { name: string; version: string };
    };
    devDependencies: { typescript: string };
  };
  pnpmRoots: string[];
  rust: { channel: string; profile: string; components: string[] };
  cargo: { resolver: string; memberRoots: string[] };
  packageNames: string[];
}

export interface ActualVersions {
  node: string;
  pnpm: string;
}

export function verifyWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  actualVersions: ActualVersions,
): Readonly<Record<string, unknown>>;

export function verifyWorkspace(
  root: string,
  actualVersions: ActualVersions,
): Readonly<Record<string, unknown>>;

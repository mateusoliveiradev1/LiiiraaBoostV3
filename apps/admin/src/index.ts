export const adminWebComposition = (kind: 'preview' | 'production') =>
  Object.freeze({
    runtimeClass: kind === 'production' ? 'server-authority' : 'fixture',
    surface: 'admin',
    authorityConnected: kind === 'production',
    ordinaryNavigationLinked: false,
    ...(kind === 'preview' ? { previewRole: 'support' as const } : {}),
  } as const);

export const ADMIN_WEB_COMPOSITION = adminWebComposition('preview');

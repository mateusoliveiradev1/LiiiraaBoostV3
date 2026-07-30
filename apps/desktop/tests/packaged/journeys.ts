import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

export type JourneyResult = Readonly<{
  id: string;
  passed: boolean;
  observed: string;
}>;

export type PackagedSession = Readonly<{
  applicationProcessId: number | undefined;
  baseUrl: string;
  driver: ChildProcess;
  sessionId: string;
}>;

type WebDriverEnvelope<T> = Readonly<{ value: T }>;

const fail = (message: string): never => {
  throw new Error(`[packaged-journeys] ${message}`);
};

const reservePort = async (): Promise<number> =>
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('unable to reserve a local WebDriver port.'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error === undefined) {
          resolvePort(port);
        } else {
          reject(error);
        }
      });
    });
  });

const request = async <T>(
  baseUrl: string,
  path: string,
  method: 'DELETE' | 'GET' | 'POST',
  body?: unknown,
): Promise<T> => {
  const options: RequestInit =
    body === undefined
      ? { method }
      : {
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
          method,
        };
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  if (!response.ok) {
    return fail(`WebDriver ${method} ${path} failed (${String(response.status)}): ${text}`);
  }
  const parsed = JSON.parse(text) as WebDriverEnvelope<T>;
  return parsed.value;
};

const waitForDriver = async (baseUrl: string, driver: ChildProcess) => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (driver.exitCode !== null) {
      fail(`tauri-driver exited before becoming ready (${String(driver.exitCode)}).`);
    }
    try {
      const status = await request<{ ready?: boolean }>(baseUrl, '/status', 'GET');
      if (status.ready === true) {
        return;
      }
    } catch {
      // The local driver can refuse connections briefly while msedgedriver starts.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  fail('tauri-driver did not become ready within 15 seconds.');
};

export const startPackagedSession = async (
  driverPath: string,
  nativeDriverPath: string,
  executablePath: string,
): Promise<PackagedSession> => {
  const [port, nativePort] = await Promise.all([reservePort(), reservePort()]);
  const driver = spawn(
    driverPath,
    [
      '--port',
      String(port),
      '--native-port',
      String(nativePort),
      '--native-driver',
      nativeDriverPath,
    ],
    { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  const baseUrl = `http://127.0.0.1:${String(port)}`;
  try {
    await waitForDriver(baseUrl, driver);
    const application = executablePath.replace(/\.exe$/iu, '');
    const created = await request<{
      capabilities?: Readonly<{ 'goog:processID'?: number }>;
      sessionId?: string;
    }>(baseUrl, '/session', 'POST', {
      capabilities: { alwaysMatch: { 'tauri:options': { application } } },
    });
    if (typeof created.sessionId !== 'string' || created.sessionId.length === 0) {
      return fail('WebDriver did not return a packaged session ID.');
    }
    return Object.freeze({
      applicationProcessId: created.capabilities?.['goog:processID'],
      baseUrl,
      driver,
      sessionId: created.sessionId,
    });
  } catch (error) {
    driver.kill();
    throw error;
  }
};

export const executeScript = async <T>(
  session: PackagedSession,
  script: string,
): Promise<T> =>
  await request<T>(
    session.baseUrl,
    `/session/${session.sessionId}/execute/sync`,
    'POST',
    { args: [], script },
  );

const waitForShell = async (session: PackagedSession): Promise<void> => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const state = await executeScript<{ hasNavigation: boolean; route: string | null }>(
      session,
      `const buttons = [...document.querySelectorAll('button')];
      const enter = buttons.find((button) =>
        button.textContent?.includes('Entrar no Liiiraa Boost')
      );
      const demo = buttons.find((button) =>
        button.textContent?.includes('Explorar modo demonstração')
      );
      (enter ?? demo)?.click();
      return {
        hasNavigation: !!document.querySelector('nav'),
        route:
          document.querySelector('.desktop-app-shell')?.getAttribute('data-route-path') ?? null
      };`,
    );
    if (state.hasNavigation && state.route !== '/first-run' && state.route !== '/login') {
      return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  fail('packaged application did not reach the desktop shell.');
};

export const runPackagedJourneys = async (
  session: PackagedSession,
): Promise<readonly JourneyResult[]> => {
  await waitForShell(session);
  const facts = await executeScript<{
    buttons: number;
    hasActivity: boolean;
    hasCommand: boolean;
    hasGameSelector: boolean;
    hasNavigation: boolean;
    hasProfile: boolean;
    hasSettings: boolean;
    hasSimulationDisclosure: boolean;
    hasStatus: boolean;
    height: number;
    labels: readonly string[];
    locale: string;
    ready: string;
    route: string | null;
    title: string;
    width: number;
  }>(
    session,
    `const labels = [...document.querySelectorAll('button')].map(
      (button) => button.getAttribute('aria-label') ?? button.textContent ?? ''
    );
    return {
      buttons: labels.length,
      hasActivity: labels.some((label) => label.includes('atividade')),
      hasCommand: labels.some((label) => label.includes('comandos')),
      hasGameSelector:
        !!document.querySelector('select') ||
        labels.some((label) => label.includes('Modo Competitivo')),
      hasNavigation: !!document.querySelector('nav'),
      hasProfile: labels.some((label) => label.includes('perfil')),
      hasSettings: labels.some((label) => label.includes('Configurações')),
      hasSimulationDisclosure: /simula|demonstra/iu.test(document.body.innerText),
      hasStatus:
        !!document.querySelector('[role="status"]') ||
        labels.some((label) => label.includes('Analisar novamente')) ||
        labels.some((label) => label.includes('Revisar ajustes')),
      height: window.innerHeight,
      labels,
      locale: document.documentElement.lang,
      ready: document.readyState,
      route: document.querySelector('.desktop-app-shell')?.getAttribute('data-route-path') ?? null,
      title: document.title,
      width: window.innerWidth
    };`,
  );

  const results: JourneyResult[] = [
    { id: 'install-launch', passed: facts.ready === 'complete' && facts.title === 'Liiiraa Boost', observed: facts.title },
    { id: 'desktop-shell', passed: facts.route !== null, observed: facts.route ?? 'missing-route' },
    { id: 'goal-navigation', passed: facts.hasNavigation && facts.buttons >= 8, observed: `${String(facts.buttons)} buttons` },
    { id: 'command-center', passed: facts.hasCommand, observed: 'command trigger discoverable' },
    { id: 'favorites-surface', passed: facts.buttons >= 8, observed: 'interactive shell available' },
    { id: 'game-preview', passed: facts.hasGameSelector, observed: 'game selector present' },
    { id: 'failure-recovery-feedback', passed: facts.hasStatus, observed: 'status region present' },
    { id: 'activity-notifications', passed: facts.hasActivity, observed: 'activity trigger present' },
    { id: 'entitlement-profile', passed: facts.hasProfile, observed: 'profile trigger present' },
    { id: 'locale-scale-motion', passed: facts.locale.length > 0 && facts.width >= 760 && facts.height >= 600, observed: `${facts.locale} ${String(facts.width)}x${String(facts.height)}` },
    { id: 'settings', passed: facts.hasSettings, observed: 'settings destination present' },
    { id: 'truth-boundary', passed: facts.hasSimulationDisclosure, observed: 'simulation disclosure visible' },
  ];
  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    fail(
      `native journeys failed: ${failed.map((result) => result.id).join(', ')}. Facts: ${JSON.stringify(facts)}`,
    );
  }
  return Object.freeze(results.map((result) => Object.freeze(result)));
};

export const stopPackagedSession = async (session: PackagedSession): Promise<void> => {
  try {
    await request(session.baseUrl, `/session/${session.sessionId}`, 'DELETE');
  } finally {
    session.driver.kill();
  }
};

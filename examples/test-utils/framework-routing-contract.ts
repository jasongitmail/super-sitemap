import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

export type FrameworkRoutingCase = {
  expectedStatus: number;
  path: string;
};

type RunningDevServer = {
  origin: string;
  output: string[];
  process: ChildProcessWithoutNullStreams;
};

export const optionalStaticSuffixSuccessPaths = [
  '/optionals/many/foo',
  '/optionals/many/data-a1/foo',
  '/optionals/many/data-a1/data-b1/foo',
] as const;

export const localizedOptionalStaticSuffixSuccessPaths = [
  '/zh/optionals/many/foo',
  '/zh/optionals/many/data-a1/foo',
  '/zh/optionals/many/data-a1/data-b1/foo',
] as const;

export const optionalStaticSuffixRoutingCases: FrameworkRoutingCase[] = [
  ...optionalStaticSuffixSuccessPaths.map((path) => ({ expectedStatus: 200, path })),
  ...localizedOptionalStaticSuffixSuccessPaths.map((path) => ({ expectedStatus: 200, path })),
  { expectedStatus: 404, path: '/optionals/many/data-a1/data-b1' },
  { expectedStatus: 404, path: '/zh/optionals/many/data-a1/data-b1' },
];

/**
 * Runs shared framework-routing assertions against a real example app dev server.
 *
 * @remarks
 * These tests document the framework routing behavior Super Sitemap mirrors.
 * They intentionally assert only route status codes, not rendering details.
 */
export function describeFrameworkRoutingContract({
  appName,
  cases,
  rootDir,
}: {
  appName: string;
  cases: FrameworkRoutingCase[];
  rootDir: string;
}): void {
  describe(`${appName} framework routing contract`, () => {
    let devServer: RunningDevServer | undefined;

    beforeAll(async () => {
      devServer = await startExampleDevServer(rootDir);
    });

    afterAll(async () => {
      await stopExampleDevServer(devServer);
    });

    for (const routeCase of cases) {
      it(`${routeCase.path} returns ${routeCase.expectedStatus}`, async () => {
        if (!devServer) throw new Error('Dev server did not start.');

        const response = await fetch(new URL(routeCase.path, devServer.origin));

        expect(response.status).toBe(routeCase.expectedStatus);
      });
    }
  });
}

/**
 * Starts an example app's real Vite dev server on an available localhost port.
 */
async function startExampleDevServer(rootDir: string): Promise<RunningDevServer> {
  const port = await getAvailablePort();
  const origin = `http://127.0.0.1:${port}`;
  const devProcess = spawn(
    'bun',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: rootDir,
      env: { ...process.env, BROWSER: 'none' },
    }
  );
  const output: string[] = [];

  devProcess.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  devProcess.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString()));

  try {
    await waitForHttpServer(origin, devProcess, output);
  } catch (error) {
    devProcess.kill('SIGTERM');
    throw error;
  }

  return { origin, output, process: devProcess };
}

/**
 * Stops an example app dev server and waits for process cleanup.
 */
async function stopExampleDevServer(devServer: RunningDevServer | undefined): Promise<void> {
  if (!devServer || devServer.process.killed) return;

  devServer.process.kill('SIGTERM');

  await new Promise<void>((resolve) => {
    devServer.process.once('exit', () => resolve());
    setTimeout(resolve, 1000);
  });
}

/**
 * Finds an available localhost TCP port for the test dev server.
 */
async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Expected TCP address from temporary server.'));
          return;
        }

        resolve(address.port);
      });
    });
  });
}

/**
 * Polls the dev server until it accepts HTTP requests or exits.
 */
async function waitForHttpServer(
  origin: string,
  devProcess: ChildProcessWithoutNullStreams,
  output: string[]
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    if (devProcess.exitCode !== null) {
      throw new Error(`Dev server exited early.\n${output.join('')}`);
    }

    try {
      const response = await fetch(origin);
      await response.arrayBuffer();
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error(`Timed out waiting for dev server at ${origin}.\n${output.join('')}`);
}

/**
 * Waits for the requested number of milliseconds.
 */
async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

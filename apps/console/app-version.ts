import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'

/**
 * Stamps every build with a version and publishes it at `/meta.json`, as V1's
 * `scripts/generate-meta.js` does, so a running console can tell when a newer
 * build has been deployed (`app/versionCheck`).
 *
 * The version is the deploy's commit: Vercel's, else the checkout's, else the
 * build time. It reaches the app as `import.meta.env.VITE_APP_VERSION` (read
 * in `env.ts`, like every other variable) and the same value is written to
 * `meta.json`, so the two only differ once a new build is live.
 */
export function appVersion(): Plugin {
  const version =
    process.env['VITE_APP_VERSION'] ||
    process.env['VERCEL_GIT_COMMIT_SHA'] ||
    gitHead() ||
    `build-${Date.now()}`

  return {
    name: 'fp-app-version',
    config: () => ({
      define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
    }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'meta.json',
        source: `${JSON.stringify({ versionId: version })}\n`,
      })
    },
  }
}

function gitHead(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return undefined
  }
}

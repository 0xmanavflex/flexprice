import { env } from '@/env'
import { readSession } from './storage'

/**
 * Whether the console should insist on a sign-in, asked outside React.
 *
 * The route guard runs in TanStack's `beforeLoad`, which is not a component and
 * has no access to context. That is the right place for it — a guard that runs
 * during render has already mounted the shell, so a signed-out visitor sees the
 * sidebar flash before being redirected — and it works here only because the
 * session is in `localStorage`, which is synchronous. `readSession()` and the
 * provider's initial state are the same read, so the two never disagree.
 *
 * Two ways out, and neither is a loophole worth worrying about:
 *
 *   - **Mocks.** The fixture corpus answers every request without a token, and
 *     the whole Storybook and end-to-end flow depends on the app being usable
 *     with no account. A sign-in wall in front of a mock backend protects
 *     nothing and breaks everything that is not a browser with a human in it.
 *   - **An API key.** Development only; `env.apiKey` is `null` in a production
 *     build. The key authenticates on its own, so demanding a session as well
 *     would just be a form standing in front of credentials that already work.
 */
export function bypassesSignIn(): boolean {
  return env.useMocks || env.apiKey !== null
}

/** True when the visitor must be sent to `/sign-in` before seeing anything. */
export function needsSignIn(): boolean {
  if (bypassesSignIn()) return false
  return readSession() === null
}

/**
 * Whether a real session exists, regardless of whether one is required.
 *
 * Deliberately not `!needsSignIn()`. The two differ exactly in the bypass
 * cases, and that difference is the point: under mocks nobody is signed in,
 * they simply do not need to be, so `/sign-in` should still *render* — it is a
 * surface the fixture-backed end-to-end suite and Storybook have to be able to
 * reach. Only an actual session makes the page pointless, which is what this
 * answers.
 */
export function hasSession(): boolean {
  return readSession() !== null
}

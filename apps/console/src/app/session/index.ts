/**
 * The app's session surface.
 *
 * One module owns who is signed in, which environment they are working in, how
 * that survives a refresh, and how a request proves it. Everything else in the
 * app reads it through `useSession()`.
 */
export { SessionProvider, useSession, useSessionRef } from './SessionProvider'
export type { Session, SessionStatus, SessionValue } from './SessionProvider'
export { useAuthSource } from './useAuthSource'
export { useSupabaseSessionSync } from './useSupabaseSessionSync'
export { getActiveEnvironmentId } from './activeEnvironment'
export { bypassesSignIn, hasSession, needsSignIn } from './guard'
export {
  clearEnvironmentId,
  clearSession,
  readEnvironmentId,
  readSession,
  writeEnvironmentId,
  writeSession,
} from './storage'
export type { StoredSession } from './storage'

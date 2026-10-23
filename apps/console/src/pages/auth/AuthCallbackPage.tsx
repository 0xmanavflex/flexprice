import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AuthFrame } from '@fp/ui/pages'
import { Button } from '@fp/ui/primitives'
import { readHandoff } from '../../app/session/samlHandoff'
import { useSession } from '../../app/session'
import { takeReturnTo } from './returnTo'

/**
 * Where a SAML login lands.
 *
 * The backend finishes an assertion by sending the browser here with the
 * token in the URL fragment (`auth.saml.dashboard_url`, `/auth/callback` by
 * default). This page is the whole of the dashboard's side of that contract:
 *
 *  - read the fragment once, then **strip it from the URL**, because a
 *    fragment stays in browser history and is readable by any script that
 *    runs afterwards;
 *  - refuse a callback whose tenant is not the tenant this browser started a
 *    login to, which is what stops a token minted elsewhere being planted
 *    mid-login;
 *  - sign in and go where the person was heading.
 *
 * It renders a line rather than a form: nobody arrives here by choice, and the
 * work is over in a tick. The only thing worth showing is the failure.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const [failed, setFailed] = useState(false)
  // Strict mode mounts effects twice, and the hand-off is single-use: the
  // second read would find the tenant already spent and refuse a good login.
  const consumed = useRef(false)

  useEffect(() => {
    if (consumed.current) return
    consumed.current = true

    const hash = globalThis.location?.hash ?? ''
    // Reading the property is itself what throws in a blocked-storage
    // browser, so it happens here and the refusal below handles the rest.
    let storage
    try {
      storage = globalThis.sessionStorage
    } catch {
      storage = undefined
    }
    const result = readHandoff(hash, storage)

    /*
     * Clear the fragment before anything else, and whatever the verdict.
     *
     * `replaceState` rather than assigning `location.hash`, which would push a
     * history entry still containing the token. A refused token is cleared
     * too — it is no less worth leaving in history for having been rejected.
     */
    try {
      const { pathname, search } = globalThis.location
      globalThis.history.replaceState(null, '', `${pathname}${search}`)
    } catch {
      /* No history API is not a reason to drop the sign-in. */
    }

    if (!result.ok) {
      setFailed(true)
      return
    }

    // The fragment carries no user id; the token is what authenticates, and
    // `/users/me` fills in who it belongs to once the app is running.
    signIn({ token: result.handoff.token, userId: '', tenantId: result.handoff.tenantId })
    // The relay state is the nonce, not an address: the page to return to was kept when sign-in began.
    void navigate({ href: takeReturnTo() })
  }, [navigate, signIn])

  return (
    <AuthFrame>
      {failed ? (
        <div className="flex flex-col items-start gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl font-medium tracking-tight">Could not finish signing in</h1>
            <p className="text-muted-foreground text-[13px]">
              This sign-in link did not answer a sign-in started in this browser, so it was not
              used. Start again from the sign-in page.
            </p>
          </div>
          <Button onClick={() => void navigate({ to: '/sign-in', search: {} as never })}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-[13px]">Signing you in…</p>
      )}
    </AuthFrame>
  )
}

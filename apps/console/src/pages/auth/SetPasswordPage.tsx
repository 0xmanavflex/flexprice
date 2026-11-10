import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, ErrorKind, usePasswordLinkDetails, useSetPasswordWithLink } from '@fp/query'
import { AuthFrame, SetPasswordForm } from '@fp/ui/pages'
import { useSession } from '@/app/session'
import { readPasswordLinkToken } from '@/app/auth/passwordLink'

const EXPIRED =
  'Links work once, and only for a while: 24 hours for a reset, 7 days for an invitation. Ask your admin for a new one.'

/**
 * The far end of a one-time password link (self-hosted; flexprice#3123).
 *
 * An admin shares `/set-password#token=…`, from an invitation or from
 * "Reset password" on the Team table. The token rides in the fragment so it
 * never reaches a server log or a `Referer`; it is read once, on mount, and
 * then cleared from the address bar so it is not left in the URL to be copied
 * on. V1's address for the same page, `/auth?tab=set-password#token=…`, is
 * redirected here by the router with its fragment.
 *
 * The link is checked first (`POST /auth/password/check`), so a spent or
 * expired one shows that straight away rather than after a password has been
 * typed, and an invitation can say whose account it is.
 *
 * A console session already open in this browser ends once the password is
 * set, as on `/reset-password`: "Go to sign in" would otherwise land on the
 * dashboard of whoever was signed in.
 */
export function SetPasswordPage() {
  const navigate = useNavigate()
  const session = useSession()
  const [linkToken, setLinkToken] = useState(() => readPasswordLinkToken(globalThis.location.hash))
  const details = usePasswordLinkDetails(linkToken)
  const setPassword = useSetPasswordWithLink()
  const resetSave = setPassword.reset
  const [done, setDone] = useState(false)

  /*
   * Take the token out of the address bar, now and whenever another link is
   * opened in this tab: a link that differs only in its fragment changes the
   * hash without reloading, and this page would otherwise keep the old link's
   * state (and leave the new token in the URL).
   */
  useEffect(() => {
    const take = () => {
      const next = readPasswordLinkToken(globalThis.location.hash)
      if (next) {
        setLinkToken(next)
        setDone(false)
        resetSave()
      }
      if (!globalThis.location.hash) return
      globalThis.history.replaceState(
        globalThis.history.state,
        '',
        `${globalThis.location.pathname}${globalThis.location.search}`,
      )
    }
    take()
    globalThis.addEventListener('hashchange', take)
    return () => globalThis.removeEventListener('hashchange', take)
  }, [resetSave])

  const toSignIn = () => void navigate({ to: '/sign-in', search: {} as never })
  const invite = details.data?.purpose === 'invite'
  // A link the server no longer accepts reads as expired, on the check or on
  // the save (spent by another tab in the meantime). Anything else is an error
  // on the form, so the person can try again.
  const linkRefused = (cause: unknown) =>
    cause instanceof ApiError && cause.kind === ErrorKind.NotFound
  const expired =
    !linkToken ||
    linkRefused(details.error) ||
    (setPassword.error !== null && linkRefused(setPassword.error))

  return (
    <main className="bg-background min-h-svh">
      <AuthFrame quote="optimality">
        <SetPasswordForm
          checking={details.isPending && Boolean(linkToken)}
          expired={expired}
          expiredDescription={EXPIRED}
          done={done}
          title={invite ? 'Set your password' : 'Choose a new password'}
          description={
            invite
              ? 'Choose the password you will sign in to Flexprice with.'
              : 'This replaces your old password. Links you were sent before stop working.'
          }
          {...(details.data?.email ? { email: details.data.email } : {})}
          isSubmitting={setPassword.isPending}
          error={
            details.error && !expired
              ? 'Could not check this link. Check your connection and reload the page.'
              : setPassword.error && !expired
                ? setPassword.error instanceof ApiError && setPassword.error.fromServer
                  ? setPassword.error.message
                  : 'Could not save the password. Try again.'
                : null
          }
          onSignIn={toSignIn}
          onSubmit={({ password }) => {
            if (!linkToken) return
            setPassword.mutate(
              { linkToken, password },
              {
                onSuccess: () => {
                  if (session.session) session.signOut()
                  setDone(true)
                },
              },
            )
          }}
        />
      </AuthFrame>
    </main>
  )
}

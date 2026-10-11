import { useState, type ReactNode } from 'react'
import { KeyRoundIcon } from '@ui/icons'
import flexpriceIcon from '@ui/assets/flexprice-icon.png'
import { WaveDots } from '@ui/components/blocks/auth-11/components/wave-dots'
import { Google } from '@ui/components/ui/svgs/google'
import { Button } from '@ui/components/primitives/button'
import { Separator } from '@ui/components/primitives/separator'
import { Source, provenance } from '@ui/provenance'
import { SignInForm, type SignInFormProps } from './SignInForm'

/**
 * The sign-in page, on the reference's `auth-11` layout.
 *
 * Form on the left under the Flexprice mark; on the right the `WaveDots`
 * backdrop (imported from the block, unchanged) with a customer review taking
 * most of the panel and the customer logo row pinned to the bottom.
 *
 * Authentication is `POST /auth/login`; no social or SAML provider is wired to
 * anything yet. The provider buttons are part of the design, so they render,
 * but a click says so in the same place errors are announced instead of
 * appearing to work. Pass `onProvider` once a deployment really has one.
 */
export const SignInScreenProvenance = provenance({
  source: Source.REUI,
  registry: ['auth-11'],
  note: 'The reference sign-in: auth-11 split layout, form left, WaveDots (unchanged) behind a review and customer logo row on the right.',
})

/** One provider button, as the reference draws them. */
interface Provider {
  id: string
  label: string
  logo: ReactNode
}

/** The review beside the form, as the reference sets it. */
const REVIEW = {
  quote:
    'Honestly the customer dashboard was the one thing our team felt the most. We stopped getting those billing questions that used to pile up every month by using Flexprice.',
  name: 'Ram A',
  role: 'Head of Finance, Vapi',
}

const CUSTOMER_LOGOS = ['Krutrim', 'Vapi', 'Simplismart', 'Aftershoot', 'Facilio', 'Gigin']

const PROVIDERS: Provider[] = [
  { id: 'google', label: 'Google', logo: <Google aria-hidden="true" /> },
  { id: 'saml', label: 'SAML SSO', logo: <KeyRoundIcon aria-hidden="true" /> },
]

export interface SignInScreenProps extends SignInFormProps {
  /**
   * Start a social sign-in. Omitted while no deployment has one configured —
   * the buttons then explain themselves rather than failing silently.
   */
  onProvider?: (providerId: string) => void
  /** Offered under the form when a deployment has somewhere to send people. */
  onSignUp?: () => void
  onTerms?: () => void
  onPrivacy?: () => void
  /**
   * A short notice shown above the form. Used under mocks to say the demo
   * credentials are pre-filled; omitted in normal operation. Rendered as a note,
   * not a heading, so it sits below the form's own h1 without breaking hierarchy.
   */
  hint?: ReactNode
}

export function SignInScreen({
  onProvider,
  onSignUp,
  onTerms,
  onPrivacy,
  hint,
  ...form
}: SignInScreenProps) {
  const [providerNotice, setProviderNotice] = useState<string | null>(null)

  return (
    <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="flex min-w-0 flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2">
          <img src={flexpriceIcon} alt="" aria-hidden className="size-7 shrink-0 rounded-md" />
          <span className="text-[15px] font-medium tracking-tight">Flexprice</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-sm flex-col gap-7">
            {hint ? (
              <p
                role="note"
                className="border-primary/30 bg-primary/5 text-muted-foreground rounded-lg border px-3 py-2 text-center text-xs leading-relaxed"
              >
                {hint}
              </p>
            ) : null}

            <SignInForm {...form} />

            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <Separator className="flex-1" />
              or
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {PROVIDERS.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    if (onProvider) {
                      onProvider(provider.id)
                      return
                    }
                    setProviderNotice(
                      `${provider.label} sign-in isn't enabled for this workspace yet — use your email and password.`,
                    )
                  }}
                >
                  {provider.logo}
                  {provider.label}
                </Button>
              ))}
            </div>

            {providerNotice ? (
              <p role="status" className="text-muted-foreground text-center text-sm">
                {providerNotice}
              </p>
            ) : null}

            {onSignUp ? (
              <p className="text-muted-foreground text-center text-sm">
                New to Flexprice?{' '}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-foreground hover:underline"
                >
                  Create an account
                </button>
              </p>
            ) : null}
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          © 2026 Flexprice
          {onPrivacy ? (
            <>
              {' · '}
              <button type="button" onClick={onPrivacy} className="hover:text-foreground">
                Privacy
              </button>
            </>
          ) : null}
          {onTerms ? (
            <>
              {' · '}
              <button type="button" onClick={onTerms} className="hover:text-foreground">
                Terms
              </button>
            </>
          ) : null}
        </p>
      </section>

      <aside className="bg-muted/35 relative hidden overflow-hidden border-l lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute inset-0">
          <WaveDots className="text-muted-foreground [mask-image:radial-gradient(80%_70%_at_50%_45%,black,transparent)]" />
        </div>

        <div className="relative flex flex-1 items-center px-16 xl:px-24">
          <figure className="max-w-2xl space-y-10">
            <blockquote className="text-3xl/[1.35] font-medium tracking-tight text-balance xl:text-4xl/[1.3]">
              “{REVIEW.quote}”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-background flex size-10 items-center justify-center rounded-full border text-sm font-medium"
              >
                {REVIEW.name
                  .split(' ')
                  .map((part) => part.charAt(0))
                  .join('')}
              </span>
              <span>
                <span className="block text-sm font-medium">{REVIEW.name}</span>
                <span className="text-muted-foreground block text-sm">{REVIEW.role}</span>
              </span>
            </figcaption>
          </figure>
        </div>

        <div className="relative space-y-4 border-t px-16 py-8 xl:px-24">
          <p className="text-muted-foreground text-xs">Billing runs on Flexprice at</p>
          <ul className="text-foreground/60 flex flex-wrap items-center gap-x-10 gap-y-3">
            {CUSTOMER_LOGOS.map((name) => (
              <li key={name} className="text-lg font-medium tracking-tight">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

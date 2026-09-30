import { useState, type ReactNode } from 'react'
import { QuoteIcon } from 'lucide-react'
import { WaveDots } from '@ui/components/blocks/auth-11/components/wave-dots'
import { Google } from '@ui/components/ui/svgs/google'
import { GithubLight } from '@ui/components/ui/svgs/githubLight'
import { GithubDark } from '@ui/components/ui/svgs/githubDark'
import { Apple } from '@ui/components/ui/svgs/apple'
import { AppleDark } from '@ui/components/ui/svgs/appleDark'
import { Button } from '@ui/components/primitives/button'
import { Separator } from '@ui/components/primitives/separator'
import { Source, provenance } from '@ui/provenance'
import { SignInForm, type SignInFormProps } from './SignInForm'

/**
 * The sign-in page, on the ReUI `auth-6` split-screen layout.
 *
 * The block is mounted for its structure: the `1fr / 620px` split, the brand
 * mark above a centred form, the full-width submit, the "Or continue with"
 * separator and provider row, the legal footer, and a sidebar over the
 * animated grid background — which is imported from the block rather than
 * reimplemented.
 *
 * Two of the block's own contents are replaced rather than shipped, and the
 * reason is the same in both cases: they are claims, not decoration.
 *
 *   - The sidebar ships a customer testimonial under a Slack wordmark, above a
 *     row of OpenAI / Stripe / Supabase / Slack / Cursor / Mintlify logos.
 *     That is invented praise beside six companies' trademarks, presented as
 *     Flexprice's customers. The slot is kept; what fills it is true.
 *   - The provider buttons are rendered, because they are part of the design —
 *     but V2 authenticates against `POST /auth/login` and no social provider
 *     is wired to anything yet. So a click says so, in the same place errors
 *     are announced, instead of appearing to work and doing nothing. Pass
 *     `onProvider` once a deployment really has one and this goes away.
 */
export const SignInScreenProvenance = provenance({
  source: Source.REUI,
  registry: ['auth-6', 'auth-11'],
  note: "ReUI auth-6 layout and provider row, auth-11 WaveDots backdrop (unchanged). Sidebar is our own testimonial panel with text wordmarks; the quote is a placeholder to be replaced with an approved customer quote.",
})

/** One provider button, as the block draws them. */
interface Provider {
  id: string
  label: string
  logo: ReactNode
}

/**
 * Placeholder testimonial — replace with a real, approved customer quote
 * before this screen faces customers.
 */
const TESTIMONIAL = {
  quote:
    'Flexprice let us move from spreadsheets to real usage-based billing in a couple of weeks. Pricing changes that used to take an engineering sprint now take an afternoon.',
  name: 'Customer name',
  role: 'Head of Finance, Customer',
}

const CUSTOMER_LOGOS = ['Krutrim', 'Vapi', 'Simplismart', 'Aftershoot', 'Facilio', 'Gigin']

const PROVIDERS: Provider[] = [
  { id: 'google', label: 'Google', logo: <Google className="size-4 shrink-0" aria-hidden /> },
  {
    id: 'apple',
    label: 'Apple',
    logo: (
      <>
        <Apple className="size-4 shrink-0 dark:hidden" aria-hidden />
        <AppleDark className="hidden size-4 shrink-0 dark:block" aria-hidden />
      </>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    logo: (
      <>
        <GithubLight className="size-4 shrink-0 dark:hidden" aria-hidden />
        <GithubDark className="hidden size-4 shrink-0 dark:block" aria-hidden />
      </>
    ),
  },
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
    <div className="w-full lg:grid lg:min-h-svh lg:grid-cols-[minmax(0,1fr)_620px]">
      {/* Form column */}
      <section className="flex min-w-0 flex-col px-6 py-6 sm:px-8 sm:py-8 lg:min-h-svh lg:px-12 lg:py-8">
        <div className="mx-auto flex w-full max-w-[35rem] flex-1 flex-col">
          <div className="mt-6 flex justify-center lg:mt-12">
            <div className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
              >
                F
              </span>
              <span className="text-[0.9375rem] font-medium">Flexprice</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="mx-auto flex w-full max-w-[22.5rem] flex-col gap-7">
              {hint ? (
                <p
                  role="note"
                  className="border-primary/30 bg-primary/5 text-muted-foreground rounded-lg border px-3 py-2 text-center text-xs leading-relaxed"
                >
                  {hint}
                </p>
              ) : null}

              <SignInForm {...form} />

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs">Or continue with</span>
                <Separator className="flex-1" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="outline"
                    className="w-full"
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
                  Need an account?{' '}
                  <Button
                    type="button"
                    variant="link"
                    onClick={onSignUp}
                    className="h-auto p-0"
                  >
                    Sign up
                  </Button>
                </p>
              ) : null}
            </div>
          </div>

          {onTerms && onPrivacy ? (
            <div className="text-muted-foreground mx-auto max-w-[35rem] text-center text-xs leading-6 text-pretty">
              By continuing, you agree to Flexprice&apos;s{' '}
              <Button
                type="button"
                variant="link"
                onClick={onTerms}
                className="text-foreground hover:text-primary h-auto p-0 text-xs underline underline-offset-4"
              >
                Terms of Service
              </Button>{' '}
              and{' '}
              <Button
                type="button"
                variant="link"
                onClick={onPrivacy}
                className="text-foreground hover:text-primary h-auto p-0 text-xs underline underline-offset-4"
              >
                Privacy Policy
              </Button>
              .
            </div>
          ) : null}
        </div>
      </section>

      <aside className="bg-muted/25 border-border/70 relative hidden overflow-hidden lg:flex lg:min-h-svh lg:border-l">
        <WaveDots />

        <div className="relative z-10 flex min-h-full w-full flex-col justify-between gap-10 px-14 py-12">
          <div className="flex flex-1 items-center justify-center">
            <figure className="bg-background/90 border-border/60 flex w-full max-w-[34rem] flex-col gap-8 rounded-2xl border p-10 backdrop-blur-sm">
              <QuoteIcon aria-hidden className="text-primary size-8" />
              <blockquote className="text-2xl/9 font-medium tracking-tight text-pretty">
                {TESTIMONIAL.quote}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-sm font-medium"
                >
                  {TESTIMONIAL.name.charAt(0)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{TESTIMONIAL.name}</span>
                  <span className="text-muted-foreground text-sm">{TESTIMONIAL.role}</span>
                </span>
              </figcaption>
            </figure>
          </div>

          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground text-xs">Trusted by teams building on usage-based pricing</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {CUSTOMER_LOGOS.map((name) => (
                <li key={name} className="text-foreground/70 text-base font-medium tracking-tight">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

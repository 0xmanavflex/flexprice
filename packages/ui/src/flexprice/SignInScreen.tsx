import { useState, type ReactNode } from 'react'
import { AuthGridBackground } from '@ui/components/blocks/auth-6/components/auth-grid-background'
import {
  AUTH6_FOUNDERS_STORY,
  AUTH6_TRUST_BRANDS,
} from '@ui/components/blocks/auth-6/components/data'
import { SlackWordmark } from '@ui/components/ui/svgs/slackWordmark'
import { Item, ItemMedia } from '@ui/primitives/item'
import { Google } from '@ui/components/ui/svgs/google'
import { GithubLight } from '@ui/components/ui/svgs/githubLight'
import { GithubDark } from '@ui/components/ui/svgs/githubDark'
import { Apple } from '@ui/components/ui/svgs/apple'
import { AppleDark } from '@ui/components/ui/svgs/appleDark'
import { Button } from '@ui/primitives/button'
import { Separator } from '@ui/primitives/separator'
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
  registry: ['auth-6'],
  note: 'ReUI auth-6 layout, grid background and provider row; form, copy and behaviour are ours. Testimonial and trust-brand logos replaced — they were claims about third parties.',
})

/** One provider button, as the block draws them. */
interface Provider {
  id: string
  label: string
  logo: ReactNode
}

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

      {/*
        The block's own sidebar, rendered from its own exported data
        (`AUTH6_FOUNDERS_STORY`, `AUTH6_TRUST_BRANDS`) and its own grid
        background, so it matches the published `auth-6` preview exactly.

        The structure is reproduced here rather than imported because the
        block keeps `Sidebar` as a module-local function — and vendored files
        are not hand-edited (see `docs/component-guardrails.md`).

        NOTE: the quote and the six wordmarks are ReUI's **demo content**, the
        same way `dashboard-4` ships sample data on the Home page. They are
        placeholders pending real content, and should be replaced before this
        screen is put in front of a customer — the logos are other companies'
        trademarks and the quote is not a real Flexprice customer's.
      */}
      <aside className="bg-muted/25 border-border/70 relative flex min-h-136 overflow-hidden px-8 py-10 sm:px-12 lg:min-h-svh lg:border-l lg:px-14 lg:py-12">
        <AuthGridBackground />

        <div className="relative z-10 flex min-h-full w-full flex-col justify-between gap-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="mx-auto flex w-full max-w-132 flex-col items-start">
              <div className="bg-background/90 border-border/60 relative w-full overflow-hidden rounded-xl border backdrop-blur-sm">
                <img
                  src="https://images.unsplash.com/photo-1690378820474-b468b8ee64d3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                  alt=""
                  className="h-auto w-full object-cover"
                />
              </div>

              <div className="mt-6 flex w-full flex-col items-start gap-3 text-left">
                <SlackWordmark aria-hidden="true" className="text-foreground h-6 w-auto" />
                <p className="max-w-md text-base leading-7">
                  {AUTH6_FOUNDERS_STORY.description}
                </p>
                <Button type="button" variant="outline" size="lg" className="font-semibold">
                  {AUTH6_FOUNDERS_STORY.cta}
                </Button>
              </div>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-[24rem] grid-cols-3 justify-items-center gap-x-3 gap-y-5">
            {AUTH6_TRUST_BRANDS.map((brand) => (
              <Item
                key={brand.id}
                className="text-foreground/90 flex min-h-6 w-auto items-center justify-center border-0 p-0"
              >
                <ItemMedia variant="icon" className="size-auto">
                  {brand.logo}
                </ItemMedia>
              </Item>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

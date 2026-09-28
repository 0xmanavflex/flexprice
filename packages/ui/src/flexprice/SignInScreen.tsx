import { AuthGridBackground } from '@ui/components/blocks/auth-6/components/auth-grid-background'
import { Source, provenance } from '@ui/provenance'
import { SignInForm, type SignInFormProps } from './SignInForm'

/**
 * The sign-in page, on the ReUI `auth-6` split-screen layout.
 *
 * The block ships as a marketing demo: a Slack wordmark, an Unsplash founders
 * photo, a customer testimonial, a row of borrowed brand logos and Google /
 * Apple / GitHub buttons. What is reused here is its *layout* — the
 * `1fr / 620px` split, the bordered panel and the animated grid background,
 * which is imported from the block rather than reimplemented.
 *
 * What is deliberately **not** reused is its content:
 *
 *   - **No OAuth row.** V2 authenticates against `POST /auth/login` and has no
 *     social provider wired to anything. Three buttons that cannot sign anyone
 *     in are worse than no buttons: the only way to discover they are dead is
 *     to trust one and be told nothing.
 *   - **No testimonial, no customer logos.** Those are real claims about real
 *     companies. Shipping the block's placeholders would put invented praise
 *     and other people's trademarks on Flexprice's front door.
 *
 * So the panel says what the product is, and nothing it cannot support.
 *
 * The form itself is `SignInForm`, unchanged — it owns the validation, the
 * keep-the-email-clear-the-password failure behaviour and the announced error.
 * This component is layout only, which is why every sign-in test keeps passing
 * against it.
 */
export const SignInScreenProvenance = provenance({
  source: Source.REUI,
  registry: ['auth-6'],
  note: 'ReUI auth-6 layout + its grid background; form, copy and behaviour are ours. OAuth and testimonial panels deliberately dropped.',
})

export type SignInScreenProps = SignInFormProps

export function SignInScreen(props: SignInScreenProps) {
  return (
    <div className="w-full lg:grid lg:min-h-svh lg:grid-cols-[minmax(0,1fr)_620px]">
      <section className="flex min-w-0 flex-col px-6 py-10 sm:px-8 lg:min-h-svh lg:px-12">
        <div className="mx-auto flex w-full max-w-[35rem] flex-1 flex-col justify-center">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-7">
            <SignInForm {...props} />
          </div>
        </div>
      </section>

      {/*
        Decorative, and marked so. The panel carries no information the form
        does not, so a screen reader that announced it would be reading out
        scenery between the heading and the first field.
      */}
      <aside
        aria-hidden="true"
        className="bg-muted/25 border-border/70 relative hidden min-h-136 overflow-hidden px-8 py-10 sm:px-12 lg:flex lg:min-h-svh lg:border-l lg:px-14 lg:py-12"
      >
        <AuthGridBackground />

        <div className="relative z-10 flex min-h-full w-full flex-col justify-center gap-6">
          <div className="mx-auto flex w-full max-w-132 flex-col items-start gap-4">
            <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl text-lg font-semibold">
              F
            </span>
            <p className="max-w-md text-2xl leading-9 font-semibold tracking-tight">
              Billing that keeps up with how your product is actually used.
            </p>
            <p className="text-muted-foreground max-w-md text-base leading-7">
              Meter usage, price it however you sell, and invoice from the same
              catalogue your product reads.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}

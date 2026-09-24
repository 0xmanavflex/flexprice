// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import type { ReactNode } from "react"

import { Apple } from "@ui/components/ui/svgs/apple"
import { AppleDark } from "@ui/components/ui/svgs/appleDark"
import { Google } from "@ui/components/ui/svgs/google"
import { OpenaiWordmarkDark } from "@ui/components/ui/svgs/openaiWordmarkDark"
import { OpenaiWordmarkLight } from "@ui/components/ui/svgs/openaiWordmarkLight"
import { SlackWordmark } from "@ui/components/ui/svgs/slackWordmark"
import { StripeWordmark } from "@ui/components/ui/svgs/stripeWordmark"
import { SupabaseWordmarkDark } from "@ui/components/ui/svgs/supabaseWordmarkDark"
import { SupabaseWordmarkLight } from "@ui/components/ui/svgs/supabaseWordmarkLight"

export type AuthProvider = {
  id: string
  label: string
  logo: ReactNode
}

export type TrustBrand = {
  id: string
  logo: ReactNode
}

export type Testimonial = {
  quote: string
  name: string
  role: string
  company: string
  avatar: string
  fallback: string
  stars: number
}

function ThemeLogo({ light, dark }: { light: ReactNode; dark: ReactNode }) {
  return (
    <>
      <span aria-hidden="true" className="dark:hidden">
        {light}
      </span>
      <span aria-hidden="true" className="hidden dark:block">
        {dark}
      </span>
    </>
  )
}

const providerLogoClassName = "size-4 shrink-0"

export const AUTH18_PROVIDERS: AuthProvider[] = [
  {
    id: "google",
    label: "Google",
    logo: <Google className={providerLogoClassName} aria-hidden="true" />,
  },
  {
    id: "apple",
    label: "Apple",
    logo: (
      <ThemeLogo
        light={<Apple className={providerLogoClassName} aria-hidden="true" />}
        dark={
          <AppleDark className={providerLogoClassName} aria-hidden="true" />
        }
      />
    ),
  },
]

export const AUTH18_TRUST_BRANDS: TrustBrand[] = [
  {
    id: "openai",
    logo: (
      <ThemeLogo
        light={
          <OpenaiWordmarkLight aria-hidden="true" className="h-4 w-auto" />
        }
        dark={<OpenaiWordmarkDark aria-hidden="true" className="h-4 w-auto" />}
      />
    ),
  },
  {
    id: "stripe",
    logo: <StripeWordmark aria-hidden="true" className="h-4 w-auto" />,
  },
  {
    id: "supabase",
    logo: (
      <ThemeLogo
        light={
          <SupabaseWordmarkLight aria-hidden="true" className="h-4 w-auto" />
        }
        dark={
          <SupabaseWordmarkDark aria-hidden="true" className="h-4 w-auto" />
        }
      />
    ),
  },
  {
    id: "slack",
    logo: (
      <SlackWordmark
        aria-hidden="true"
        className="text-foreground h-4 w-auto"
      />
    ),
  },
]

export const AUTH18_TESTIMONIAL: Testimonial = {
  quote: "The best login pages disappear. This one already feels fast.",
  name: "Sean Bold",
  role: "Co-founder",
  company: "ReUI",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  fallback: "SB",
  stars: 5,
}
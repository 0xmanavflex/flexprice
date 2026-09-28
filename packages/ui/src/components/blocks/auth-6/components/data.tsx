// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import type { ReactNode } from "react"

import { Apple } from "@ui/components/ui/svgs/apple"
import { AppleDark } from "@ui/components/ui/svgs/appleDark"
import { CursorWordmarkDark } from "@ui/components/ui/svgs/cursorWordmarkDark"
import { CursorWordmarkLight } from "@ui/components/ui/svgs/cursorWordmarkLight"
import { GithubDark } from "@ui/components/ui/svgs/githubDark"
import { GithubLight } from "@ui/components/ui/svgs/githubLight"
import { Google } from "@ui/components/ui/svgs/google"
import { MintlifyWordmarkDark } from "@ui/components/ui/svgs/mintlifyWordmarkDark"
import { MintlifyWordmarkLight } from "@ui/components/ui/svgs/mintlifyWordmarkLight"
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

export const AUTH6_PROVIDERS: AuthProvider[] = [
  {
    id: "google",
    label: "Google",
    logo: <Google className="size-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "apple",
    label: "Apple",
    logo: (
      <ThemeLogo
        light={<Apple className="size-4 shrink-0" aria-hidden="true" />}
        dark={<AppleDark className="size-4 shrink-0" aria-hidden="true" />}
      />
    ),
  },
  {
    id: "github",
    label: "GitHub",
    logo: (
      <ThemeLogo
        light={<GithubLight className="size-4 shrink-0" aria-hidden="true" />}
        dark={<GithubDark className="size-4 shrink-0" aria-hidden="true" />}
      />
    ),
  },
]

export const AUTH6_FOUNDERS_STORY = {
  description: (
    <>
      <span className="block sm:whitespace-nowrap">
        We moved to ReUI and shipped faster with less design drift.
      </span>
      <span className="block">It&apos;s one system our whole team trusts.</span>
    </>
  ),
  cta: "Read more",
}

export const AUTH6_TRUST_BRANDS: TrustBrand[] = [
  {
    id: "openai",
    logo: (
      <ThemeLogo
        light={
          <OpenaiWordmarkLight
            aria-hidden="true"
            className="h-[1.25rem] w-auto"
          />
        }
        dark={
          <OpenaiWordmarkDark
            aria-hidden="true"
            className="h-[1.25rem] w-auto"
          />
        }
      />
    ),
  },
  {
    id: "stripe",
    logo: <StripeWordmark aria-hidden="true" className="h-[1.35rem] w-auto" />,
  },
  {
    id: "supabase",
    logo: (
      <ThemeLogo
        light={
          <SupabaseWordmarkLight
            aria-hidden="true"
            className="h-[1.14rem] w-auto"
          />
        }
        dark={
          <SupabaseWordmarkDark
            aria-hidden="true"
            className="h-[1.14rem] w-auto"
          />
        }
      />
    ),
  },
  {
    id: "slack",
    logo: (
      <SlackWordmark
        aria-hidden="true"
        className="text-foreground h-[1.14rem] w-auto"
      />
    ),
  },
  {
    id: "cursor",
    logo: (
      <ThemeLogo
        light={
          <CursorWordmarkLight aria-hidden="true" className="h-[1rem] w-auto" />
        }
        dark={
          <CursorWordmarkDark aria-hidden="true" className="h-[1rem] w-auto" />
        }
      />
    ),
  },
  {
    id: "mintlify",
    logo: (
      <ThemeLogo
        light={
          <MintlifyWordmarkLight
            aria-hidden="true"
            className="h-[1.12rem] w-auto"
          />
        }
        dark={
          <MintlifyWordmarkDark
            aria-hidden="true"
            className="h-[1.12rem] w-auto"
          />
        }
      />
    ),
  },
]
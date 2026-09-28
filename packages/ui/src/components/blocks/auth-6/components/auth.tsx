// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
"use client"

import { useState, type ComponentProps } from "react"

import { SlackWordmark } from "@ui/components/ui/svgs/slackWordmark"
import { Button } from "@ui/primitives/button"
import { Item, ItemMedia } from "@ui/primitives/item"

import { AuthGridBackground } from "./auth-grid-background"
import { AUTH6_FOUNDERS_STORY, AUTH6_TRUST_BRANDS } from "./data"
import { LoginForm } from "./login-form"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

function SidebarBackground() {
  return <AuthGridBackground />
}

function Sidebar() {
  return (
    <aside className="bg-muted/25 border-border/70 relative flex min-h-136 overflow-hidden px-8 py-10 sm:px-12 lg:min-h-svh lg:border-l lg:px-14 lg:py-12">
      {/* Sidebar */}
      <SidebarBackground />

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between gap-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto flex w-full max-w-132 flex-col items-start">
            <div className="bg-background/90 border-border/60 relative w-full overflow-hidden rounded-xl border backdrop-blur-sm">
              <img
                src="https://images.unsplash.com/photo-1690378820474-b468b8ee64d3?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="ReUI founders"
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="mt-6 flex w-full flex-col items-start gap-3 text-left">
              <SlackWordmark
                aria-hidden="true"
                className="text-foreground h-6 w-auto"
              />
              <p className="max-w-md text-base leading-7">
                {AUTH6_FOUNDERS_STORY.description}
              </p>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="font-semibold"
              >
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
  )
}

export function Auth() {
  const [showPassword, setShowPassword] = useState(false)

  function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault()
  }

  return (
    <div className="w-full lg:grid lg:min-h-svh lg:grid-cols-[minmax(0,1fr)_620px]">
      {/* Form */}
      <LoginForm
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        onSubmit={handleSubmit}
      />

      {/* Sidebar */}
      <Sidebar />
    </div>
  )
}
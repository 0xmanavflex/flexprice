// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState, type ComponentProps } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/primitives/avatar"
import { Item, ItemMedia } from "@ui/primitives/item"
import { AuthGridBackground } from "./auth-grid-background"
import { AUTH18_TESTIMONIAL, AUTH18_TRUST_BRANDS } from "./data"
import { LoginForm } from "./login-form"
import { StarIcon } from "lucide-react"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

function SidebarBackground() {
  return <AuthGridBackground />
}

function Sidebar() {
  return (
    <aside className="bg-muted/25 border-border/70 relative flex min-h-[34rem] overflow-hidden px-8 py-10 sm:px-12 lg:min-h-svh lg:border-r lg:px-14 lg:py-12">
      {/* Sidebar */}
      <SidebarBackground />

      <div className="relative z-10 flex min-h-full w-full flex-col justify-between gap-10">
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
          <div className="text-primary flex items-center gap-1">
            {Array.from({ length: AUTH18_TESTIMONIAL.stars }).map((_, index) => (
              <StarIcon aria-hidden="true" className="size-4 fill-current" key={index} />
            ))}
          </div>

          <blockquote className="mt-6 max-w-[28rem] text-[1.625rem] leading-[1.34] font-semibold text-balance">
            “{AUTH18_TESTIMONIAL.quote}”
          </blockquote>

          <div className="mt-5 flex w-full justify-center">
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar className="size-8">
                <AvatarImage
                  src={AUTH18_TESTIMONIAL.avatar}
                  alt={AUTH18_TESTIMONIAL.name}
                />
                <AvatarFallback>{AUTH18_TESTIMONIAL.fallback}</AvatarFallback>
              </Avatar>

              <div className="flex min-w-0 flex-col items-start gap-0 text-left">
                <div className="text-sm font-medium">
                  {AUTH18_TESTIMONIAL.name}
                </div>
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span>{AUTH18_TESTIMONIAL.role}</span>
                  <span
                    aria-hidden="true"
                    className="bg-muted-foreground/40 size-1 shrink-0 rounded-full"
                  />
                  <span>{AUTH18_TESTIMONIAL.company}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-foreground text-sm font-medium">
            Trusted by leading teams
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {AUTH18_TRUST_BRANDS.map((brand) => (
              <Item
                key={brand.id}
                className="text-foreground/90 flex w-auto items-center border-0 p-0"
              >
                <ItemMedia variant="icon" className="size-auto">
                  {brand.logo}
                </ItemMedia>
              </Item>
            ))}
          </div>
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
    <div className="w-full lg:grid lg:min-h-svh lg:grid-cols-[600px_minmax(0,1fr)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Form */}
      <LoginForm
        showPassword={showPassword}
        onTogglePassword={() => setShowPassword((current) => !current)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
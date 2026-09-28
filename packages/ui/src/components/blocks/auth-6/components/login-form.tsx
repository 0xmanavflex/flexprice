// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { type ComponentProps } from "react"

import { Button } from "@ui/primitives/button"
import { Field, FieldGroup, FieldLabel } from "@ui/primitives/field"
import { Input } from "@ui/primitives/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@ui/primitives/input-group"
import { Separator } from "@ui/primitives/separator"
import { AuthLogo } from "./auth-logo"
import { AUTH6_PROVIDERS } from "./data"
import { EyeOffIcon, EyeIcon } from "lucide-react"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

export function LoginForm({
  showPassword,
  onTogglePassword,
  onSubmit,
}: {
  showPassword: boolean
  onTogglePassword: () => void
  onSubmit: (event: FormSubmitEvent) => void
}) {
  return (
    <section className="flex min-w-0 flex-col px-6 py-6 sm:px-8 sm:py-8 lg:min-h-svh lg:px-12 lg:py-8">
      {/* Heading */}
      <div className="mx-auto flex w-full max-w-[35rem] flex-1 flex-col">
        <div className="mt-6 flex justify-center lg:mt-12">
          <AuthLogo />
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto flex w-full max-w-[22.5rem] flex-col gap-7">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">
                  Log in to your ReUI account.
                </h1>
              </div>
            </div>

            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <FieldGroup className="gap-3.5">
                <Field className="gap-2">
                  <FieldLabel htmlFor="auth-6-identifier">
                    Email or username
                  </FieldLabel>
                  <Input
                    id="auth-6-identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="Email or username"
                    className="bg-background"
                  />
                </Field>

                <Field className="gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <FieldLabel htmlFor="auth-6-password">Password</FieldLabel>
                    <Button
                      type="button"
                      variant="link"
                      className="text-muted-foreground h-auto cursor-pointer p-0 text-xs font-normal"
                    >
                      Forgot password?
                    </Button>
                  </div>

                  <InputGroup className="bg-background w-full">
                    <InputGroupInput
                      id="auth-6-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={onTogglePassword}
                      >
                        {showPassword ? (
                          <EyeOffIcon aria-hidden="true" className="size-4" />
                        ) : (
                          <EyeIcon aria-hidden="true" className="size-4" />
                        )}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              </FieldGroup>

              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">
                Or continue with
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {AUTH6_PROVIDERS.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="outline"
                  className="w-full"
                >
                  {provider.logo}
                  {provider.label}
                </Button>
              ))}
            </div>

            <p className="text-muted-foreground text-center text-sm">
              Need an account?{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto cursor-pointer p-0"
              >
                Sign up
              </Button>
            </p>
          </div>
        </div>

        <div className="text-muted-foreground mx-auto max-w-[35rem] text-center text-xs leading-6 text-pretty lg:whitespace-nowrap">
          By continuing, you agree to ReUI&apos;s{" "}
          <Button
            type="button"
            variant="link"
            className="text-foreground hover:text-primary h-auto cursor-pointer p-0 text-xs whitespace-nowrap underline underline-offset-4"
          >
            Terms of Service
          </Button>{" "}
          and{" "}
          <Button
            type="button"
            variant="link"
            className="text-foreground hover:text-primary h-auto cursor-pointer p-0 text-xs whitespace-nowrap underline underline-offset-4"
          >
            Privacy Policy
          </Button>
          .
        </div>
      </div>
    </section>
  )
}
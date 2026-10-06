// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { PlanChangeWizard } from "./components/plan-change-wizard"

export function Page() {
  return (
    <main
      className="bg-background mx-auto flex min-h-svh w-full items-start justify-center p-4 sm:p-6 lg:p-10"
      aria-labelledby="page-heading"
    >
      <h1 id="page-heading" className="sr-only">
        Plan change and proration wizard
      </h1>
      <PlanChangeWizard />
    </main>
  )
}
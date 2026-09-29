// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { Button } from "@ui/primitives/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/primitives/empty"
import { ProjectsEmptyIllustration } from "./projects-empty-illustration"
import { QuickStartTemplates } from "./quick-start-templates"
import { PlusIcon, LayoutTemplateIcon } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex min-h-[820px] w-full max-w-[52rem] flex-col items-center justify-center gap-24 py-8 sm:gap-32 md:py-12">
      {/* Empty State */}
      <Empty className="flex-none gap-7 rounded-none border-0 p-0 md:p-0">
        <EmptyHeader className="max-w-[28rem] gap-4">
          <EmptyMedia className="mb-0">
            <ProjectsEmptyIllustration />
          </EmptyMedia>

          <div className="flex flex-col items-center gap-2">
            <EmptyTitle className="text-2xl font-semibold tracking-tight">
              No projects to show
            </EmptyTitle>
            <EmptyDescription className="max-w-[25rem] text-sm/relaxed">
              Start a project from scratch or pick a template to launch your
              first workspace and begin tracking tasks, goals, and progress.
            </EmptyDescription>
          </div>
        </EmptyHeader>

        <EmptyContent className="max-w-none gap-0">
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            <Button type="button">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              New project
            </Button>

            <Button type="button" variant="outline">
              <LayoutTemplateIcon data-icon="inline-start" aria-hidden="true" />
              Explore templates
            </Button>
          </div>
        </EmptyContent>
      </Empty>

      <div className="w-full max-w-md">
        <QuickStartTemplates />
      </div>
    </div>
  )
}
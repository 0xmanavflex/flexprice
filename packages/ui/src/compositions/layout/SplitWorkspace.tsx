import type { ReactNode } from 'react'
import { ChevronLeftIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A document beside the work done on it.
 *
 * The left pane holds the source (a contract, a statement) at reading size; the
 * right pane holds the step: a title, a line on what to do, and the controls.
 * Below `lg` the panes stack, step first, because the step is what the user
 * acts on. Each pane scrolls on its own, so reading page nine of a contract
 * never scrolls the field being checked out of view.
 *
 * It sits under a `WorkspaceBar` (back, title, named steps, the next action):
 * actions stay in that bar, as on every other staged form, so this frame has
 * no footer. The pair fills the window: the route renders it without the
 * console's sidebar, so the document gets the width it needs.
 */
export const SplitWorkspaceProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Two-pane workspace: source document on the left, the current step on the right, each scrolling on its own. Full-window, under WorkspaceBar; no footer of its own.',
})

export interface SplitWorkspaceProps {
  /** The source pane's content: a preview, or an empty state before there is one. */
  document: ReactNode
  /** Names the source pane for assistive tech, e.g. "Contract". */
  documentLabel: string
  /** Optional strip above the document: the file's name and status. */
  documentHeader?: ReactNode
  /** The step's title. The page's heading. */
  title: string
  description?: string
  /** The step's controls. */
  children: ReactNode
  className?: string
}

export function SplitWorkspace({
  document,
  documentLabel,
  documentHeader,
  title,
  description,
  children,
  className,
}: SplitWorkspaceProps) {
  return (
    <div
      className={cn(
        'grid min-h-0 flex-1 grid-rows-[auto_minmax(24rem,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(26rem,1fr)] lg:grid-rows-1',
        className,
      )}
    >
      <section
        aria-label={documentLabel}
        className="bg-muted/30 order-last flex min-h-0 min-w-0 flex-col border-t lg:order-none lg:border-t-0 lg:border-r"
      >
        {documentHeader ? <div className="bg-background border-b px-4 py-2.5">{documentHeader}</div> : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{document}</div>
      </section>
      <section aria-labelledby="split-workspace-title" className="flex min-h-0 min-w-0 flex-col">
        <div className="overflow-y-auto px-5 py-4 lg:min-h-0 lg:flex-1">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
            <div>
              <h1 id="split-workspace-title" className="text-base font-medium">
                {title}
              </h1>
              {description ? (
                <p className="text-muted-foreground text-[13px]">{description}</p>
              ) : null}
            </div>
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}

export interface WorkspaceBarProps {
  /** Where back goes, in words: "Back to contracts". */
  backLabel: string
  onBack: () => void
  /** What this workspace is: "Upload contract". */
  title: string
  /** The flow's steps, e.g. `<WorkflowStepper variant="header" showTitles />`. */
  steps?: ReactNode
  /** The next action, at the far right. */
  actions?: ReactNode
}

/**
 * The bar across the top of a full-window workspace: the way back on the left,
 * then what this is; the steps and the next action on the right.
 */
export function WorkspaceBar({ backLabel, onBack, title, steps, actions }: WorkspaceBarProps) {
  return (
    <header className="bg-muted/30 flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 md:flex-nowrap md:py-0">
      <div className="flex min-w-0 shrink-0 items-center gap-2 text-[13px]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground -ms-2 h-8 gap-1 px-2"
          onClick={onBack}
        >
          <ChevronLeftIcon aria-hidden className="size-3.5" />
          {backLabel}
        </Button>
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span className="truncate font-medium">{title}</span>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-4">
        {steps ? <div className="min-w-0 overflow-x-auto">{steps}</div> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}

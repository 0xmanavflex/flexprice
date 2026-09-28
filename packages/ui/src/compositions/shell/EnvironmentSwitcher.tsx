import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/primitives/tooltip'
import { Badge } from '@ui/components/reui/badge'
import { cn } from '@ui/lib/cn'
import { useSidebar } from '@ui/primitives/sidebar'
import { MENU_CONTENT, MENU_ITEM } from './menuSurface'
import type { ShellEnvironment } from './types'

export interface EnvironmentSwitcherProps {
  current: ShellEnvironment
  environments: ShellEnvironment[]
  onChange: (id: string) => void
  /** Absent means creating one is not offered — no dead menu item. */
  onCreate?: () => void
  onManage?: () => void
  /**
   * Where the switcher lives.
   *
   * `sidebar` (default) is the full-width row that collapses to a circle in the
   * rail. `breadcrumb` is the compact trigger that leads the header's trail —
   * same menu, same marks, but sized to sit inline beside a chevron rather than
   * to fill a sidebar row.
   */
  variant?: 'sidebar' | 'breadcrumb'
}

/**
 * The most consequential control in the product.
 *
 * Editing a plan in production and editing one in a sandbox are different acts
 * with different consequences, and in the current dashboard they look
 * identical. So production is marked — here, in the breadcrumb, and with a
 * border across the top of the whole shell.
 *
 * The kind is shown as a word, not only as a colour: colour alone excludes
 * anyone who cannot distinguish it, and this is precisely the information
 * nobody can afford to miss. Only production is marked and only production is
 * coloured — marking the safe state is how people learn to stop seeing marks.
 *
 * Shaped after ReUI's workspace-switcher menu: a name and its kind's mark on
 * each row, a tick on the current one, and the two management actions below a
 * rule. The rows are the fetched environments and nothing else — production
 * first, so the consequential one leads — with no section headings above them:
 * the red/amber mark already says which kind a row is, so a "Production" label
 * over a single production row is a word doing a dot's job.
 *
 * The list is capped to about three rows and scrolls past that, so a tenant
 * with a dozen environments gets a menu it scans rather than one that runs off
 * the screen; create and manage sit below the scroll area, pinned, so making a
 * new environment never means scrolling to the end of the list first.
 *
 * The same menu serves two triggers, chosen by `variant`: the full-width
 * sidebar row it began as, and the compact control that now leads the header's
 * breadcrumb — the one place people look while working. Only the trigger's
 * shape differs; the options, the marks, and the create/manage actions are one
 * implementation.
 *
 * ## When this stops being the right control
 *
 * A dropdown is right while the list fits on screen without scrolling — call
 * it a dozen. Past that, reading gives way to searching and this should become
 * a command palette with the same rows, which is why every row here is already
 * name + kind + tick rather than a bare label. If Flexprice ever nests
 * environments under an org or an app, the switcher stops being one control
 * and becomes the header's own breadcrumb of switchers.
 */
export function EnvironmentSwitcher({
  current,
  environments,
  onChange,
  onCreate,
  onManage,
  variant = 'sidebar',
}: EnvironmentSwitcherProps) {
  const { state, isMobile } = useSidebar()
  // The rail treatment is the sidebar's alone; in the breadcrumb there is no
  // collapse to answer to.
  const isRail = variant === 'sidebar' && state === 'collapsed' && !isMobile
  const isProduction = current.kind === 'production'

  // Production first, so the consequential environment leads the list; the rest
  // follow in the order the server returned them. One flat list, no headings.
  const production = environments.filter((e) => e.kind === 'production')
  const sandboxes = environments.filter((e) => e.kind !== 'production')
  const ordered = [...production, ...sandboxes]

  const trigger =
    variant === 'breadcrumb' ? (
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Environment: ${current.name}, ${current.kind}. Change environment`}
            className={cn(
              // Sized to lead the header's trail: a compact, inline control that
              // sits beside a chevron rather than filling a sidebar row.
              'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring -mx-1 flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
            )}
          />
        }
      >
        <Mark kind={current.kind} />
        <span className="min-w-0 truncate font-medium">{current.name}</span>
        {isProduction ? (
          <Badge variant="destructive-light" size="sm" className="shrink-0">
            Live
          </Badge>
        ) : null}
        <ChevronsUpDownIcon aria-hidden className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
    ) : (
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Environment: ${current.name}, ${current.kind}. Change environment`}
            className={cn(
              'hover:bg-sidebar-accent/80 focus-visible:ring-sidebar-ring flex h-9 w-full items-center gap-2 rounded-xl border border-transparent px-3 text-sm transition-colors hover:border-border/60 focus-visible:ring-2 focus-visible:outline-none',
              // The whole row takes the warning, not just a badge inside it — a
              // tint across the control is harder to look past than a chip.
              isProduction && 'bg-destructive/8 hover:bg-destructive/12',
              // In the rail it becomes a circle carrying only the mark, so the
              // environment is still legible at 48px — which is the width people
              // work at all day once they have collapsed the sidebar.
              // In the rail it becomes a bordered circle carrying only the mark.
              // The border is what makes it read as a control rather than a
              // stray dot; the mark is what keeps the environment legible at
              // 48px, which is the width people work at once they collapse it.
              isRail && 'mx-auto size-8 w-8 justify-center border-border/60 px-0',
            )}
          />
        }
      >
        <Mark kind={current.kind} {...(isRail ? { className: 'size-2.5' } : {})} />
        {isRail ? null : (
          <>
            <span className="min-w-0 truncate font-medium">{current.name}</span>
            {isProduction ? (
              <Badge variant="destructive-light" size="sm" className="shrink-0">
                Live
              </Badge>
            ) : null}
            <ChevronsUpDownIcon aria-hidden className="ml-auto size-4 shrink-0 opacity-50" />
          </>
        )}
      </DropdownMenuTrigger>
    )

  return (
    <DropdownMenu>
      {isRail ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent side="right">
            {current.name} · {current.kind}
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}

      <DropdownMenuContent
        align="start"
        side={isRail ? 'right' : 'bottom'}
        sideOffset={8}
        className={MENU_CONTENT}
      >
        {/*
          The fetched environments, one flat scrolling list. Capped to about
          three rows (`max-h-36`) so a long list scrolls inside the menu rather
          than running off the screen; `overscroll-contain` keeps that scroll
          from chaining to the page behind it.
        */}
        {ordered.length > 0 ? (
          <DropdownMenuGroup className="max-h-36 overflow-y-auto overscroll-contain">
            {ordered.map((environment) => (
              <Option
                key={environment.id}
                environment={environment}
                isCurrent={environment.id === current.id}
                onSelect={onChange}
              />
            ))}
          </DropdownMenuGroup>
        ) : null}

        {onCreate || onManage ? (
          <>
            {/* Below the scroll area, so create/manage stay visible however long
                the environment list is. */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onCreate ? (
                <DropdownMenuItem className={MENU_ITEM} onClick={onCreate}>
                  <PlusIcon aria-hidden />
                  New environment
                </DropdownMenuItem>
              ) : null}
              {onManage ? (
                <DropdownMenuItem className={MENU_ITEM} onClick={onManage}>
                  <SettingsIcon aria-hidden />
                  Manage environments
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The dot. Red for production, amber for a sandbox.
 *
 * Sandbox was a muted grey — indistinguishable from every other grey in the
 * shell, so the most consequential state in the product read as nothing. Amber
 * is the "test mode" convention a billing operator already knows, and it pairs
 * with production's red as a two-state signal rather than colour-versus-absence.
 */
export function Mark({
  kind,
  className,
}: {
  kind: ShellEnvironment['kind']
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        kind === 'production' ? 'bg-destructive' : 'bg-warning',
        className,
      )}
    />
  )
}

function Option({
  environment,
  isCurrent,
  onSelect,
}: {
  environment: ShellEnvironment
  isCurrent: boolean
  onSelect: (id: string) => void
}) {
  return (
    <DropdownMenuItem
      className={MENU_ITEM}
      onClick={() => onSelect(environment.id)}
      // The tick is visual; this is what a screen reader gets.
      aria-current={isCurrent ? 'true' : undefined}
    >
      <Mark kind={environment.kind} />
      <span className={cn('min-w-0 truncate', isCurrent && 'font-medium')}>
        {environment.name}
      </span>
      {isCurrent ? <CheckIcon aria-hidden className="ml-auto size-4 shrink-0" /> : null}
    </DropdownMenuItem>
  )
}

import { CheckIcon, ChevronsUpDownIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { cn } from '@ui/lib/cn'
import type { ShellEnvironment } from './types'

export interface EnvironmentSwitcherProps {
  current: ShellEnvironment
  environments: ShellEnvironment[]
  onChange: (id: string) => void
  /** Absent means creating one is not offered — no dead menu item. */
  onCreate?: () => void
  onManage?: () => void
}

/**
 * The first crumb of the top bar: the active environment, with a switcher.
 *
 * Editing a plan in production and editing one in a sandbox are different acts
 * with different consequences, so the kind is a coloured dot (red for
 * production, amber for a sandbox) beside the name, and the name is the word
 * that carries it — colour alone excludes anyone who cannot distinguish it.
 *
 * The menu lists the fetched environments, production first, with a tick on the
 * current one, and the create and manage actions below a rule. The list is
 * capped to about three rows and scrolls past that, so a tenant with a dozen
 * environments gets a menu it scans rather than one that runs off the screen.
 */
export function EnvironmentSwitcher({
  current,
  environments,
  onChange,
  onCreate,
  onManage,
}: EnvironmentSwitcherProps) {
  // Production first, so the consequential environment leads the list; the rest
  // follow in the order the server returned them. One flat list, no headings.
  const production = environments.filter((e) => e.kind === 'production')
  const sandboxes = environments.filter((e) => e.kind !== 'production')
  const ordered = [...production, ...sandboxes]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-muted data-popup-open:bg-muted -ml-2 flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-medium outline-none"
        aria-label={`Environment: ${current.name}, ${current.kind}. Change environment`}
      >
        <Mark kind={current.kind} />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronsUpDownIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="w-56">
        {/* Capped to about three rows so a long list scrolls inside the menu;
            `overscroll-contain` keeps that scroll from chaining to the page. */}
        {ordered.length > 0 ? (
          <DropdownMenuGroup className="max-h-36 overflow-y-auto overscroll-contain">
            {ordered.map((environment) => (
              <DropdownMenuItem
                key={environment.id}
                onClick={() => onChange(environment.id)}
                // The tick is visual; this is what a screen reader gets.
                aria-current={environment.id === current.id ? 'true' : undefined}
              >
                <Mark kind={environment.kind} className="ml-0.5" />
                <span className="min-w-0 flex-1 truncate">{environment.name}</span>
                {environment.id === current.id ? (
                  <CheckIcon aria-hidden className="size-3.5 shrink-0" />
                ) : null}
              </DropdownMenuItem>
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
                <DropdownMenuItem onClick={onCreate}>
                  <PlusIcon className="text-muted-foreground" aria-hidden />
                  New environment
                </DropdownMenuItem>
              ) : null}
              {onManage ? (
                <DropdownMenuItem onClick={onManage}>
                  <SettingsIcon className="text-muted-foreground" aria-hidden />
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

/** The dot. Red for production, amber for a sandbox. */
export function Mark({ kind, className }: { kind: ShellEnvironment['kind']; className?: string }) {
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

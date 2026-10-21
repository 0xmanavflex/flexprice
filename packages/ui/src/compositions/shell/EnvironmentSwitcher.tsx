import { CheckIcon, ChevronsUpDownIcon, PencilIcon, PlusIcon, Trash2Icon } from '@ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { cn } from '@ui/lib/cn'
import type { ShellEnvironment } from './types'
import { RBAC_ENTITY } from '@fp/domain'
import { useWriteAccess } from '../access/Access'

/** One mock account state, for walking the self-billing flows on mocks. */
export interface MockAccountOption {
  value: string
  name: string
  note: string
  tone: 'info' | 'warning' | 'destructive' | 'success' | 'muted'
}

export interface EnvironmentSwitcherProps {
  current: ShellEnvironment
  environments: ShellEnvironment[]
  onChange: (id: string) => void
  /** Absent means creating one is not offered — no dead menu item. */
  onCreate?: () => void
  /** Rename an environment. Absent means no pencil on the rows. */
  onRename?: (id: string) => void
  /**
   * Delete an environment. Absent means no delete action on the rows. Never
   * offered on the current environment: deleting the one you are standing in
   * would leave the console pointed at nothing.
   */
  onDelete?: (id: string) => void
  /**
   * Mocks only: the self-billing account state to preview (trial, locked,
   * live…), as the prototype's environment switcher offers. Absent everywhere
   * a real API answers.
   */
  mockAccounts?: {
    value: string
    options: readonly MockAccountOption[]
    onChange: (value: string) => void
  }
}

const TONE: Record<MockAccountOption['tone'], string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  success: 'bg-success',
  muted: 'bg-muted-foreground/40',
}

/**
 * The first crumb of the top bar: the active environment, with a switcher.
 *
 * Editing a plan in production and editing one in a sandbox are different acts
 * with different consequences, so the kind is a coloured dot (green for
 * production, yellow for a sandbox) beside the name, and the name is the word
 * that carries it — colour alone excludes anyone who cannot distinguish it.
 *
 * The menu lists the fetched environments, production first, with a tick on the
 * current one. Environments are managed here rather than on a Settings page:
 * hovering a row reveals a pencil (rename) and, where offered, a delete action,
 * and "New environment" sits below a rule. The list is capped to about three
 * rows and scrolls past that, so a tenant with a dozen environments gets a menu
 * it scans rather than one that runs off the screen.
 *
 * The row actions are sibling menu items rather than buttons nested inside the
 * row's item: a button inside a `menuitem` is a nested interactive control,
 * which a screen reader cannot reach and a click would also select the row. As
 * siblings they are ordinary stops in the menu's arrow-key order, shown on
 * hover, on keyboard highlight, and always on a touch screen, which has no
 * hover.
 */
export function EnvironmentSwitcher({
  current,
  environments,
  onChange,
  onCreate,
  onRename,
  onDelete,
  mockAccounts,
}: EnvironmentSwitcherProps) {
  // Creating and renaming environments need environment write (V1).
  const write = useWriteAccess(RBAC_ENTITY.Environment)
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

      <DropdownMenuContent align="start" sideOffset={6} className="w-64">
        {/* Capped to about three rows so a long list scrolls inside the menu;
            `overscroll-contain` keeps that scroll from chaining to the page. */}
        {ordered.length > 0 ? (
          <DropdownMenuGroup className="max-h-36 overflow-y-auto overscroll-contain">
            {ordered.map((environment) => {
              const isCurrent = environment.id === current.id
              return (
                <div key={environment.id} className="group/environment flex items-center gap-0.5">
                  <DropdownMenuItem
                    className="min-w-0 flex-1"
                    onClick={() => onChange(environment.id)}
                    // The tick is visual; this is what a screen reader gets.
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <Mark kind={environment.kind} className="ml-0.5" />
                    <span className="min-w-0 flex-1 truncate">{environment.name}</span>
                    {isCurrent ? <CheckIcon aria-hidden className="size-3.5 shrink-0" /> : null}
                  </DropdownMenuItem>
                  {onRename ? (
                    <DropdownMenuItem
                      className={ROW_ACTION}
                      aria-label={`Rename ${environment.name}`}
                      disabled={!write.allowed}
                      onClick={() => onRename(environment.id)}
                    >
                      <PencilIcon aria-hidden className="text-muted-foreground size-3.5" />
                    </DropdownMenuItem>
                  ) : null}
                  {onDelete && !isCurrent ? (
                    <DropdownMenuItem
                      variant="destructive"
                      className={ROW_ACTION}
                      aria-label={`Delete ${environment.name}`}
                      disabled={!write.allowed}
                      onClick={() => onDelete(environment.id)}
                    >
                      <Trash2Icon aria-hidden className="size-3.5" />
                    </DropdownMenuItem>
                  ) : null}
                </div>
              )
            })}
          </DropdownMenuGroup>
        ) : null}

        {mockAccounts ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Mock accounts
              </DropdownMenuLabel>
              {mockAccounts.options.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => mockAccounts.onChange(option.value)}
                  aria-current={mockAccounts.value === option.value ? 'true' : undefined}
                >
                  <span
                    aria-hidden
                    className={cn('ml-0.5 size-2 shrink-0 rounded-full', TONE[option.tone])}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{option.note}</span>
                  </span>
                  {mockAccounts.value === option.value ? (
                    <CheckIcon aria-hidden className="size-3.5 shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}

        {onCreate ? (
          <>
            {/* Below the scroll area, so create stays visible however long the
                environment list is. */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={!write.allowed} onClick={onCreate}>
                <PlusIcon className="text-muted-foreground" aria-hidden />
                New environment
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {write.reason ? (
              <p className="text-muted-foreground px-2 py-1.5 text-xs">{write.reason}</p>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * A row's icon-only action: square, and hidden until the row is hovered or the
 * action itself is highlighted by the keyboard. Always shown on a coarse
 * pointer, where there is no hover to reveal it.
 */
const ROW_ACTION =
  'size-7 shrink-0 justify-center p-0 opacity-0 group-hover/environment:opacity-100 data-highlighted:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'

/** The dot. Green for production, yellow for a sandbox. */
export function Mark({ kind, className }: { kind: ShellEnvironment['kind']; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        kind === 'production' ? 'bg-success' : 'bg-warning',
        className,
      )}
    />
  )
}

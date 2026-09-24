import { ChevronsUpDownIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import { Badge } from '@ui/components/reui/badge'
import { cn } from '@ui/lib/cn'
import type { ShellEnvironment } from './types'

export interface EnvironmentSwitcherProps {
  current: ShellEnvironment
  environments: ShellEnvironment[]
  onChange: (id: string) => void
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
 * nobody can afford to miss.
 *
 * Only production is badged and only production is coloured. An environment
 * named "Sandbox" beside a badge reading "Sandbox" says one thing twice, and
 * marking the safe state is how people learn to stop seeing marks. Absence is
 * the sandbox signal; the accessible name states the kind either way.
 *
 * It is shaped as a full-width row rather than a button, so it sits in the
 * sidebar's own rhythm instead of floating above it as a stray pill.
 */
export function EnvironmentSwitcher({
  current,
  environments,
  onChange,
}: EnvironmentSwitcherProps) {
  const isProduction = current.kind === 'production'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Environment: ${current.name}, ${current.kind}. Change environment`}
            className={cn(
              'hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
              // The whole row takes the warning, not just a badge inside it —
              // a tint across the control is harder to look past than a chip.
              isProduction && 'bg-destructive/8 hover:bg-destructive/12',
            )}
          />
        }
      >
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            isProduction ? 'bg-destructive' : 'bg-muted-foreground/50',
          )}
        />
        <span className="min-w-0 truncate font-medium">{current.name}</span>
        {isProduction ? (
          <Badge variant="destructive-light" size="sm" className="shrink-0">
            Live
          </Badge>
        ) : null}
        <ChevronsUpDownIcon aria-hidden className="ml-auto size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-(--sidebar-width) min-w-56">
        {/* The label is a `Menu.GroupLabel`; outside a group it throws. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environment</DropdownMenuLabel>
          {environments.map((environment) => (
            <DropdownMenuItem
              key={environment.id}
              onClick={() => onChange(environment.id)}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  environment.kind === 'production'
                    ? 'bg-destructive'
                    : 'bg-muted-foreground/50',
                )}
              />
              <span className={cn(environment.id === current.id && 'font-medium')}>
                {environment.name}
              </span>
              {environment.kind === 'production' ? (
                <Badge variant="destructive-light" size="sm" className="ml-auto">
                  Live
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

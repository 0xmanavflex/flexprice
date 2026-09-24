import { Button } from '@ui/primitives/button'
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
 * identical. So production is marked — here, and with a border across the top
 * of the whole shell.
 *
 * The kind is shown as a word, not only as a colour: colour alone excludes
 * anyone who cannot distinguish it, and this is precisely the information
 * nobody can afford to miss.
 *
 * Only production is badged. An environment named "Sandbox" beside a badge
 * reading "Sandbox" says one thing twice, and the repetition makes the badge
 * easier to stop seeing — which is the opposite of what it is for. Absence is
 * the sandbox signal; the accessible name still states the kind either way.
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
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', isProduction && 'border-destructive/40')}
            aria-label={`Environment: ${current.name}, ${current.kind}. Change environment`}
          />
        }
      >
        <span className="font-medium">{current.name}</span>
        {isProduction ? (
          <Badge variant="destructive-light" size="sm">
            Live
          </Badge>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {/* The label is a `Menu.GroupLabel`; outside a group it throws. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Environment</DropdownMenuLabel>
        </DropdownMenuGroup>
        {environments.map((environment) => (
          <DropdownMenuItem
            key={environment.id}
            onClick={() => onChange(environment.id)}
            className="flex items-center justify-between gap-3"
          >
            <span className={cn(environment.id === current.id && 'font-medium')}>
              {environment.name}
            </span>
            {environment.kind === 'production' ? (
              <Badge variant="destructive-light" size="sm">
                Live
              </Badge>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

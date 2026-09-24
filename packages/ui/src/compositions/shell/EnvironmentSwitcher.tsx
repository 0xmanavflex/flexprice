import { Button } from '@ui/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
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
        <Badge variant={isProduction ? 'destructive-light' : 'secondary'} size="sm">
          {isProduction ? 'Live' : 'Sandbox'}
        </Badge>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Environment</DropdownMenuLabel>
        {environments.map((environment) => (
          <DropdownMenuItem
            key={environment.id}
            onClick={() => onChange(environment.id)}
            className="flex items-center justify-between gap-3"
          >
            <span className={cn(environment.id === current.id && 'font-medium')}>
              {environment.name}
            </span>
            <Badge
              variant={environment.kind === 'production' ? 'destructive-light' : 'secondary'}
              size="sm"
            >
              {environment.kind === 'production' ? 'Live' : 'Sandbox'}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

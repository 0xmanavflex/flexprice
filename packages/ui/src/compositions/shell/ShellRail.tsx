import { Avatar, AvatarFallback } from '@ui/primitives/avatar'
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@ui/primitives/sidebar'
import { cn } from '@ui/lib/cn'
import type { ShellSection, ShellUser } from './types'

/**
 * The icon rail, taking its treatment from `@reui/app-shell-16`.
 *
 * A dark rounded panel inset from the edge rather than a bordered column — it
 * reads as a distinct surface instead of a third table, and it gives the
 * content area the whole of the light background.
 *
 * The zinc palette is the block's, kept literal on purpose: it is a fixed dark
 * surface in both themes, so it does not follow `--background`, and expressing
 * it through theme tokens would make it invert in dark mode and disappear.
 */
export interface ShellRailProps {
  sections: ShellSection[]
  activeSectionId: string
  onSectionChange: (sectionId: string) => void
  user: ShellUser
  logo?: React.ReactNode
}

export function ShellRail({
  sections,
  activeSectionId,
  onSectionChange,
  user,
  logo,
}: ShellRailProps) {
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="bg-muted dark:bg-background flex shrink-0 py-2.5 ps-2.5">
      <nav
        aria-label="Sections"
        className="flex w-14 shrink-0 flex-col items-center gap-3 rounded-2xl bg-black py-3 text-zinc-400"
      >
        <SidebarHeader className="flex items-center justify-center bg-transparent p-0 pt-0.5">
          {logo ?? (
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-white"
            >
              F
            </span>
          )}
        </SidebarHeader>

        <SidebarContent className="min-h-0 flex-1 bg-transparent pt-2">
          <SidebarMenu className="items-center gap-1.5">
            {sections.map((section) => (
              <SidebarMenuItem key={section.id}>
                <SidebarMenuButton
                  tooltip={{ children: section.label, hidden: false }}
                  isActive={section.id === activeSectionId}
                  onClick={() => onSectionChange(section.id)}
                  aria-label={section.label}
                  aria-current={section.id === activeSectionId ? 'page' : undefined}
                  className={cn(
                    'size-9 justify-center text-zinc-400',
                    'hover:bg-zinc-800 hover:text-white',
                    'data-[active=true]:bg-zinc-800 data-[active=true]:text-white',
                  )}
                >
                  {section.icon}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="items-center gap-1 bg-transparent p-0 pb-1">
          <Avatar className="size-8">
            <AvatarFallback className="bg-zinc-800 text-xs text-white">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="sr-only">Signed in as {user.name}</span>
        </SidebarFooter>
      </nav>
    </div>
  )
}

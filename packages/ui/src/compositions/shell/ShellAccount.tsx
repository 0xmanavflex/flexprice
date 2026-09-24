import { LogOutIcon, MoreHorizontalIcon, SettingsIcon, UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/primitives/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@ui/primitives/sidebar'
import { provenance } from '@ui/provenance'
import type { ShellUser } from './types'

/**
 * The footer identity, from `@reui/app-shell-3`'s workspace menu.
 *
 * Who am I signed in as, and how do I leave. The block puts its organisation
 * switcher here too; ours is the environment switcher and it sits at the top,
 * because in a billing console "which environment" is a far more dangerous
 * question than "which organisation".
 *
 * Collapsed, the row becomes the avatar alone — which is still a menu, so
 * signing out never requires expanding the sidebar first.
 */
export const ShellAccountProvenance = provenance({
  source: 'composition',
  composes: ['@reui/app-shell-3', 'ui/dropdown-menu', 'ui/avatar', 'ui/sidebar'],
  note: "The block's nav-workspace, reduced to identity: the org switcher is not ours to put here.",
})

export interface ShellAccountProps {
  user: ShellUser
  onProfile?: () => void
  onSettings?: () => void
  onSignOut?: () => void
}

/** Initials, so a missing avatar is still a recognisable mark rather than a hole. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function ShellAccount({ user, onProfile, onSettings, onSignOut }: ShellAccountProps) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-auto bg-transparent py-1.5 pr-0! group-data-[collapsible=icon]:justify-center"
            render={<SidebarMenuButton aria-label={`Account: ${user.name}. Open account menu`} />}
          >
            <Avatar className="size-6">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col text-left in-data-[state=collapsed]:hidden">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {user.organization ?? user.email}
              </span>
            </span>
            <MoreHorizontalIcon
              aria-hidden
              className="mr-1 ml-auto size-4 shrink-0 opacity-50 in-data-[state=collapsed]:hidden"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? 'top' : 'right'}
            align="end"
            sideOffset={8}
            className="w-60"
          >
            {/*
              `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which throws
              when it is not inside a `Menu.Group` — and the throw takes the
              whole menu with it, so the symptom is an account menu that opens
              to nothing rather than an error anyone would notice.
            */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs font-normal">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onProfile ? (
                <DropdownMenuItem onClick={onProfile}>
                  <UserIcon aria-hidden />
                  Profile
                </DropdownMenuItem>
              ) : null}
              {onSettings ? (
                <DropdownMenuItem onClick={onSettings}>
                  <SettingsIcon aria-hidden />
                  Settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            {onSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOutIcon aria-hidden />
                  Sign out
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

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
import { MENU_CONTENT, MENU_ITEM } from './menuSurface'
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
            className="-ml-1 h-auto bg-transparent py-2 pr-0! group-data-[collapsible=icon]:ml-0! group-data-[collapsible=icon]:justify-center"
            render={<SidebarMenuButton aria-label={`Account: ${user.name}. Open account menu`} />}
          >
            {/*
              Flux's footer row: a rounded-square avatar, the person's name,
              and beneath it the organisation with its own mark. Two lines
              rather than one because they answer different questions — who am
              I signed in as, and whose data am I looking at — and the second
              is the one people forget.
            */}
            <div className="flex min-w-0 flex-1 items-center gap-2 in-data-[state=collapsed]:justify-center">
              <Avatar className="size-7 shrink-0 rounded-md in-data-[state=collapsed]:size-6!">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px] font-semibold">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex min-w-0 flex-col in-data-[state=collapsed]:hidden">
                <span className="truncate text-xs font-medium">{user.name}</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  {user.organization ? (
                    <span
                      aria-hidden
                      className="bg-primary/70 size-1.5 shrink-0 rounded-full"
                    />
                  ) : null}
                  <span className="text-muted-foreground truncate text-[10px]">
                    {user.organization ?? user.email}
                  </span>
                </span>
              </div>
            </div>

            <MoreHorizontalIcon
              aria-hidden
              className="mr-1 ml-auto size-4 shrink-0 opacity-50 in-data-[state=collapsed]:hidden"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? 'top' : 'right'}
            align="end"
            sideOffset={8}
            className={MENU_CONTENT}
          >
            {/*
              `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which throws
              when it is not inside a `Menu.Group` — and the throw takes the
              whole menu with it, so the symptom is an account menu that opens
              to nothing rather than an error anyone would notice.
            */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex min-w-0 flex-col px-2.5 py-1.5">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs font-normal">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onProfile ? (
                <DropdownMenuItem className={MENU_ITEM} onClick={onProfile}>
                  <UserIcon aria-hidden />
                  Profile
                </DropdownMenuItem>
              ) : null}
              {onSettings ? (
                <DropdownMenuItem className={MENU_ITEM} onClick={onSettings}>
                  <SettingsIcon aria-hidden />
                  Settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            {onSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className={MENU_ITEM} onClick={onSignOut}>
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

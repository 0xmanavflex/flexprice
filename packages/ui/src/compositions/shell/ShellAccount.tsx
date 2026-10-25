import { LogOutIcon, MoreHorizontalIcon, SettingsIcon, UserIcon } from '@ui/icons'
import { Avatar, AvatarFallback } from '@ui/components/primitives/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@ui/components/primitives/sidebar'
import { provenance } from '@ui/provenance'
import type { ShellUser } from './types'

/**
 * The account menu in the sidebar footer, after the reference shell's
 * `UserMenu`: an avatar and two lines of text on a stock large menu button,
 * opening a menu to the right (above, on a phone) with the profile and settings
 * links and sign out. The name and organisation head that menu.
 *
 * Documentation is deliberately not here: it has one home, the pinned footer
 * row of the sidebar, and a second entry in this menu only split it in two.
 */
export const ShellAccountProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/sidebar', 'ui/avatar'],
  note: 'The footer account row as a stock large sidebar button; name/org head the menu it opens.',
})

export interface ShellAccountProps {
  user: ShellUser
  onProfile?: () => void
  onSettings?: () => void
  onSignOut?: () => void
}

function initialsOf(user: ShellUser): string {
  const source = user.name.trim() || user.email.trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters =
    parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function ShellAccount({ user, onProfile, onSettings, onSignOut }: ShellAccountProps) {
  const { isMobile } = useSidebar()
  /*
   * A display name that fell back to the email address is not a second fact.
   *
   * Nothing guarantees a person has a name on file, and when they do not the
   * console hands us the email for both: so printing it twice, one line above
   * the other, read as a bug in the account rather than a gap in the profile.
   */
  const nameIsEmail = user.name.trim().toLowerCase() === user.email.trim().toLowerCase()
  const secondary = nameIsEmail ? undefined : user.email

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-transparent group-data-[collapsible=icon]:justify-center"
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={`Account: ${user.name}. Open account menu`}
              />
            }
          >
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="bg-background border-border border text-[11px] font-medium">
                {initialsOf(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col leading-tight in-data-[state=collapsed]:hidden">
              <span className="truncate text-sm">{user.name}</span>
              {secondary ? (
                <span className="text-muted-foreground truncate text-xs">{secondary}</span>
              ) : null}
            </div>
            <MoreHorizontalIcon
              aria-hidden
              className="ml-auto size-4 shrink-0 opacity-50 in-data-[state=collapsed]:hidden"
            />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? 'top' : 'right'}
            align="end"
            sideOffset={8}
            className="w-56"
          >
            {/*
              `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which throws
              when it is not inside a `Menu.Group`: and the throw takes the
              whole menu with it, so the symptom is an account menu that opens
              to nothing.
            */}
            <DropdownMenuGroup>
              {user.organization ? (
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  {user.organization}
                </DropdownMenuLabel>
              ) : null}
              {onProfile ? (
                <DropdownMenuItem onClick={onProfile}>
                  <UserIcon className="text-muted-foreground" aria-hidden />
                  Profile
                </DropdownMenuItem>
              ) : null}
              {onSettings ? (
                <DropdownMenuItem onClick={onSettings}>
                  <SettingsIcon className="text-muted-foreground" aria-hidden />
                  Settings
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            {onSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOutIcon className="text-muted-foreground" aria-hidden />
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

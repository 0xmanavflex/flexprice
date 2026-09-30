import { BookOpenIcon, LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { provenance } from '@ui/provenance'
import { MENU_CONTENT, MENU_ITEM } from './menuSurface'
import type { ShellUser } from './types'

/**
 * The account, as a single icon in the sidebar footer.
 *
 * Reduced from a row with an avatar and two lines of identity to a plain person
 * icon that opens the same menu — who I am, and how I leave. It sits in the
 * footer beside Bell and Theme, all three the same `icon-sm` ghost button, so
 * the rail ends in a tidy row of utilities rather than a heavy account card. The
 * name and organisation have not gone: they head the menu it opens.
 */
export const ShellAccountProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/button'],
  note: 'The footer identity, reduced to a profile icon; name/org head the menu it opens.',
})

export interface ShellAccountProps {
  user: ShellUser
  onProfile?: () => void
  onSettings?: () => void
  /** Documentation, beside Settings — where the sidebar's "Quick links" used to be. */
  onDocs?: () => void
  onSignOut?: () => void
}

export function ShellAccount({ user, onProfile, onSettings, onDocs, onSignOut }: ShellAccountProps) {
  /*
   * A display name that fell back to the email address is not a second fact.
   *
   * Nothing guarantees a person has a name on file, and when they do not the
   * console hands us the email for both — so printing it twice, one line above
   * the other, read as a bug in the account rather than a gap in the profile.
   */
  const nameIsEmail = user.name.trim().toLowerCase() === user.email.trim().toLowerCase()
  const secondary = user.organization ?? (nameIsEmail ? undefined : user.email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-70 hover:opacity-100"
            aria-label={`Account: ${user.name}. Open account menu`}
          />
        }
      >
        <UserIcon aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={8} className={MENU_CONTENT}>
        {/*
          `DropdownMenuLabel` is Base UI's `Menu.GroupLabel`, which throws when it
          is not inside a `Menu.Group` — and the throw takes the whole menu with
          it, so the symptom is an account menu that opens to nothing.
        */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex min-w-0 flex-col px-2.5 py-1.5">
            <span className="truncate text-sm font-medium">{user.name}</span>
            {secondary ? (
              <span className="text-muted-foreground truncate text-xs font-normal">{secondary}</span>
            ) : null}
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
          {onDocs ? (
            <DropdownMenuItem className={MENU_ITEM} onClick={onDocs}>
              <BookOpenIcon aria-hidden />
              Documentation
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
  )
}

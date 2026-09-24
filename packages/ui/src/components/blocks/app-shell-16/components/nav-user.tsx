// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useEffect, useState } from "react"
import { cn } from "cn"
import { useTheme } from "next-themes"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@ui/primitives/avatar"
import { Button } from "@ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import { USER } from "./data"
import { SunIcon, MoonIcon, MonitorIcon, UserIcon, SettingsIcon, InboxIcon, PaletteIcon, LogOutIcon } from "lucide-react"

// ── Theme Toggle ──

const THEMES = [
  {
    value: "light",
    label: "Light",
    icon: (
      <SunIcon className="size-3.5" aria-hidden="true" />
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <MoonIcon className="size-3.5" aria-hidden="true" />
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <MonitorIcon className="size-3.5" aria-hidden="true" />
    ),
  },
]

function ThemeSegmentedToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = mounted ? (theme ?? "system") : "system"

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-muted/60 inline-flex items-center gap-0.5 rounded-full p-0.5"
    >
      {THEMES.map(({ value, label, icon }) => {
        const isActive = currentTheme === value
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(value)}
            className={cn(
              "rounded-full",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {icon}
          </Button>
        )
      })}
    </div>
  )
}

// ── Nav User ──

export function NavUser() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Open profile for ${USER.name}`}
            className="relative mx-auto size-9 rounded-full hover:bg-zinc-800"
          />
        }
      >
        <Avatar className="size-7 rounded-full">
          <AvatarImage src={USER.avatar} alt={USER.name} />
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
            {USER.initials}
          </AvatarFallback>
        </Avatar>
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 size-2 rounded-full border border-black bg-emerald-500"
        />
      </DropdownMenuTrigger>

      {/* Content */}
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
            <Avatar className="size-8 rounded-md">
              <AvatarImage src={USER.avatar} alt={USER.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {USER.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground text-sm font-semibold">
                {USER.name}
              </span>
              <span className="text-muted-foreground truncate text-xs font-normal">
                {USER.email}
              </span>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem>
              <UserIcon aria-hidden="true" />
              Profile
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SettingsIcon aria-hidden="true" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuItem>
              <InboxIcon aria-hidden="true" />
              Manage Accounts
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {/* The swatches set a value in place, so the menu outlives the click. */}
            <DropdownMenuItem
              closeOnClick={false}
              className="cursor-default focus:bg-transparent!"
            >
              <PaletteIcon aria-hidden="true" />
              Theme
              <div className="ml-auto">
                <ThemeSegmentedToggle />
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <LogOutIcon aria-hidden="true" />
            Sign Out
            <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
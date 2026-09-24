// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useId, useState } from "react"

import { Button } from "@ui/primitives/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/primitives/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import { Input } from "@ui/primitives/input"
import { SidebarTrigger } from "@ui/primitives/sidebar"
import { SearchIcon, ClipboardListIcon, PlusIcon } from "lucide-react"

/**
 * Search that survives a narrow header. Two sidebars leave this header ~450px
 * at md, where a 176px field crushed the page trail - so below lg the field
 * collapses to an icon button that opens the same search in a dialog. Search
 * stays reachable at every width; only its surface changes.
 */
function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const searchInputId = useId()

  return (
    <>
      {/* lg and up: the field is affordable inline */}
      <form role="search" className="relative hidden w-48 lg:block">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <Input aria-label="Search" placeholder="Search" className="h-9 pl-9" />
      </form>

      {/* below lg: the same search, one tap away */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-4" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search updates and accounts.</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-md px-4 py-2 **:data-[slot=dialog-close]:top-3 **:data-[slot=dialog-close]:right-3 **:data-[slot=dialog-close]:opacity-60">
          <div className="relative flex items-center gap-3">
            <SearchIcon className="pointer-events-none size-4 opacity-60 select-none" aria-hidden="true" />
            <Input
              id={searchInputId}
              className="h-10 border-none p-0 shadow-none outline-none focus-visible:ring-0"
              autoFocus
              placeholder="Type to search..."
              aria-label="Search"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AppHeader() {
  return (
    <header className="bg-background sticky top-0 z-40 flex h-(--header-height) w-full shrink-0 items-center gap-2 px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2 md:hidden">
          <SidebarTrigger className="md:hidden" />
        </div>

        <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
          <h1 className="truncate text-base leading-5 font-semibold">
            Updates
          </h1>
          {/* the ancestors give up width before the current page does, and the
              whole trail truncates on one line rather than being squeezed to an
              unreadable sliver */}
          {/* Ancestors drop from the left as room runs out - the classic trail
              rule - so the current page stays legible instead of every segment
              truncating to "Ho... / Acco... / Updat...". */}
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            <a
              href="#"
              className="hover:text-foreground hidden truncate lg:inline"
            >
              Home
            </a>
            <span aria-hidden="true" className="hidden shrink-0 lg:inline">
              /
            </span>
            <a href="#" className="hover:text-foreground truncate">
              Account
            </a>
            <span aria-hidden="true" className="shrink-0">
              /
            </span>
            {/* the current page is the leaf: it never gives up width */}
            <span className="text-foreground shrink-0">Updates</span>
          </div>
        </div>
      </div>

      <nav className="ml-auto flex shrink-0 items-center gap-2.5">
        <HeaderSearch />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="hidden sm:inline-flex" />
            }
          >
            <ClipboardListIcon aria-hidden="true" />
            Reports
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem>Weekly Digest</DropdownMenuItem>
              <DropdownMenuItem>Client Updates</DropdownMenuItem>
              <DropdownMenuItem>Export CSV</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button />}>
            <PlusIcon aria-hidden="true" />
            <span className="hidden sm:inline">Add</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem>New Update</DropdownMenuItem>
              <DropdownMenuItem>Invite Member</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Import Notes</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  )
}
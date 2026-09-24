// @ts-nocheck — vendored from the ReUI registry; do not hand-edit.
// Regenerate with: pnpm ui:add <item>   (see scripts/vendor-suppress.mjs)
import { useState } from "react"
import { Badge } from "@ui/components/reui/badge"
import { cn } from "cn"

import { Button } from "@ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ui/primitives/dropdown-menu"
import { type InnerNavItem, type InnerNavSection } from "./data"
import { PlusIcon, ChevronUpIcon } from "lucide-react"

export function InnerNavButton({
  item,
  isActive,
  onClick,
}: {
  item: InnerNavItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-8 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal",
        isActive
          ? "bg-background text-foreground hover:bg-background shadow-xs"
          : "text-foreground hover:bg-background/70"
      )}
    >
      <span
        className={cn(
          "text-muted-foreground size-4 shrink-0 opacity-80 [&_svg]:size-4",
          item.iconClassName
        )}
      >
        {item.icon}
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
      {item.badge !== undefined && (
        <Badge
          variant={item.badgeVariant ?? "outline"}
          size="sm"
          className="ml-0.5"
        >
          {item.badge}
        </Badge>
      )}
    </Button>
  )
}

function SectionAction({ section }: { section: InnerNavSection }) {
  if (section.action === "plus") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Add ${section.title ?? "item"}`}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <PlusIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem>New Workspace</DropdownMenuItem>
            <DropdownMenuItem>Import Workspace</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return null
}

function InnerNavSectionHeader({
  section,
  open,
  onToggle,
}: {
  section: InnerNavSection
  open: boolean
  onToggle: () => void
}) {
  if (!section.title) {
    return null
  }

  if (section.collapsible) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={`inner-section-${section.id}`}
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground h-6 w-full justify-start px-2 text-xs font-normal hover:bg-transparent"
      >
        <span>{section.title}</span>
        <ChevronUpIcon className={cn(
                        "ml-auto size-3.5 opacity-70 transition-transform duration-200",
                        !open && "rotate-180"
                      )} aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div className="text-muted-foreground flex h-6 items-center px-2 text-xs">
      <span>{section.title}</span>
      <span className="ml-auto flex items-center">
        <SectionAction section={section} />
      </span>
    </div>
  )
}

function InnerNavSectionBlock({
  section,
  activeItem,
  onItemChange,
}: {
  section: InnerNavSection
  activeItem: string
  onItemChange: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const content = (
    <div className="flex flex-col gap-0.5">
      {section.items.map((item) => (
        <InnerNavButton
          key={item.id}
          item={item}
          isActive={activeItem === item.id}
          onClick={() => onItemChange(item.id)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-1">
      <InnerNavSectionHeader
        section={section}
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {(!section.collapsible || open) && (
        <div id={`inner-section-${section.id}`}>{content}</div>
      )}
    </div>
  )
}

export function InnerSidebarNav({
  sections,
  activeItem,
  onItemChange,
}: {
  sections: InnerNavSection[]
  activeItem: string
  onItemChange: (id: string) => void
}) {
  return (
    <nav className="flex flex-col gap-2.5 px-2 pb-3">
      {sections.map((section) => (
        <InnerNavSectionBlock
          key={section.id}
          section={section}
          activeItem={activeItem}
          onItemChange={onItemChange}
        />
      ))}
    </nav>
  )
}
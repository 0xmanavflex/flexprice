import type { ReactNode } from 'react'
import { MoreHorizontalIcon, PencilIcon } from 'lucide-react'
import { DetailTabs, type DetailTabSpec } from '../../compositions/DetailKit'
import { DetailShell } from '../../compositions/DetailShell'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'

export interface CatalogMenuItem {
  id: string
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

export interface CatalogDetailFrameProps {
  /** Breadcrumb parent, e.g. "Coupons". */
  listLabel: string
  onBack: () => void
  icon: ReactNode
  title: string
  /** One line under the title. */
  subtitle?: ReactNode
  /** Copyable identifier. */
  id: string
  primary?: { label: string; onClick: () => void; disabled?: boolean }
  /** Shows the header's Edit button (pencil, outline). */
  onEdit?: () => void
  menuLabel: string
  menu?: CatalogMenuItem[]
  tabs: DetailTabSpec[]
  tab?: string
  onTabChange?: (tab: string) => void
  /** Rendered after the tabs (dialogs). */
  children?: ReactNode
}

/**
 * The shared shell for catalog detail pages (coupon, add-on, cost sheet, group):
 * `DetailShell` (icon tile, title, one-line subtitle, copyable id), Edit and ⋯ overflow actions, then line `DetailTabs`.
 */
export function CatalogDetailFrame({
  listLabel,
  onBack,
  icon,
  title,
  subtitle,
  id,
  primary,
  onEdit,
  menuLabel,
  menu = [],
  tabs,
  tab,
  onTabChange,
  children,
}: CatalogDetailFrameProps) {
  const actions = (
    <>
      {primary ? (
        <Button
          variant="outline"
          className="h-8 px-3"
          disabled={primary.disabled ?? false}
          onClick={primary.onClick}
        >
          {primary.label}
        </Button>
      ) : null}
      {onEdit ? (
        <Button variant="outline" className="h-8 px-3" onClick={onEdit}>
          <PencilIcon aria-hidden />
          Edit
        </Button>
      ) : null}
      {menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" className="size-8" aria-label={menuLabel} />}
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              {menu.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.disabled ?? false}
                  {...(item.destructive ? { variant: 'destructive' as const } : {})}
                  onClick={item.onSelect}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )

  return (
    <DetailShell
      trail={[{ label: listLabel, onClick: onBack }, { label: title }]}
      icon={icon}
      title={title}
      {...(subtitle ? { subtitle } : {})}
      id={id}
      actions={actions}
    >
      <DetailTabs
        tabs={tabs}
        {...(tab !== undefined ? { value: tab } : {})}
        {...(onTabChange ? { onValueChange: onTabChange } : {})}
      />
      {children}
    </DetailShell>
  )
}

import type { ReactNode } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { MENU_CONTENT, MENU_ITEM } from '../../compositions/shell/menuSurface'
import { DetailTabs, type DetailTabSpec } from '../../compositions/DetailKit'
import { EntityHeader } from '../shared/EntityHeader'
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
  subtitle?: string
  /** Copyable identifier. */
  id: string
  primary?: { label: string; onClick: () => void; disabled?: boolean }
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
 * icon-tile `EntityHeader` (title, one-line subtitle, id chip), one primary button with a ⋯ overflow menu, then `DetailTabs`.
 */
export function CatalogDetailFrame({
  listLabel,
  onBack,
  icon,
  title,
  subtitle,
  id,
  primary,
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
        <Button variant="outline" disabled={primary.disabled ?? false} onClick={primary.onClick}>
          {primary.label}
        </Button>
      ) : null}
      {menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" aria-label={menuLabel} />}
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className={MENU_CONTENT}>
            <DropdownMenuGroup>
              {menu.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  className={MENU_ITEM}
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EntityHeader
        trail={[{ label: listLabel, onClick: onBack }, { label: title }]}
        icon={icon}
        title={title}
        {...(subtitle ? { subtitle } : {})}
        id={id}
        actions={actions}
      />
      <div className="px-6 pb-10">
        <DetailTabs
          tabs={tabs}
          {...(tab !== undefined ? { value: tab } : {})}
          {...(onTabChange ? { onValueChange: onTabChange } : {})}
        />
      </div>
      {children}
    </div>
  )
}

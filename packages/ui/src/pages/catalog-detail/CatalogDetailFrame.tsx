import type { ReactNode } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'
import { DetailBreadcrumb, DetailHeader } from '../../compositions'
import { CopyId, DetailTabs, type DetailTabSpec } from '../../compositions/DetailKit'
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
  badges?: ReactNode
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
 * breadcrumb, icon tile + `DetailHeader` (title, badges, one-line subtitle), a
 * copyable id, one primary button with a ⋯ overflow menu, then `DetailTabs`.
 */
export function CatalogDetailFrame({
  listLabel,
  onBack,
  icon,
  title,
  badges,
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
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label={menuLabel} />}>
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
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
    <div className="flex flex-col">
      <div className="px-6 pt-5">
        <DetailBreadcrumb trail={[{ label: listLabel, onClick: onBack }, { label: title }]} />
      </div>
      <div className="flex items-start gap-3 px-6 pt-3">
        <div
          aria-hidden
          className="bg-muted text-muted-foreground mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-5"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1 [&>header]:px-0 [&>header]:pt-0">
          <DetailHeader
            title={title}
            {...(badges ? { badges } : {})}
            {...(subtitle ? { description: subtitle } : {})}
            actions={actions}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 px-6 pb-4 pl-[4.75rem]">
        <CopyId value={id} />
      </div>
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

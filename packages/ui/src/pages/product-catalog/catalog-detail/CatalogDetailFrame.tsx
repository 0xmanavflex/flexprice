import type { ReactNode } from 'react'
import {
  DetailMoreMenu,
  DetailTabs,
  type DetailMenuItem,
  type DetailTabSpec,
} from '../../../compositions/detail/DetailKit'
import { DetailShell } from '../../../compositions/detail/DetailShell'

/** One header action. Destructive items are set apart, last in the menu. */
export type CatalogMenuItem = DetailMenuItem

export interface CatalogDetailFrameProps {
  /** Breadcrumb parent, e.g. "Coupons". */
  listLabel: string
  onBack: () => void
  icon: ReactNode
  title: string
  /** Status and type chips, shown in the header's right-hand cluster. */
  badges?: ReactNode
  /** Copyable identifier. */
  id: string
  /** Accessible name of the More button. */
  menuLabel: string
  /**
   * Every header action — Edit, state changes such as Activate, Archive or
   * Delete — in display order. The header has no inline buttons.
   */
  menu?: CatalogMenuItem[]
  tabs: DetailTabSpec[]
  tab?: string
  onTabChange?: (tab: string) => void
  /** Rendered after the tabs (dialogs). */
  children?: ReactNode
}

/**
 * The shared shell for catalog detail pages (coupon, add-on, cost sheet, group):
 * `DetailShell` (icon tile, title; right cluster of chips, "ID" copy chip and a
 * single ⋯ menu holding every action), then line `DetailTabs`.
 */
export function CatalogDetailFrame({
  listLabel,
  onBack,
  icon,
  title,
  badges,
  id,
  menuLabel,
  menu = [],
  tabs,
  tab,
  onTabChange,
  children,
}: CatalogDetailFrameProps) {
  return (
    <DetailShell
      trail={[{ label: listLabel, onClick: onBack }, { label: title }]}
      icon={icon}
      title={title}
      {...(badges ? { badges } : {})}
      id={id}
      actions={<DetailMoreMenu label={menuLabel} items={menu} />}
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

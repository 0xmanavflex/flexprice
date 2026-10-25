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
  /** Small pills under the title: status first, then the facts that identify the record. */
  badges?: ReactNode
  /** Copyable identifier. */
  id: string
  /** Sits immediately before the ID chip, e.g. the payment gateway's logo. */
  leading?: ReactNode
  /** Accessible name of the More button. */
  menuLabel: string
  /**
   * Every header action: Edit, state changes such as Activate, Archive or
   * Delete: in display order. The header has no inline buttons.
   */
  menu?: CatalogMenuItem[]
  tabs: DetailTabSpec[]
  tab?: string
  onTabChange?: (tab: string) => void
  /** Rendered after the tabs (dialogs). */
  children?: ReactNode
}

/** The current page in the breadcrumb. The title and the ID chip keep the record. */
function detailPageLabel(listLabel: string): string {
  const known: Record<string, string> = {
    'Add-ons': 'Add-on details',
    Coupons: 'Coupon details',
    Payments: 'Payment details',
    'Credit memos': 'Credit memo details',
    'Price Units': 'Price unit details',
    Tags: 'Tag details',
    'Cost sheets': 'Cost sheet details',
    Webhooks: 'Webhook details',
  }
  return known[listLabel] ?? `${listLabel.replace(/s$/, '')} details`
}

/**
 * The shared shell for catalog detail pages (coupon, add-on, cost sheet, group):
 * `DetailShell` (icon tile, title, small pills under it, "ID" copy chip and a
 * single ⋯ menu holding every action), then line `DetailTabs`.
 */
export function CatalogDetailFrame({
  listLabel,
  onBack,
  icon,
  title,
  badges,
  id,
  leading,
  menuLabel,
  menu = [],
  tabs,
  tab,
  onTabChange,
  children,
}: CatalogDetailFrameProps) {
  return (
    <DetailShell
      trail={[{ label: listLabel, onClick: onBack }, { label: detailPageLabel(listLabel) }]}
      icon={icon}
      title={title}
      {...(badges ? { badges } : {})}
      id={id}
      {...(leading ? { leading } : {})}
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

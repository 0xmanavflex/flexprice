import type { ComponentType, SVGProps } from 'react'
import {
  AmericanExpressFlatRoundedIcon,
  DinersClubFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  JCBFlatRoundedIcon,
  MaestroFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  UnionPayFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A saved card's network, as the network's own logo on a small card-shaped
 * tile. `network` is `PortalPaymentMethod.network` (see `@fp/domain`).
 *
 * Artwork: react-svg-credit-card-payment-icons (MIT), "flat rounded". RuPay,
 * Cartes Bancaires, eftpos and Bajaj Finserv are not in that set, so they get
 * a plain word mark — to swap for the networks' official files before launch.
 */
export const CardLogoProvenance = provenance({
  source: 'custom',
  reason:
    'Card network logos. The kit has none; the artwork is react-svg-credit-card-payment-icons, as the customer portal reference uses.',
})

type Logo = ComponentType<
  SVGProps<SVGSVGElement> & { width?: number | string; height?: number | string }
>

/** A card-shaped tile (780 × 500, the set's own proportions) with a word mark. */
function wordMark(label: string, fill: string, ink: string): Logo {
  return function WordMark(props) {
    return (
      <svg viewBox="0 0 780 500" {...props}>
        <rect width="780" height="500" rx="40" fill={fill} />
        <text
          x="390"
          y="300"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="700"
          fontSize={label.length > 4 ? 140 : 200}
          fill={ink}
        >
          {label}
        </text>
      </svg>
    )
  }
}

const LOGOS: Record<string, Logo> = {
  visa: VisaFlatRoundedIcon,
  mastercard: MastercardFlatRoundedIcon,
  amex: AmericanExpressFlatRoundedIcon,
  discover: DiscoverFlatRoundedIcon,
  diners: DinersClubFlatRoundedIcon,
  jcb: JCBFlatRoundedIcon,
  unionpay: UnionPayFlatRoundedIcon,
  maestro: MaestroFlatRoundedIcon,
  // The networks' own colours: brand marks, not the console palette.
  rupay: wordMark('RuPay', '#ffffff', '#1b3c8a'),
  cartesbancaires: wordMark('CB', '#0a6e8f', '#ffffff'),
  eftpos: wordMark('eftpos', '#111111', '#ffffff'),
  bajaj: wordMark('Bajaj', '#0a4ea3', '#ffffff'),
}

export function CardLogo({
  network,
  label,
  className,
}: {
  network: string
  label: string
  className?: string
}) {
  const Logo = LOGOS[network] ?? GenericFlatRoundedIcon
  return (
    // A hairline ring, so a white logo still reads on a white page and in dark mode.
    <span
      className={cn(
        'ring-border inline-flex h-6 w-9 shrink-0 overflow-hidden rounded-[4px] ring-1',
        className,
      )}
      title={label}
    >
      <Logo width="100%" height="100%" aria-hidden="true" focusable="false" />
    </span>
  )
}

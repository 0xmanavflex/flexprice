import { ArrowUpRightIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'
import { Section } from '../layout/Section'

export const RelatedCardProvenance = provenance({
  source: 'composition',
  composes: ['compositions/section'],
  note: 'The detail rail card for linked records: looks like MetadataCard, but every value is a link and there is no Edit.',
})

export interface RelatedItem {
  /** Stable key; defaults to the label. */
  id?: string
  /** What the link is, e.g. "Customer", "Subscription". */
  label: string
  /** The linked record's name or number. */
  value: string
  /** Opens the record in the console. */
  onOpen?: () => void
  /** An external URL, opened in a new tab. Used when there is no `onOpen`. */
  href?: string
}

export interface RelatedCardProps {
  items: RelatedItem[]
  title?: string
  className?: string
}

/**
 * The "Related" card on a detail page's right rail: the records this one links
 * to, each a link. Rail order is Activity, then Metadata, then Related.
 *
 * Renders nothing when there is nothing to link to, so a page never shows an
 * empty Related card. Items without a destination are dropped for the same reason.
 */
export function RelatedCard({ items, title = 'Related', className }: RelatedCardProps) {
  const links = items.filter((item) => item.value && (item.onOpen || item.href))
  if (links.length === 0) return null
  return (
    <Section title={title} flush {...(className ? { className } : {})}>
      <dl className="flex flex-col divide-y text-sm">
        {links.map((item) => (
          <div
            key={item.id ?? item.label}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-4 px-6 py-3"
          >
            <dt className="text-muted-foreground min-w-0 text-xs break-words">{item.label}</dt>
            <dd className="min-w-0">
              {item.onOpen ? (
                <button
                  type="button"
                  onClick={item.onOpen}
                  className="hover:text-primary inline-flex max-w-full items-center gap-1 text-left underline-offset-2 hover:underline"
                >
                  <span className="truncate" title={item.value}>
                    {item.value}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="text-muted-foreground size-3.5 shrink-0"
                  />
                </button>
              ) : (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary inline-flex max-w-full items-center gap-1 underline-offset-2 hover:underline"
                >
                  <span className="truncate" title={item.value}>
                    {item.value}
                  </span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="text-muted-foreground size-3.5 shrink-0"
                  />
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

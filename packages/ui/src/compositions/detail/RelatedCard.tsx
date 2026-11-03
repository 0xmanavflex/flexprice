import type { ReactNode } from 'react'
import { ArrowUpRightIcon, CopyIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { provenance } from '@ui/provenance'
import { toast } from 'sonner'
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
  /** An id to copy, such as the customer or invoice id behind this row. */
  copyValue?: string
  /** Opens the record in the console. */
  onOpen?: () => void
  /** An external URL, opened in a new tab. Used when there is no `onOpen`. */
  href?: string
}

export interface RelatedCardProps {
  items: RelatedItem[]
  /** Connected integrations or other record relationships. */
  children?: ReactNode
  /** Link an integration or another relationship, after the existing rows. */
  action?: ReactNode
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
export function RelatedCard({
  items,
  children,
  action,
  title = 'Related',
  className,
}: RelatedCardProps) {
  const links = items.filter((item) => item.value && (item.onOpen || item.href))
  if (links.length === 0 && !children && !action) return null
  return (
    <Section title={title} flush {...(className ? { className } : {})}>
      <dl className="flex flex-col divide-y text-sm">
        {links.map((item) => (
          <div
            key={item.id ?? item.label}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-baseline gap-4 px-6 py-3"
          >
            <dt className="text-muted-foreground min-w-0 truncate text-xs" title={item.label}>
              {item.label}
            </dt>
            <dd className="flex min-w-0 items-center gap-1">
              {item.onOpen ? (
                <button
                  type="button"
                  onClick={item.onOpen}
                  className="hover:text-primary inline-flex max-w-full min-w-0 items-center gap-1 text-left underline-offset-2 hover:underline"
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
                  className="hover:text-primary inline-flex max-w-full min-w-0 items-center gap-1 underline-offset-2 hover:underline"
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
              {item.copyValue ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-7 shrink-0"
                  aria-label={`Copy ${item.label} ID`}
                  onClick={() => {
                    const id = item.copyValue
                    if (!id) return
                    void navigator.clipboard
                      ?.writeText(id)
                      .then(() => toast.success(`${item.label} ID copied`))
                      .catch(() => toast.error('Copy failed'))
                  }}
                >
                  <CopyIcon aria-hidden />
                </Button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {children ? (
        <div className={links.length > 0 ? 'border-t' : undefined}>{children}</div>
      ) : null}
      {action ? <div className="border-t px-6 py-3">{action}</div> : null}
    </Section>
  )
}

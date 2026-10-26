import { useState, type MouseEvent, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from '@ui/icons'
import { toast } from 'sonner'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * A copyable identifier for a table cell: monospaced, shortened when long, with
 * a copy icon. The full value is the tooltip and the accessible name, and the
 * click is stopped so copying never opens the row.
 */
export const CopyValueProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'Copyable mono id for list cells: first 11 + last 4 characters, full value in title and aria-label.',
})

/** Ids longer than this are shortened to their first 11 and last 4 characters. */
const SHORTEN_ABOVE = 18

export function shortenId(value: string): string {
  return value.length > SHORTEN_ABOVE ? `${value.slice(0, 11)}…${value.slice(-4)}` : value
}

export interface CopyValueProps {
  value: string
  /** What is being copied, for the aria-label and the toast: "External ID". */
  label: string
  /** `chip` draws a bordered pill, for provider ids; `text` is plain mono text. */
  variant?: 'text' | 'chip'
  /** Leading mark inside a chip: a provider logo. */
  leading?: ReactNode
  className?: string
}

export function CopyValue({ value, label, variant = 'text', leading, className }: CopyValueProps) {
  const [copied, setCopied] = useState(false)
  const copy = (event: MouseEvent) => {
    event.stopPropagation()
    void navigator.clipboard?.writeText(value)
    setCopied(true)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button
      type="button"
      title={value}
      aria-label={`Copy ${label} ${value}`}
      onClick={copy}
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full min-w-0 items-center gap-1.5 font-mono text-xs outline-none focus-visible:ring-2',
        variant === 'chip'
          ? 'bg-background hover:bg-muted h-6 rounded-md border px-1.5'
          : 'rounded-sm',
        className,
      )}
    >
      {leading}
      <span className="min-w-0 truncate">{shortenId(value)}</span>
      {copied ? (
        <CheckIcon aria-hidden className="size-3 shrink-0" />
      ) : (
        <CopyIcon aria-hidden className="size-3 shrink-0" />
      )}
    </button>
  )
}

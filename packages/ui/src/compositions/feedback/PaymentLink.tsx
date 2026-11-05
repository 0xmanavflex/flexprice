import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@ui/components/primitives/button'
import { CheckIcon, CopyIcon, ExternalLinkIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'

/**
 * A payment or checkout link to hand to a customer, in a confirm dialog's body:
 * a read-only field showing the URL on one line, with Copy and Open (new tab)
 * beside it. The whole URL is the tooltip and the copied text.
 */
export const PaymentLinkProvenance = provenance({
  source: 'composition',
  composes: ['ui/button'],
  note: 'A read-only field for a provider payment URL with copy and open-in-new-tab icon buttons; used in wallet top-up and record-payment dialogs.',
})

export function PaymentLink({
  url,
  label = 'Payment link',
}: {
  url: string | null | undefined
  /** What the link is, for the buttons' names and the toast: "Checkout link". */
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(reset.current), [])
  if (!url) return null

  const copy = () => {
    void navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        toast.success(`${label} copied`)
        clearTimeout(reset.current)
        reset.current = setTimeout(() => setCopied(false), 1200)
      })
      .catch(() => toast.error('Copy failed'))
  }

  return (
    <div className="border-input bg-muted/40 flex h-9 w-full min-w-0 items-center gap-1 rounded-lg border pr-1 pl-3">
      <span title={url} className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
        {url}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={copy}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${label.toLowerCase()} in a new tab`}
        className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
      >
        <ExternalLinkIcon aria-hidden />
      </a>
    </div>
  )
}

import { provenance } from '@ui/provenance'

/**
 * A payment or checkout link to hand to a customer, shown in a confirm dialog's
 * description: on its own line in a mono box, so a long provider URL wraps
 * cleanly instead of running through the sentence. It opens in a new tab.
 */
export const PaymentLinkProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'A boxed, wrapping, new-tab link for a provider payment URL; used in wallet top-up and record-payment dialogs.',
})

export function PaymentLink({ url }: { url: string | null | undefined }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border bg-muted text-foreground mt-3 block rounded-md border px-3 py-2 font-mono text-xs break-all no-underline"
    >
      {url}
    </a>
  )
}

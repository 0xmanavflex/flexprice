import { ApiError, serverReason, useInvoiceHostedLink } from '@fp/query'
import { toast } from '@fp/ui/pages'

/**
 * "Open hosted invoice" and "Copy hosted invoice link" on the invoice list's
 * row menu and the invoice page's menu — the invoice's own
 * `hosted_invoice_url`, as the customer receives it (Stripe's page when the
 * invoice synced to Stripe, otherwise the Flexprice hosted invoice).
 *
 * The link is read on the click: the SDK drops the field from list and detail
 * responses. The tab is opened on the click itself, before the request, so
 * pop-up blockers allow it; it is pointed at the link once it arrives, and
 * closed again if there is none.
 */
export function useHostedInvoiceLink() {
  const link = useInvoiceHostedLink()

  const open = async (invoiceId: string) => {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await link.mutateAsync(invoiceId)
      if (!url) {
        tab?.close()
        toast.error(NO_LINK)
        return
      }
      if (tab) tab.location.replace(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      tab?.close()
      toast.error(messageOf(cause))
    }
  }

  const copy = async (invoiceId: string) => {
    try {
      const url = await link.mutateAsync(invoiceId)
      if (!url) {
        toast.error(NO_LINK)
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Hosted invoice link copied', {
        description: 'Anyone with the link can view and pay this invoice until it expires.',
      })
    } catch (cause) {
      toast.error(messageOf(cause))
    }
  }

  return { open, copy, isPending: link.isPending }
}

const NO_LINK =
  'This invoice has no hosted link yet. Links are issued when an invoice is finalized.'

function messageOf(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.kind === 'forbidden') {
      return serverReason(cause) ?? 'Your role does not include permission to view this invoice.'
    }
    if (cause.kind === 'not_found') return 'Flexprice could not find this invoice.'
    return serverReason(cause) ?? 'Could not get the hosted invoice link. Try again.'
  }
  if (cause instanceof DOMException)
    return 'Could not copy the link. Allow clipboard access and try again.'
  return 'Could not get the hosted invoice link. Try again.'
}

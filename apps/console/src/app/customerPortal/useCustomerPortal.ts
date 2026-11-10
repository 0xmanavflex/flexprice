import { ApiError, serverReason, useCreateCustomerPortalSession } from '@fp/query'
import { toast } from '@fp/ui/pages'
import { env } from '@/env'
import { publicApiUrls } from '@/surfaces/publicApi'
import { configuredPortalHost } from '@/surfaces/surface'
import { customerPortalLink } from './portalLink'

const portalHost = configuredPortalHost(import.meta.env.VITE_SURFACE_HOSTS as string | undefined)

/**
 * "Open customer portal" and "Copy portal link", as V1 offers them on the
 * customer list's row menu and the customer page: mint a session for the
 * customer's external id, then open the portal in a new tab or copy its link.
 *
 * The tab is opened on the click itself, before the request, so pop-up
 * blockers allow it; it is pointed at the portal once the session exists, and
 * closed again if that fails.
 */
export function useCustomerPortal() {
  const session = useCreateCustomerPortalSession()

  // The link the API built for this customer (its region's portal, with the session
  // token). Built here only when the API sends none.
  const linkFor = async (externalId: string) => {
    const { token, url } = await session.mutateAsync(externalId)
    if (url) return url
    return customerPortalLink(token, {
      origin: window.location.origin,
      region: env.region,
      publicApiUrls,
      portalHost,
    })
  }

  const open = async (customer: { externalId: string | null | undefined }) => {
    if (!customer.externalId) {
      toast.error('This customer has no external ID, so it has no portal.')
      return
    }
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await linkFor(customer.externalId)
      if (tab) tab.location.replace(url)
      else window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      tab?.close()
      toast.error(messageOf(cause))
    }
  }

  const copy = async (customer: { externalId: string | null | undefined }) => {
    if (!customer.externalId) {
      toast.error('This customer has no external ID, so it has no portal.')
      return
    }
    try {
      const url = await linkFor(customer.externalId)
      await navigator.clipboard.writeText(url)
      toast.success('Customer portal link copied', {
        description: 'Anyone with the link can see this customer’s billing until it expires.',
      })
    } catch (cause) {
      toast.error(messageOf(cause))
    }
  }

  return { open, copy, isPending: session.isPending }
}

function messageOf(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.kind === 'forbidden') {
      return (
        serverReason(cause) ?? 'Your role does not include permission to open the customer portal.'
      )
    }
    if (cause.kind === 'not_found')
      return 'Flexprice could not find this customer to open its portal.'
    return serverReason(cause) ?? 'Could not open the customer portal. Try again.'
  }
  if (cause instanceof DOMException)
    return 'Could not copy the link. Allow clipboard access and try again.'
  return 'Could not open the customer portal. Try again.'
}

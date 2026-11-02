import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  useHostedInvoice,
  useHostedInvoiceDownload,
  usePayHostedInvoice,
} from '@fp/query'
import { HostedInvoiceView } from '@fp/ui/pages'
import { publicApiUrls } from '../publicApi'
import { type HostedInvoiceLink, parseHostedInvoiceLink } from './link'
import { pageKind } from './pageKind'
import { isSafeNavigationUrl } from '../safeUrl'
import { frameablePdf } from './pdfFrame'

const GENERIC_ERROR = 'Something went wrong, please try again.'

/**
 * The hosted invoice page: `/<region>/<token>`, no sign-in.
 *
 * `pathname` is the path as this surface sees it: the `/i` prefix that
 * selected it, if any, already removed (see `surface.ts`). Only the path
 * counts: gateways may add a query string or hash when they send the customer
 * back.
 */
export function InvoiceSurface({ pathname }: { pathname: string }) {
  const link = parseHostedInvoiceLink(pathname, publicApiUrls)
  if (!link) return <HostedInvoiceView kind="not-found" />
  return <HostedInvoicePage link={link} />
}

function HostedInvoicePage({ link }: { link: HostedInvoiceLink }) {
  const { data, error, isPending, refetch } = useHostedInvoice(link.apiOrigin, link.token)
  const { pay, isPending: isPaying } = usePayHostedInvoice(link.apiOrigin, link.token)
  const { download } = useHostedInvoiceDownload(link.apiOrigin, link.token)
  const [payError, setPayError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    url: string | null
    frameUrl?: string | null
    error: string | null
  } | null>(null)
  // The blob: copy the preview frames, released when the preview closes; the
  // sequence drops an answer that arrives after the preview was closed.
  const frame = useRef<string | null>(null)
  const previewSeq = useRef(0)
  const releaseFrame = () => {
    if (frame.current) URL.revokeObjectURL(frame.current)
    frame.current = null
  }
  useEffect(() => releaseFrame, [])

  useEffect(() => {
    if (data)
      document.title = data.tenant.name
        ? `Invoice ${data.number} · ${data.tenant.name}`
        : `Invoice ${data.number}`
  }, [data])

  const kind = pageKind({ data, error, isPending })
  if (kind === 'invalid') {
    // A 404 with no message from the API (a proxy, a CDN) is a plain not-found page, not our fallback text.
    const notFound = error as ApiError
    return notFound.fromServer ? (
      <HostedInvoiceView kind="invalid" message={notFound.message} />
    ) : (
      <HostedInvoiceView kind="not-found" />
    )
  }
  if (kind === 'failed') return <HostedInvoiceView kind="failed" onRetry={refetch} />
  if (kind === 'loading' || !data) return <HostedInvoiceView kind="loading" />

  const onPay = async () => {
    setPayError(null)
    // Checkout opens in a new tab, like the customer portal; this page refetches when the customer returns to it.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await pay()
      if (url === null) {
        tab?.close()
        return
      }
      if (!isSafeNavigationUrl(url)) {
        tab?.close()
        setPayError(GENERIC_ERROR)
        return
      }
      if (tab) tab.location.replace(url)
      else window.location.assign(url)
    } catch (cause) {
      tab?.close()
      setPayError(messageOf(cause))
    }
  }

  // The preview fetches the PDF's link when it opens (each link lasts an hour); its Download PDF saves it.
  const onPreview = async () => {
    const seq = ++previewSeq.current
    releaseFrame()
    setPreview({ url: null, error: null })
    try {
      const url = await download()
      if (seq !== previewSeq.current) return
      if (url === null || !isSafeNavigationUrl(url)) {
        setPreview({ url: null, error: GENERIC_ERROR })
        return
      }
      const frameUrl = await frameablePdf(url)
      if (seq !== previewSeq.current) {
        if (frameUrl?.startsWith('blob:')) URL.revokeObjectURL(frameUrl)
        return
      }
      if (frameUrl?.startsWith('blob:')) frame.current = frameUrl
      setPreview({ url, frameUrl, error: null })
    } catch (cause) {
      if (seq === previewSeq.current) setPreview({ url: null, error: messageOf(cause) })
    }
  }

  return (
    <HostedInvoiceView
      kind="invoice"
      invoice={data}
      onPay={() => void onPay()}
      isPaying={isPaying}
      payError={payError}
      onPreview={() => void onPreview()}
      preview={preview}
      onClosePreview={() => {
        previewSeq.current++
        releaseFrame()
        setPreview(null)
      }}
    />
  )
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiError && cause.fromServer ? cause.message : GENERIC_ERROR
}

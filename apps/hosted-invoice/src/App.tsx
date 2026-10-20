import { useEffect, useState } from 'react'
import {
  ApiError,
  useHostedInvoice,
  useHostedInvoiceDownload,
  usePayHostedInvoice,
} from '@fp/query'
import { HostedInvoiceView } from '@fp/ui/pages'
import { env } from './env'
import { type HostedInvoiceLink, parseHostedInvoiceLink } from './link'
import { pageKind } from './pageKind'
import { isSafeNavigationUrl } from './safeUrl'

const GENERIC_ERROR = 'Something went wrong, please try again.'

/** Only the path counts: gateways may add a query string or hash when they send the customer back. */
export function App({ pathname }: { pathname: string }) {
  const link = parseHostedInvoiceLink(pathname, env.apiUrls)
  if (!link) return <HostedInvoiceView kind="not-found" />
  return <HostedInvoicePage link={link} />
}

function HostedInvoicePage({ link }: { link: HostedInvoiceLink }) {
  const { data, error, isPending, refetch } = useHostedInvoice(link.apiOrigin, link.token)
  const { pay, isPending: isPaying } = usePayHostedInvoice(link.apiOrigin, link.token)
  const { download, isPending: isDownloading } = useHostedInvoiceDownload(
    link.apiOrigin,
    link.token,
  )
  const [payError, setPayError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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
    try {
      const url = await pay()
      if (url === null) return
      if (!isSafeNavigationUrl(url)) {
        setPayError(GENERIC_ERROR)
        return
      }
      window.location.assign(url)
    } catch (cause) {
      setPayError(messageOf(cause))
    }
  }

  const onDownload = async () => {
    setDownloadError(null)
    // Opened on the click itself so pop-up blockers allow it; pointed at the PDF once the API answers.
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await download()
      if (url === null || !isSafeNavigationUrl(url)) {
        tab?.close()
        setDownloadError(GENERIC_ERROR)
        return
      }
      if (tab) tab.location.replace(url)
      else window.location.assign(url)
    } catch (cause) {
      tab?.close()
      setDownloadError(messageOf(cause))
    }
  }

  return (
    <HostedInvoiceView
      kind="invoice"
      invoice={data}
      onPay={() => void onPay()}
      isPaying={isPaying}
      payError={payError}
      onDownload={() => void onDownload()}
      isDownloading={isDownloading}
      downloadError={downloadError}
    />
  )
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiError && cause.fromServer ? cause.message : GENERIC_ERROR
}

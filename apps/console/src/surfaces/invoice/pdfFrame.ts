/**
 * What the invoice preview's frame should show for a PDF link.
 *
 * A link the browser is told to save (`Content-Disposition: attachment`, as a
 * billing provider's download link usually is, or a generic content type) is
 * downloaded by a frame instead of shown: the preview stays blank and a file
 * lands in Downloads. So the PDF is fetched and framed as a `blob:` copy typed
 * `application/pdf`, which the browser always displays.
 *
 * When the host does not allow the fetch (CORS), a presigned storage link is
 * framed as it is: Flexprice stores the PDF typed and inline. Any other link
 * gets null, and the dialog offers a new tab and the download instead of a
 * frame that would download.
 *
 * A one-page PDF opens with the viewer's toolbar off (`#toolbar=0`), so the
 * preview does not carry a "1 / 1" page counter; the dialog already offers
 * Download and Open in a new tab. Longer PDFs, and any whose pages cannot be
 * counted, keep the toolbar to page through.
 */
export async function frameablePdf(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(url, { credentials: 'omit' })
    if (response.ok) {
      const bytes = await response.blob()
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const pages = pdfPageCount(await bytes.text().catch(() => ''))
      return pages === 1 ? `${blobUrl}${SINGLE_PAGE_VIEW}` : blobUrl
    }
  } catch {
    /* blocked by CORS or the network: decided below from the link itself */
  }
  return isPresignedStorageLink(url) ? url : null
}

/** An S3-style presigned link: the PDF Flexprice stored, typed and inline. */
export function isPresignedStorageLink(url: string): boolean {
  try {
    const params = new URL(url).searchParams
    return params.has('X-Amz-Signature') || params.has('Signature')
  } catch {
    return false
  }
}

/** Viewer open parameters for a one-page PDF: no toolbar (and its page counter), no sidebar. */
const SINGLE_PAGE_VIEW = '#toolbar=0&navpanes=0'

/**
 * The page objects in a PDF's source (`/Type /Page`, not `/Pages`). Zero when
 * they cannot be read, for example when the page objects sit in a compressed
 * object stream; callers treat that as unknown, not as one page.
 */
export function pdfPageCount(source: string): number {
  return source.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0
}

/** The `blob:` URL a frame URL was made from, without its viewer parameters, for revoking. */
export function blobOf(frameUrl: string): string {
  const hash = frameUrl.indexOf('#')
  return hash === -1 ? frameUrl : frameUrl.slice(0, hash)
}

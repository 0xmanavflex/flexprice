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
 */
export async function frameablePdf(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(url, { credentials: 'omit' })
    if (response.ok) {
      const bytes = await response.blob()
      return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
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

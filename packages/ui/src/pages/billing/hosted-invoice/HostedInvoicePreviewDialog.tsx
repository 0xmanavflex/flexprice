import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Button } from '@ui/components/primitives/button'
import { Spinner } from '@ui/components/primitives/spinner'
import { DownloadIcon, ExternalLinkIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'

export const HostedInvoicePreviewDialogProvenance = provenance({
  source: 'composition',
  composes: ['primitives/dialog', 'primitives/button', 'primitives/spinner'],
  note: "The hosted invoice redesign's 'Preview invoice': the invoice's own PDF in a dialog, with Download PDF.",
})

export interface HostedInvoicePreviewDialogProps {
  /** Null when closed; `url` null while the link is being fetched. */
  preview: { url: string | null; error: string | null } | null
  onClose: () => void
  number: string
}

/**
 * The invoice's PDF, shown where the customer is rather than in a new tab.
 *
 * The PDF is the real one (the link `GET /public/v1/invoices/pdf` answers), so
 * the preview is exactly what Download saves. Some billing providers refuse to
 * be framed; "Open in a new tab" is always there for that case.
 */
export function HostedInvoicePreviewDialog({
  preview,
  onClose,
  number,
}: HostedInvoicePreviewDialogProps) {
  const url = preview?.url ?? null
  return (
    <Dialog open={preview !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="flex h-[min(90svh,56rem)] w-[min(96vw,52rem)] max-w-none flex-col gap-3 p-4 sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-3 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate font-mono text-sm">{number}.pdf</DialogTitle>
            <DialogDescription className="text-xs">Invoice PDF</DialogDescription>
          </div>
          {url ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<a href={url} target="_blank" rel="noopener noreferrer" role="link" />}
              >
                <ExternalLinkIcon aria-hidden className="size-4" />
                Open in a new tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a href={url} download={`${number}.pdf`} rel="noopener noreferrer" role="link" />
                }
              >
                <DownloadIcon aria-hidden className="size-4" />
                Download PDF
              </Button>
            </div>
          ) : null}
        </DialogHeader>
        <div className="bg-muted/40 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border">
          {preview?.error ? (
            <p role="alert" className="text-destructive px-6 text-center text-sm">
              {preview.error}
            </p>
          ) : url ? (
            <iframe title={`Invoice ${number}`} src={url} className="size-full border-0 bg-white" />
          ) : (
            <span role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner aria-hidden />
              Preparing the PDF…
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

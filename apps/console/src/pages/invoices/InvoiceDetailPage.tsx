import { useState } from 'react'
import {
  ApiError,
  useAttemptInvoicePayment,
  useFinalizeInvoice,
  useInvoice,
  useTenant,
  useUserInfo,
  useVoidInvoice,
} from '@fp/query'
import { InvoiceDetailView, Toaster, toast } from '@fp/ui/pages'
import { AppFailure, ConfirmDialog, LoadingRows, PageBody } from '@fp/ui/compositions'
import { toInvoiceDocument } from './invoiceDocumentAdapter'

export interface InvoiceDetailPageProps {
  invoiceId: string
  onBack: () => void
  onEdit?: () => void
  onOpenCustomer: (customerId: string) => void
}

/** One invoice, read through `useInvoice`; finalize, void and retry run here, outside the view. */
export function InvoiceDetailPage({
  invoiceId,
  onBack,
  onEdit,
  onOpenCustomer,
}: InvoiceDetailPageProps) {
  const invoice = useInvoice(invoiceId)
  const me = useUserInfo()
  const tenant = useTenant(me.data?.tenantId ?? '')
  const finalize = useFinalizeInvoice()
  const voidInvoice = useVoidInvoice()
  const attempt = useAttemptInvoicePayment()
  const [confirmVoid, setConfirmVoid] = useState(false)

  if (invoice.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (invoice.error || !invoice.data) {
    return (
      <PageBody>
        <AppFailure
          title={invoice.error ? 'This invoice could not be loaded' : 'Invoice not found'}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={invoice.error ? () => void invoice.refetch() : onBack}
        />
      </PageBody>
    )
  }

  const data = invoice.data
  const run = (action: typeof finalize, done: string) =>
    action.mutate(data.id, {
      onSuccess: () => toast(done),
      onError: (error) => toast(failure(error)),
    })

  return (
    <>
      <InvoiceDetailView
        invoice={toInvoiceDocument(data, tenant.data)}
        onBack={onBack}
        {...(onEdit ? { onEdit } : {})}
        isFinalizing={finalize.isPending}
        onFinalize={() => run(finalize, 'Invoice finalized')}
        onVoid={() => setConfirmVoid(true)}
        onRetryPayment={() => run(attempt, 'Payment attempt started')}
        {...(data.invoicePdfUrl
          ? { onDownload: () => window.open(data.invoicePdfUrl ?? '', '_blank', 'noopener') }
          : {})}
        onOpenCustomer={() => onOpenCustomer(data.customerId)}
      />
      <ConfirmDialog
        open={confirmVoid}
        onOpenChange={setConfirmVoid}
        title="Void this invoice?"
        description="A voided invoice can no longer be collected. This cannot be undone."
        confirmLabel="Void invoice"
        destructive
        isPending={voidInvoice.isPending}
        error={voidInvoice.error ? failure(voidInvoice.error) : null}
        onConfirm={() => voidInvoice.mutate(data.id, { onSuccess: () => setConfirmVoid(false) })}
      />
      <Toaster />
    </>
  )
}

function failure(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'forbidden')
    return 'You do not have permission to change invoices here.'
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'The invoice could not be changed.'
  return 'Could not complete that. Try again.'
}

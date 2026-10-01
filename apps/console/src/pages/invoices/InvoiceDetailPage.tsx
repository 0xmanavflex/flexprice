import { useNavigate } from '@tanstack/react-router'
import { DEMO_INVOICE, InvoiceDetailView, Toaster, toast } from '@fp/ui/pages'

// Demo document until the real invoice read is mapped through an adapter; actions stay out here.
export function InvoiceDetailPage() {
  const navigate = useNavigate()
  return (
    <>
      <InvoiceDetailView
        invoice={DEMO_INVOICE}
        onBack={() => void navigate({ to: '/invoices', search: {} as never })}
        onFinalize={() => toast('Finalize is not wired yet')}
        onRetryPayment={() => toast('Retry payment is not wired yet')}
        onDownload={() => toast('Download is not wired yet')}
        onOpenCustomer={() =>
          void navigate({
            to: '/customers/$customerId',
            params: { customerId: DEMO_INVOICE.customerId },
            search: {} as never,
          })
        }
      />
      <Toaster />
    </>
  )
}

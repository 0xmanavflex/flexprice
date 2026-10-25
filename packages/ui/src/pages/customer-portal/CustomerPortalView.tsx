import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import type { PortalInvoice, PortalPaymentMethod, PortalWallet } from '@fp/domain'
import { provenance } from '@ui/provenance'
import {
  AddCardDialog,
  AddCreditsDialog,
  AutoTopupDialog,
  DownloadDialog,
  PayInvoiceDialog,
  RemoveCardDialog,
} from './PortalDialogs'
import { PortalCredits } from './PortalCredits'
import { PortalInvoiceSheet } from './PortalInvoiceSheet'
import { PortalInvoices } from './PortalInvoices'
import { PortalOverview } from './PortalOverview'
import { PortalShell } from './PortalShell'
import { PortalUsage } from './PortalUsage'
import type { CustomerPortalViewProps } from './types'

/**
 * The customer portal: what a merchant's customer sees behind their portal
 * link: Overview, Usage, Credits and Invoices, with paying, buying credits,
 * auto top-up and saving cards. Presentational: the app passes data and
 * actions; this holds only which dialog is open.
 */
export const CustomerPortalViewProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/customer-portal/PortalShell',
    'pages/customer-portal/PortalOverview',
    'pages/customer-portal/PortalUsage',
    'pages/customer-portal/PortalCredits',
    'pages/customer-portal/PortalInvoices',
    'pages/customer-portal/PortalDialogs',
    'pages/customer-portal/PortalInvoiceSheet',
  ],
  note: 'Customer portal surface, after the Flexprice customer portal prototype.',
})

export function CustomerPortalView(props: CustomerPortalViewProps) {
  const { data, actions, brandName, locale } = props
  const now = props.now ?? new Date()
  const [paying, setPaying] = useState<PortalInvoice | null>(null)
  const [downloading, setDownloading] = useState<PortalInvoice | null>(null)
  const [topUp, setTopUp] = useState<PortalWallet | null>(null)
  const [autoTopup, setAutoTopup] = useState<PortalWallet | null>(null)
  const [addingCard, setAddingCard] = useState(false)
  const [removing, setRemoving] = useState<PortalPaymentMethod | null>(null)

  const wallets = data.wallets.status === 'ready' ? data.wallets.data : []
  const wallet =
    wallets.find((w) => w.id === props.walletId) ??
    wallets.find((w) => w.active) ??
    wallets[0] ??
    null
  const gateways = data.gateways.status === 'ready' ? data.gateways.data : []
  const cards = data.paymentMethods.status === 'ready' ? data.paymentMethods.data : []
  // A default card that has not expired, on a gateway that can charge it unattended.
  const chargeable =
    cards.find(
      (c) =>
        c.isDefault &&
        !c.expired &&
        gateways.some((g) => g.provider === c.provider && g.autoCharge),
    ) ?? null
  const defaultCard = cards.find((c) => c.isDefault) ?? null
  const customer = data.customer.status === 'ready' ? data.customer.data : null
  const periodStart =
    data.subscriptions.status === 'ready'
      ? (data.subscriptions.data.find((s) => s.status === 'active' && s.periodStart)?.periodStart ??
        null)
      : null

  const openInvoice = (invoice: PortalInvoice) => actions.onOpenInvoice(invoice.id)
  const pay = (invoice: PortalInvoice) => {
    actions.onOpenInvoice(null)
    setPaying(invoice)
  }
  const download = (invoice: PortalInvoice) => {
    actions.onOpenInvoice(null)
    setDownloading(invoice)
  }
  const copied = () => toast.success('Payment link copied')
  const failed = (cause: unknown) =>
    toast.error(
      cause instanceof Error && cause.message
        ? cause.message
        : 'Something went wrong. Please try again.',
    )

  return (
    <PortalShell
      brandName={brandName}
      brandColor={props.brandColor}
      customer={data.customer}
      views={props.views}
      view={props.view}
      onViewChange={actions.onViewChange}
    >
      {props.view === 'overview' ? (
        <PortalOverview
          brandName={brandName}
          data={data}
          now={now}
          locale={locale}
          onGoTo={actions.onViewChange}
          onPay={pay}
          onViewInvoice={openInvoice}
          onAddCredits={() => wallet && setTopUp(wallet)}
          onAddCard={() => setAddingCard(true)}
          onRemoveCard={setRemoving}
          onMakeDefault={(card) =>
            void actions
              .makeDefault(card)
              .then(
                () => toast.success(`${card.brand} •••• ${card.last4} is now your default card`),
                failed,
              )
          }
        />
      ) : null}
      {props.view === 'usage' ? (
        <PortalUsage
          data={data}
          range={props.range}
          customRange={props.customRange}
          onRangeChange={actions.onRangeChange}
          onCustomRange={actions.onCustomRange}
          now={now}
          locale={locale}
        />
      ) : null}
      {props.view === 'credits' ? (
        <PortalCredits
          data={data}
          walletId={wallet?.id ?? null}
          periodStart={periodStart}
          onWalletChange={actions.onWalletChange}
          onAddCredits={() => wallet && setTopUp(wallet)}
          onAutoTopup={() => wallet && setAutoTopup(wallet)}
          onShowMore={actions.onShowMoreTransactions}
          locale={locale}
        />
      ) : null}
      {props.view === 'invoices' ? (
        <PortalInvoices
          data={data}
          locale={locale}
          onOpen={openInvoice}
          onPay={pay}
          onDownload={download}
        />
      ) : null}

      <PortalInvoiceSheet
        invoice={data.invoiceDetail}
        brandName={brandName}
        customer={customer}
        card={defaultCard}
        locale={locale}
        onClose={() => actions.onOpenInvoice(null)}
        onPay={pay}
        onDownload={download}
      />
      <PayInvoiceDialog
        invoice={paying}
        gateways={gateways}
        brandName={brandName}
        locale={locale}
        onClose={() => setPaying(null)}
        onPay={actions.payInvoice}
        onPaid={actions.onRefresh}
        onCopied={copied}
      />
      <DownloadDialog
        invoice={downloading}
        onClose={() => setDownloading(null)}
        onPdf={actions.downloadInvoice}
      />
      <AddCreditsDialog
        key={topUp?.id ?? 'closed'}
        wallet={topUp}
        gateways={gateways}
        defaultCard={chargeable}
        locale={locale}
        onClose={() => setTopUp(null)}
        onAdd={async (target, credits, via, note) => {
          const url = await actions.addCredits(target, credits, via, note)
          if (url === null) toast.success(`${credits} credits added`)
          return url
        }}
        onPaid={actions.onRefresh}
        onCopied={copied}
      />
      <AutoTopupDialog
        key={autoTopup?.id ?? 'closed'}
        wallet={autoTopup}
        card={chargeable}
        locale={locale}
        onClose={() => setAutoTopup(null)}
        onSave={async (target, settings) => {
          await actions.saveAutoTopup(target, settings)
          toast.success(settings.enabled ? 'Auto top-up is on' : 'Auto top-up is off')
        }}
      />
      <AddCardDialog
        open={addingCard}
        gateways={gateways}
        onClose={() => setAddingCard(false)}
        onAdd={actions.addCard}
        onPaid={actions.onRefresh}
        onCopied={copied}
      />
      <RemoveCardDialog
        card={removing}
        onClose={() => setRemoving(null)}
        onRemove={async (card) => {
          await actions.removeCard(card)
          toast.success(`${card.brand} •••• ${card.last4} removed`)
        }}
      />
      <Toaster position="bottom-right" />
    </PortalShell>
  )
}

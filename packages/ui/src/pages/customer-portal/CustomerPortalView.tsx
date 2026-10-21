import { useState } from 'react'
import type { PortalInvoice, PortalPaymentMethod, PortalWallet } from '@fp/domain'
import { provenance } from '@ui/provenance'
import {
  AddCardDialog,
  AddCreditsDialog,
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
 * link — Overview, Usage, Credits and Invoices, with paying, buying credits
 * and saving cards. Presentational: the app passes data and actions; this
 * holds only which dialog is open.
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
  note: 'Customer portal surface, after the Flexprice customer portal reference.',
})

export function CustomerPortalView(props: CustomerPortalViewProps) {
  const { data, actions, brandName, locale } = props
  const now = props.now ?? new Date()
  const [paying, setPaying] = useState<PortalInvoice | null>(null)
  const [topUp, setTopUp] = useState<PortalWallet | null>(null)
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
  // Only a default card that has not expired, on a gateway that can charge it unattended, pays a top-up "now".
  const chargeable =
    cards.find(
      (c) =>
        c.isDefault &&
        !c.expired &&
        gateways.some((g) => g.provider === c.provider && g.autoCharge),
    ) ?? null
  const customer = data.customer.status === 'ready' ? data.customer.data : null

  const openInvoice = (invoice: PortalInvoice) => actions.onOpenInvoice(invoice.id)
  const pay = (invoice: PortalInvoice) => {
    actions.onOpenInvoice(null)
    setPaying(invoice)
  }
  const download = (invoice: PortalInvoice) =>
    void actions.downloadInvoice(invoice).catch(() => undefined)

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
          onMakeDefault={(card) => void actions.makeDefault(card).catch(() => undefined)}
        />
      ) : null}
      {props.view === 'usage' ? (
        <PortalUsage
          data={data}
          range={props.range}
          onRangeChange={actions.onRangeChange}
          now={now}
          locale={locale}
        />
      ) : null}
      {props.view === 'credits' ? (
        <PortalCredits
          data={data}
          walletId={wallet?.id ?? null}
          onWalletChange={actions.onWalletChange}
          onAddCredits={() => wallet && setTopUp(wallet)}
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
      />
      <AddCreditsDialog
        wallet={topUp}
        gateways={gateways}
        defaultCard={chargeable}
        locale={locale}
        onClose={() => setTopUp(null)}
        onAdd={actions.addCredits}
      />
      <AddCardDialog
        open={addingCard}
        gateways={gateways}
        onClose={() => setAddingCard(false)}
        onAdd={actions.addCard}
      />
      <RemoveCardDialog
        card={removing}
        onClose={() => setRemoving(null)}
        onRemove={actions.removeCard}
      />
    </PortalShell>
  )
}

import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import {
  DEFAULT_PORTAL_CONFIG,
  NO_USAGE_FILTER,
  chargeableCard,
  preferGateway,
  type PortalInvoice,
  type PortalPaymentMethod,
  type PortalWallet,
} from '@fp/domain'
import { provenance } from '@ui/provenance'
import {
  CardLinkDialog,
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
  const parts = props.parts ?? DEFAULT_PORTAL_CONFIG.parts
  const [paying, setPaying] = useState<PortalInvoice | null>(null)
  const [downloading, setDownloading] = useState<PortalInvoice | null>(null)
  const [topUp, setTopUp] = useState<PortalWallet | null>(null)
  // The wallet's id, not a copy of it: the dialog reads the wallet as loaded now,
  // so a refetch (after a save) shows in it rather than the state when it opened.
  const [autoTopupId, setAutoTopupId] = useState<string | null>(null)
  /** The card form the gateway opened, kept on screen in case its tab was blocked. */
  const [cardLink, setCardLink] = useState<string | null>(null)
  const [removing, setRemoving] = useState<PortalPaymentMethod | null>(null)

  const wallets = data.wallets.status === 'ready' ? data.wallets.data : []
  const wallet =
    wallets.find((w) => w.id === props.walletId) ??
    wallets.find((w) => w.active) ??
    wallets[0] ??
    null
  const cards = data.paymentMethods.status === 'ready' ? data.paymentMethods.data : []
  const defaultCard = cards.find((c) => c.isDefault) ?? null
  // The API lists gateways by name and marks none as the default, so the first was
  // whichever sorts first (Razorpay before Stripe). The gateway the customer's card
  // is saved at is the one they use; it goes first and is pre-selected.
  const gateways = preferGateway(
    data.gateways.status === 'ready' ? data.gateways.data : [],
    defaultCard?.provider ?? cards[0]?.provider,
  )
  // The default card if it can be charged unattended, else another that can.
  const chargeable = chargeableCard(cards, gateways)
  const customer = data.customer.status === 'ready' ? data.customer.data : null
  const periodStart =
    data.subscriptions.status === 'ready'
      ? (data.subscriptions.data.find(
          (s) => (s.status === 'active' || s.status === 'trialing') && s.periodStart,
        )?.periodStart ?? null)
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
      {...(props.labels ? { labels: props.labels } : {})}
      view={props.view}
      onViewChange={actions.onViewChange}
    >
      {props.view === 'overview' ? (
        <PortalOverview
          brandName={brandName}
          parts={parts}
          data={data}
          now={now}
          locale={locale}
          views={props.views}
          onGoTo={actions.onViewChange}
          onPay={pay}
          onViewInvoice={openInvoice}
          onAddCredits={() => wallet && setTopUp(wallet)}
          onAddCard={(provider) => {
            // Called on the click itself: the gateway's tab opens before any await.
            void actions.addCard(provider).then(
              (url) => setCardLink(url),
              (cause: unknown) =>
                toast.error(cause instanceof Error ? cause.message : 'Couldn’t open the card form'),
            )
          }}
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
          parts={parts}
          ranges={props.ranges ?? DEFAULT_PORTAL_CONFIG.usage.ranges}
          allowCustomRange={props.allowCustomRange ?? true}
          groupKeys={props.groupKeys ?? []}
          groupBy={props.groupBy ?? null}
          onGroupByChange={actions.onGroupByChange ?? (() => undefined)}
          filter={props.usageFilter ?? NO_USAGE_FILTER}
          onFilterChange={actions.onUsageFilterChange ?? (() => undefined)}
          filterChoices={{
            features:
              props.usageFeatures ??
              (data.spend.status === 'ready'
                ? data.spend.data.items.map((item) => ({ id: item.featureId, name: item.name }))
                : []),
            properties: props.propertyValues ?? {},
          }}
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
          parts={parts}
          walletId={wallet?.id ?? null}
          periodStart={periodStart}
          onWalletChange={actions.onWalletChange}
          onAddCredits={() => wallet && setTopUp(wallet)}
          onAutoTopup={() => wallet && setAutoTopupId(wallet.id)}
          onShowMore={actions.onShowMoreTransactions}
          onShowMoreTopUps={actions.onShowMoreTopUps}
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
        key={`top-up:${topUp?.id ?? 'closed'}`}
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
        key={`auto-topup:${autoTopupId ?? 'closed'}`}
        wallet={wallets.find((w) => w.id === autoTopupId) ?? null}
        card={chargeable}
        locale={locale}
        onClose={() => setAutoTopupId(null)}
        onSave={async (target, settings) => {
          await actions.saveAutoTopup(target, settings)
          toast.success(settings.enabled ? 'Auto top-up is on' : 'Auto top-up is off')
        }}
      />
      <CardLinkDialog
        url={cardLink}
        onClose={() => setCardLink(null)}
        onAdded={actions.onRefresh}
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

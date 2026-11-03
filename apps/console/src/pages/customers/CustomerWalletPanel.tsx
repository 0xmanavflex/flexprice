import { useState } from 'react'
import {
  ApiError,
  useBonusCreditsConfig,
  useConnections,
  useCreateWallet,
  useDebitWallet,
  useCustomerWallets,
  useTerminateWallet,
  useTopUpWallet,
  useUpdateAutoTopup,
  useUpdateWalletAlerts,
  useUpdateWalletMetadata,
  useWalletBalance,
  useWalletTransactions,
  serverReason,
  type TopUpCheckoutSession,
} from '@fp/query'
import { emptyAlertSettingConfig, type TopUpWallet } from '@fp/domain'
import { CustomerWalletView, EntityAlertDialog, toast } from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { subTab } from '@/pages/shared/subTab'
import { useSession } from '@/app/session'

export interface CustomerWalletPanelProps {
  customerId: string
  /** View only: an archived customer's wallets can be read, not changed. */
  readOnly?: boolean
}

/**
 * The provider a checkout top-up is paid through. V1 sends every checkout to
 * Razorpay, so the link is offered only while a Razorpay connection exists.
 */
const CHECKOUT_PROVIDER = 'razorpay'

/** Wires a customer's wallets: reads them, and runs create, top-up, auto top-up and terminate. */
export function CustomerWalletPanel({ customerId, readOnly = false }: CustomerWalletPanelProps) {
  const wallets = useCustomerWallets(customerId)
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = wallets.data?.find((wallet) => wallet.id === chosen) ?? wallets.data?.[0] ?? null
  const transactions = useWalletTransactions(selected?.id ?? null)
  /*
   * The list only knows the balance as of the last invoice. The real-time
   * figure (usage since then netted off) comes from its own read, for the
   * wallet on screen; until it answers, the stored balance stands in.
   */
  const live = useWalletBalance(selected?.id ?? null)
  const shown = (wallets.data ?? []).map((wallet) =>
    wallet.id === selected?.id && live.data
      ? {
          ...wallet,
          realTimeBalance: live.data.realTimeBalance,
          realTimeCreditBalance: live.data.realTimeCreditBalance,
        }
      : wallet,
  )

  const ledger = subTab(transactions, 'wallet transactions')
  const transactionProps = {
    transactionsLoading: ledger.isLoading,
    transactionsError: ledger.error ?? null,
    ...(ledger.errorKind ? { transactionsErrorKind: ledger.errorKind } : {}),
    ...(ledger.onRetry ? { onRetryTransactions: ledger.onRetry } : {}),
  }

  const create = useCreateWallet(customerId)
  const topUp = useTopUpWallet(selected?.id ?? '')
  // Only a preview in the top-up dialog: when it cannot be read, the dialog
  // just does not predict the bonus.
  const { environmentId } = useSession()
  const bonusConfig = useBonusCreditsConfig(environmentId)
  const debit = useDebitWallet(selected?.id ?? '')
  const autoTopup = useUpdateAutoTopup(selected?.id ?? '')
  const walletAlerts = useUpdateWalletAlerts(selected?.id ?? '')
  const walletMetadata = useUpdateWalletMetadata(selected?.id ?? '')
  const [alerting, setAlerting] = useState(false)
  const terminate = useTerminateWallet()
  const connections = useConnections()
  const checkoutProvider =
    connections.data?.find(
      (integration) =>
        integration.providerType === CHECKOUT_PROVIDER && integration.connections.length > 0,
    )?.name ?? null
  // The link a checkout top-up created, to hand to the customer.
  const [checkoutLink, setCheckoutLink] = useState<string | null>(null)
  // A checkout already in flight that refused the last one, with the top-up it refused.
  const [blocked, setBlocked] = useState<{
    session: TopUpCheckoutSession
    draft: TopUpWallet
  } | null>(null)

  const runTopUp = (draft: TopUpWallet, supersede = false) =>
    topUp
      .mutateAsync({
        ...draft,
        ...(draft.kind === 'purchased' && draft.checkout && checkoutProvider
          ? {
              payAt: {
                provider: CHECKOUT_PROVIDER,
                returnUrl: window.location.href,
                ...(supersede ? { supersede: true } : {}),
              },
            }
          : {}),
      })
      .then((result) => {
        const session = result.checkoutSession
        // Checked first: a blocked answer carries the other checkout's live link,
        // for an amount nobody entered here, so it must not be handed on as this one.
        if (session?.blocked) {
          setBlocked({ session, draft })
        } else if (draft.kind === 'purchased' && draft.checkout) {
          setBlocked(null)
          if (session?.url) setCheckoutLink(session.url)
          else toast.success('Checkout created. The provider sent no link to share.')
        } else if (draft.kind === 'purchased' && draft.invoice) {
          toast.success('Invoice created. The credits land once it is paid.')
        } else {
          toast.success(draft.kind === 'free' ? 'Credits granted' : 'Wallet topped up')
        }
        return result
      })

  return (
    <>
      <CustomerWalletView
        readOnly={readOnly}
        {...(selected ? { onAlertSettings: () => setAlerting(true) } : {})}
        {...(selected
          ? { onSaveMetadata: (metadata) => walletMetadata.mutateAsync(metadata) }
          : {})}
        wallets={shown}
        isLoading={wallets.isPending}
        failed={wallets.error !== null && !wallets.data}
        onRetry={() => void wallets.refetch()}
        selectedId={selected?.id ?? null}
        onSelect={setChosen}
        transactions={transactions.data ?? []}
        {...transactionProps}
        onCreateWallet={(draft) =>
          create.mutateAsync(draft).then((created) => {
            toast.success('Wallet created')
            return created
          })
        }
        createError={failure(create.error, 'create the wallet')}
        onTopUp={(draft) => runTopUp(draft)}
        checkoutProvider={checkoutProvider}
        topUpError={failure(topUp.error, 'top up the wallet')}
        bonusConfig={bonusConfig.data ?? null}
        onDebit={(draft) =>
          debit.mutateAsync(draft).then((result) => {
            toast.success('Wallet debited')
            return result
          })
        }
        debitError={failure(debit.error, 'debit the wallet')}
        onSaveAutoTopup={(draft) =>
          autoTopup.mutateAsync(draft).then((result) => {
            toast.success(draft.enabled ? 'Auto top-up saved' : 'Auto top-up turned off')
            return result
          })
        }
        autoTopupError={failure(autoTopup.error, 'update auto top-up')}
        onTerminate={() =>
          terminate.mutateAsync(selected?.id ?? '').then((result) => {
            toast.success('Wallet terminated')
            return result
          })
        }
        terminateError={failure(terminate.error, 'terminate the wallet')}
        onResetErrors={() => {
          create.reset()
          topUp.reset()
          debit.reset()
          autoTopup.reset()
          terminate.reset()
        }}
      />
      {/* V1 keeps a wallet's balance alerts on the wallet (`alert_settings`). */}
      <EntityAlertDialog
        open={alerting && selected !== null}
        onOpenChange={setAlerting}
        noun="Wallet"
        isLoading={false}
        loadFailed={false}
        isNew={!selected?.alertSettings}
        initial={selected?.alertSettings ?? emptyAlertSettingConfig()}
        onSave={(config) => walletAlerts.mutateAsync(config)}
      />
      <ConfirmDialog
        open={checkoutLink !== null}
        onOpenChange={(open) => (open ? undefined : setCheckoutLink(null))}
        title="Checkout link ready"
        description={
          <>
            Send this link to the customer. The credits land once they pay.{' '}
            <a
              href={checkoutLink ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-mono break-all underline"
            >
              {checkoutLink}
            </a>
          </>
        }
        confirmLabel="Copy link"
        cancelLabel="Done"
        onConfirm={() =>
          void navigator.clipboard
            ?.writeText(checkoutLink ?? '')
            .then(() => toast.success('Checkout link copied'))
            .catch(() => toast.error('Copy failed'))
        }
      />
      <ConfirmDialog
        open={blocked !== null}
        onOpenChange={(open) => (open || topUp.isPending ? undefined : setBlocked(null))}
        title="A checkout is already open"
        description={
          <>
            This wallet has a checkout the customer has not finished
            {blocked?.session.expiresAt
              ? `, open until ${blocked.session.expiresAt.toLocaleString()}`
              : ''}
            . They may be paying it now, so nothing new was created. Send them that link, or cancel
            it and create one for this top-up.
            {blocked?.session.url ? (
              <>
                {' '}
                <a
                  href={blocked.session.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-mono break-all underline"
                >
                  {blocked.session.url}
                </a>
              </>
            ) : null}
          </>
        }
        confirmLabel="Cancel it and create new"
        pendingLabel="Creating…"
        destructive
        isPending={topUp.isPending}
        error={failure(topUp.error, 'create the checkout')}
        onConfirm={() => blocked && void runTopUp(blocked.draft, true).catch(() => undefined)}
      />
    </>
  )
}

function failure(error: unknown, what: string): string | null {
  if (!error) return null
  if (error instanceof ApiError && error.kind === 'forbidden')
    return serverReason(error) ?? `You do not have permission to ${what}.`
  if (error instanceof ApiError && error.kind === 'invalid')
    return error.message || 'Check the details and try again.'
  return `Could not ${what}. Try again.`
}

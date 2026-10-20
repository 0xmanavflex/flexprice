import { useState } from 'react'
import {
  ApiError,
  useCreateWallet,
  useDebitWallet,
  useCustomerWallets,
  useTerminateWallet,
  useTopUpWallet,
  useUpdateAutoTopup,
  useWalletBalance,
  useWalletTransactions,
  serverReason,
} from '@fp/query'
import { CustomerWalletView, toast } from '@fp/ui/pages'
import { subTab } from '@/pages/shared/subTab'

export interface CustomerWalletPanelProps {
  customerId: string
}

/** Wires a customer's wallets: reads them, and runs create, top-up, auto top-up and terminate. */
export function CustomerWalletPanel({ customerId }: CustomerWalletPanelProps) {
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
  const debit = useDebitWallet(selected?.id ?? '')
  const autoTopup = useUpdateAutoTopup(selected?.id ?? '')
  const terminate = useTerminateWallet()

  return (
    <CustomerWalletView
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
      onTopUp={(draft) =>
        topUp.mutateAsync(draft).then((result) => {
          toast.success(draft.kind === 'free' ? 'Credits granted' : 'Wallet topped up')
          return result
        })
      }
      topUpError={failure(topUp.error, 'top up the wallet')}
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

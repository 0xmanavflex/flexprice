import { useEffect, useRef, useState } from 'react'
import { AccountState, CheckoutStatus, checkoutOutcome } from '@fp/domain'
import {
  useRefreshSelfBilling,
  useCancelSelfBillingCheckout,
  useSelfBillingCheckout,
  useSelfBillingSummary,
} from '@fp/query'
import { CheckoutReturnView, type NextStep } from '@fp/ui/pages'
import {
  forgetCheckout,
  recalledCheckout,
  recalledCheckoutEmail,
  useOrganization,
} from './organization'

/**
 * The page Stripe returns to: `/billing/checkout/success` or
 * `/billing/checkout/failure`. It polls the checkout saved before leaving until
 * it settles; a checkout left before paying is cancelled so the next Upgrade
 * starts a fresh one. Settling refetches the account, so the pill and the lock
 * follow.
 */
export function CheckoutReturnPage({
  returnedBy,
  onBilling,
  onUpgrade,
  onOpenProduction,
  onNextStep,
}: {
  returnedBy: 'success' | 'failure'
  onBilling: () => void
  onUpgrade: () => void
  onOpenProduction: () => void
  onNextStep: (step: NextStep) => void
}) {
  const [checkoutId] = useState(recalledCheckout)
  const checkout = useSelfBillingCheckout(checkoutId)
  const summary = useSelfBillingSummary()
  const organization = useOrganization()
  const cancel = useCancelSelfBillingCheckout()
  const [started, setStarted] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  // Without the saved id (another tab, cleared storage) the account itself says
  // whether the payment went through: the summary reconciles on read.
  const live = summary.data?.state === AccountState.Active
  const settled =
    checkout.data ?? (live ? { status: CheckoutStatus.Completed, terminal: true } : null)
  // A clock for "Still confirming", ticking only while confirming.
  const outcome = checkoutOutcome(settled, returnedBy, now - started)
  useEffect(() => {
    if (outcome !== 'processing') return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [outcome])

  // Settled: the id is spent. Left before paying: drop the session too.
  const cancelled = useRef(false)
  useEffect(() => {
    if (outcome === 'success' || outcome === 'failed') forgetCheckout()
    if (outcome === 'canceled' && checkoutId && !cancelled.current && !checkout.data?.terminal) {
      cancelled.current = true
      cancel.mutate(checkoutId, { onSettled: forgetCheckout })
    }
    // `cancel.mutate` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, checkoutId, checkout.data?.terminal])

  // Paid, but the account can read trialing for a moment while the trial
  // converts. Keep reading it (every 3s, for a minute) until it is active, so
  // the pill and the lock go as soon as the API agrees.
  const refresh = useRefreshSelfBilling()
  useEffect(() => {
    if (outcome !== 'success' || live) return
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      void refresh()
      if (tries >= 20) window.clearInterval(timer)
    }, 3_000)
    return () => window.clearInterval(timer)
    // `refresh` is a fresh closure each render; the interval needs only the outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, live])

  const paid = summary.data?.invoices.find((invoice) => invoice.status === 'paid') ?? null

  return (
    <CheckoutReturnView
      outcome={outcome}
      billingEmail={recalledCheckoutEmail() || organization.userEmail}
      paidInvoice={paid ? { number: paid.number, pdfUrl: paid.pdfUrl } : null}
      nextInvoiceOn={summary.data?.period?.end ?? null}
      onBilling={onBilling}
      onUpgrade={onUpgrade}
      onCheckAgain={() => {
        const at = Date.now()
        setStarted(at)
        setNow(at)
        void checkout.refetch()
        void summary.refetch()
      }}
      onOpenProduction={onOpenProduction}
      onNextStep={onNextStep}
    />
  )
}

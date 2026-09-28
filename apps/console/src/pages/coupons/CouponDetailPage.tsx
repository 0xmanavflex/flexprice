import { useState } from 'react'
import {
  COUPON_CADENCE_LABEL,
  COUPON_TYPE_LABEL,
  type Coupon,
  type CouponAssociation,
  CouponCadence,
  CouponStatus,
  CouponType,
  type EditCoupon,
  formatMoney,
} from '@fp/domain'
import {
  ApiError,
  useArchiveCoupon,
  useCoupon,
  useCouponAssociations,
  useUpdateCoupon,
} from '@fp/query'
import { CatalogStatusBadge, CouponEditorSheet, Money } from '@fp/ui/flexprice'
import {
  AppFailure,
  ConfirmDialog,
  DetailList,
  EmptyState,
  LoadingRows,
  PageBody,
  PageHeader,
  Section,
  type DetailItem,
} from '@fp/ui/compositions'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { ChevronLeftIcon, LinkIcon } from 'lucide-react'

export interface CouponDetailPageProps {
  couponId: string
  onBack: () => void
}

/**
 * A coupon's detail page: read-only, with a rename drawer and archive.
 *
 * Replaces V1's `CouponDetails` — the same details card (type, code, discount,
 * cadence, redemptions, window, timestamps, metadata) — and adds what V1 could
 * not answer: **Where used**, the subscriptions this coupon is applied to, read
 * from `/coupons/associations`. The discount is immutable, so the header's Edit
 * opens a rename drawer; Archive soft-deletes.
 */
export function CouponDetailPage({ couponId, onBack }: CouponDetailPageProps) {
  const coupon = useCoupon(couponId)
  const update = useUpdateCoupon()
  const archive = useArchiveCoupon()

  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  if (coupon.isPending) {
    return (
      <PageBody>
        <LoadingRows />
      </PageBody>
    )
  }

  if (coupon.error || !coupon.data) {
    const failure = toFailure(coupon.error)
    return (
      <AppFailure
        title="This coupon could not be loaded"
        detail={failure.message}
        {...(failure.canRetry ? { onRetry: () => void coupon.refetch() } : {})}
      />
    )
  }

  const record = coupon.data
  const isArchived = record.status === CouponStatus.Archived

  const closeEdit = () => {
    setEditing(false)
    update.reset()
  }

  const submitEdit = (draft: EditCoupon) => {
    update.mutate({ id: record.id, draft }, { onSuccess: closeEdit })
  }

  const confirmArchive = () => {
    archive.mutate(record.id, { onSuccess: () => setArchiving(false) })
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
            Coupons
          </button>
        }
        title={record.name}
        description={`${discountText(record)} · ${cadenceText(record)}`}
        action={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {isArchived ? null : (
              <Button variant="destructive" onClick={() => setArchiving(true)}>
                Archive
              </Button>
            )}
          </>
        }
      />

      <PageBody width="narrow">
        <Section title="Details">
          <DetailList items={detailItems(record)} />
        </Section>

        <CouponUsage couponId={record.id} />
      </PageBody>

      <CouponEditorSheet
        open={editing}
        onOpenChange={(open) => {
          if (!open) closeEdit()
        }}
        defaultValue={{ name: record.name }}
        summary={{ code: record.code, discount: discountText(record) }}
        onSubmit={submitEdit}
        isSubmitting={update.isPending}
        submitError={toSubmitError(update.error)}
      />

      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(false)
            archive.reset()
          }
        }}
        title={`Archive ${record.name}?`}
        description="The coupon stops being offered, but its redemption history is kept. You can still view it afterwards."
        confirmLabel="Archive coupon"
        onConfirm={confirmArchive}
        isPending={archive.isPending}
        destructive
        error={toSubmitError(archive.error)}
      />
    </>
  )
}

/** The discount, drawn from whichever field the type populates. */
function discountText(coupon: Coupon): string {
  if (coupon.type === CouponType.Percentage) return `${coupon.percentageOff ?? '0'}% off`
  return coupon.amountOff ? `${formatMoney(coupon.amountOff)} off` : '—'
}

/** "One-time", "Forever", or "Repeating · 3 periods". */
function cadenceText(coupon: Coupon): string {
  if (coupon.cadence === CouponCadence.Repeated && coupon.durationInPeriods) {
    const unit = coupon.durationInPeriods === 1 ? 'period' : 'periods'
    return `${COUPON_CADENCE_LABEL[coupon.cadence]} · ${coupon.durationInPeriods} ${unit}`
  }
  return COUPON_CADENCE_LABEL[coupon.cadence]
}

function formatDate(value: Date | null): string {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
}

function detailItems(coupon: Coupon): DetailItem[] {
  const discount =
    coupon.type === CouponType.Percentage ? (
      <span className="tabular-nums">{coupon.percentageOff ?? '0'}%</span>
    ) : coupon.amountOff ? (
      <Money value={coupon.amountOff} />
    ) : (
      '—'
    )

  const items: DetailItem[] = [
    { label: 'Type', value: COUPON_TYPE_LABEL[coupon.type] },
    {
      label: 'Coupon code',
      value: coupon.code ? (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{coupon.code}</code>
      ) : (
        '—'
      ),
    },
    { label: 'Discount', value: discount },
    { label: 'Cadence', value: cadenceText(coupon) },
    { label: 'Status', value: <CatalogStatusBadge status={coupon.status} /> },
    {
      label: 'Redemptions',
      value: (
        <span className="tabular-nums">
          {coupon.totalRedemptions} / {coupon.maxRedemptions ?? '∞'}
        </span>
      ),
    },
    {
      label: 'Duration',
      value: coupon.durationInPeriods !== null ? String(coupon.durationInPeriods) : 'Not set',
    },
    { label: 'Redeem after', value: formatDate(coupon.redeemAfter) },
    { label: 'Redeem before', value: formatDate(coupon.redeemBefore) },
    { label: 'Created', value: formatDate(coupon.createdAt) },
    { label: 'Updated', value: formatDate(coupon.updatedAt) },
  ]

  if (coupon.metadata) {
    items.push({
      label: 'Metadata',
      full: true,
      value: (
        <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(coupon.metadata, null, 2)}
        </pre>
      ),
    })
  }

  return items
}

/**
 * Where used — the subscriptions this coupon is applied to.
 *
 * The V2 improvement over V1's detail page: the association endpoint answers a
 * question V1 could not. An empty result is a real answer ("not applied to
 * anything yet"), so it gets a tasteful empty state rather than a hidden
 * section.
 */
function CouponUsage({ couponId }: { couponId: string }) {
  const associations = useCouponAssociations(couponId)
  const rows = associations.data?.associations ?? []

  return (
    <Section
      title="Where used"
      description="Subscriptions this coupon is applied to."
    >
      {associations.isPending ? (
        <LoadingRows />
      ) : associations.error ? (
        <p className="text-sm text-muted-foreground">Could not load where this coupon is used.</p>
      ) : rows.length === 0 ? (
        <EmptyState
          size="inline"
          icon={<LinkIcon aria-hidden />}
          title="Not applied anywhere yet"
          description="When this coupon is applied to a subscription, that subscription appears here."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscription</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Until</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((association: CouponAssociation) => (
              <TableRow key={association.id}>
                <TableCell className="font-mono text-xs">{association.subscriptionId}</TableCell>
                <TableCell>
                  <CatalogStatusBadge status={association.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(association.startDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(association.endDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}

function toFailure(error: unknown): { message: string; canRetry: boolean } {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'not_found':
        return { message: 'This coupon does not exist, or was deleted.', canRetry: false }
      case 'forbidden':
        return { message: 'You do not have access to this coupon.', canRetry: false }
      case 'unauthorized':
        return { message: 'Your session has expired. Sign in again.', canRetry: false }
      case 'network':
        return { message: 'Could not reach Flexprice.', canRetry: true }
      case 'server':
        return { message: 'Flexprice had a problem loading this coupon.', canRetry: true }
      default:
        return { message: error.message, canRetry: false }
    }
  }
  return { message: 'Something went wrong loading this coupon.', canRetry: true }
}

function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change coupons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the coupon. Try again.'
    }
  }
  return 'Could not save the coupon. Try again.'
}

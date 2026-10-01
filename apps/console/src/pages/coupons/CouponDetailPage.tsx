import { useState } from 'react'
import {
  COUPON_CADENCE_LABEL,
  COUPON_TYPE_LABEL,
  type Coupon,
  CouponCadence,
  CouponStatus,
  CouponType,
} from '@fp/domain'
import { ApiError, useArchiveCoupon, useCoupon, useUpdateCoupon } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, CouponRedemptionsView, Money } from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  type DetailItem,
  DetailList,
  Properties,
  EditableCard,
  LoadingRows,
  Section,
} from '@fp/ui/compositions'
import { TicketPercentIcon } from 'lucide-react'

type CouponTab = 'overview' | 'redemptions' | 'information'

export interface CouponDetailPageProps {
  couponId: string
  onBack: () => void
  /** Open with the details already in edit mode. */
  startEditing?: boolean
  /** Open the full edit form. */
  onEdit?: () => void
}

/**
 * A coupon's detail page.
 *
 * Built on the shared `DetailShell`, so it opens like every other detail page:
 * a breadcrumb, a large title with its status and type chips, the redemption
 * code as identifier, and a **metric rail** that leads with the numbers a coupon
 * is actually about — its discount and how many times it has been redeemed,
 * rather than burying them in a spec sheet.
 *
 * "Where used" (the subscriptions this coupon is applied to, from
 * `/coupons/associations`) is promoted above the attribute list: it is the
 * question V1 could not answer and the most useful thing on the page. The
 * header's Edit turns the details into inputs in place (only the name can change;
 * the discount is immutable, so it stays read-only); Archive
 * soft-deletes behind a confirmation.
 */
export function CouponDetailPage({
  couponId,
  onBack,
  startEditing = false,
  onEdit,
}: CouponDetailPageProps) {
  const coupon = useCoupon(couponId)
  const update = useUpdateCoupon()
  const archive = useArchiveCoupon()

  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState<CouponTab>(startEditing ? 'information' : 'overview')

  if (coupon.isPending) {
    return (
      <div className="p-6">
        <LoadingRows />
      </div>
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

  const confirmArchive = () => {
    archive.mutate(record.id, { onSuccess: () => setArchiving(false) })
  }

  return (
    <CatalogDetailFrame
      listLabel="Coupons"
      onBack={onBack}
      icon={<TicketPercentIcon />}
      title={record.name}
      subtitle={`${COUPON_TYPE_LABEL[record.type]} · ${cadenceText(record)}`}
      id={record.code || record.id}
      menuLabel="Coupon actions"
      menu={
        isArchived
          ? []
          : [
              ...(onEdit ? [{ id: 'edit', label: 'Edit coupon', onSelect: onEdit }] : []),
              {
                id: 'archive',
                label: 'Archive',
                destructive: true,
                onSelect: () => setArchiving(true),
              },
            ]
      }
      tab={tab}
      onTabChange={(next) => setTab(next as CouponTab)}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: <OverviewTab coupon={record} />,
        },
        {
          value: 'redemptions',
          label: 'Redemptions',
          count: record.totalRedemptions,
          content: <CouponRedemptionsView />,
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <EditableCard
                title="General"
                locked={isArchived}
                fields={[
                  { key: 'name', label: 'Name', value: record.name, required: true },
                  {
                    key: 'id',
                    label: 'Coupon ID',
                    value: record.id,
                    display: <span className="font-mono text-xs">{record.id}</span>,
                    readOnly: true,
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    value: record.status,
                    display: <CatalogStatusBadge status={record.status} />,
                    readOnly: true,
                  },
                  {
                    key: 'created',
                    label: 'Created',
                    value: formatDate(record.createdAt),
                    readOnly: true,
                  },
                  {
                    key: 'updated',
                    label: 'Updated',
                    value: formatDate(record.updatedAt),
                    readOnly: true,
                  },
                ]}
                onSave={(changes) =>
                  update.mutateAsync({
                    id: record.id,
                    draft: { name: changes.name ?? record.name },
                  })
                }
              />
              <Section title="Metadata">
                {record.metadata ? (
                  <DetailList columns={1} items={metadataItems(record.metadata)} />
                ) : (
                  <p className="text-muted-foreground text-sm">This coupon carries no metadata.</p>
                )}
              </Section>
            </div>
          ),
        },
      ]}
    >
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
    </CatalogDetailFrame>
  )
}

/** Overview: the terms a coupon carries, and how much of its redemption ceiling is used. */
function OverviewTab({ coupon }: { coupon: Coupon }) {
  const max = coupon.maxRedemptions
  const pct = max && max > 0 ? Math.min(100, (coupon.totalRedemptions / max) * 100) : 0
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Section title="Terms">
        <Properties
          columns={3}
          items={[
            {
              label: 'Discount',
              value:
                coupon.type === CouponType.Percentage ? (
                  `${coupon.percentageOff ?? '0'}% of invoice`
                ) : coupon.amountOff ? (
                  <Money value={coupon.amountOff} />
                ) : (
                  '—'
                ),
            },
            { label: 'Applies', value: cadenceText(coupon) },
            {
              label: 'Code',
              value: <span className="font-mono text-xs">{coupon.code || '—'}</span>,
            },
            { label: 'Redeem after', value: formatDay(coupon.redeemAfter) },
            { label: 'Redeem before', value: formatDay(coupon.redeemBefore) },
            { label: 'Applies to', value: 'All plans' },
          ]}
        />
      </Section>
      <Section title="Redemptions">
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-medium tabular-nums">
            {coupon.totalRedemptions.toLocaleString()}
            <span className="text-muted-foreground text-sm font-normal">
              {max !== null ? ` / ${max.toLocaleString()}` : ' redeemed'}
            </span>
          </p>
          {max !== null ? (
            <>
              <div
                role="progressbar"
                aria-label="Redemptions used"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="bg-muted h-2 overflow-hidden rounded-full"
              >
                <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                {Math.max(0, max - coupon.totalRedemptions).toLocaleString()} left
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">No redemption limit</p>
          )}
        </div>
      </Section>
    </div>
  )
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
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    value,
  )
}

function formatDay(value: Date | null): string {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

/** Metadata as readable rows, not a raw JSON dump. */
function metadataItems(metadata: Record<string, string>): DetailItem[] {
  return Object.entries(metadata).map(([key, value]) => ({
    label: key,
    value: <span className="break-words">{value}</span>,
  }))
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

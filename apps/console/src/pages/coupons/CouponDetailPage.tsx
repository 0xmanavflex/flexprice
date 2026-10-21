import { useState } from 'react'
import {
  COUPON_CADENCE_LABEL,
  type Coupon,
  CouponCadence,
  CouponStatus,
  CouponType,
  formatMoney,
} from '@fp/domain'
import {
  ApiError,
  useArchiveCoupon,
  useCoupon,
  useCouponRedemptions,
  useUpdateCoupon,
  serverReason,
} from '@fp/query'
import {
  CatalogDetailFrame,
  CatalogStatusBadge,
  CouponRedemptionMeter,
  CouponRedemptionsView,
  Money,
  Pill,
} from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, MetadataCard, Properties, Section } from '@fp/ui/compositions'
import { ArchiveIcon, PencilIcon, TicketPercentIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'

type CouponTab = 'overview' | 'redemptions' | 'information'

export interface CouponDetailPageProps {
  couponId: string
  onBack: () => void
  /** Open with the details already in edit mode. */
  startEditing?: boolean
  /** Open a contract the coupon is applied to. */
  onOpenContract?: (contractId: string) => void
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
  onOpenContract,
}: CouponDetailPageProps) {
  const coupon = useCoupon(couponId)
  const redemptions = useCouponRedemptions(couponId)
  const update = useUpdateCoupon()
  const archive = useArchiveCoupon()

  const [archiving, setArchiving] = useState(false)
  const [tab, setTab] = useState<CouponTab>(startEditing ? 'information' : 'overview')

  if (!coupon.data) {
    return detailGate(coupon, {
      noun: 'this coupon',
      listName: 'coupons',
      onBack,
      recordPath: `/coupons/${encodeURIComponent(couponId)}`,
    })
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
      badges={
        <>
          <CatalogStatusBadge status={record.status} />
          <Pill>{discountText(record)}</Pill>
          <Pill>{cadenceText(record)}</Pill>
        </>
      }
      id={record.code || record.id}
      menuLabel="Coupon actions"
      menu={[
        {
          id: 'edit-details',
          label: 'Edit details',
          icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
          onSelect: () => setTab('information'),
        },
        ...(isArchived
          ? []
          : [
              {
                id: 'archive',
                label: 'Archive',
                icon: <ArchiveIcon aria-hidden />,
                destructive: true,
                onSelect: () => setArchiving(true),
              },
            ]),
      ]}
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
          content: (
            <CouponRedemptionsView
              {...(redemptions.data
                ? {
                    redemptions: redemptions.data.map((row) => ({
                      id: row.id,
                      contractId: row.contractId,
                      customer: row.customer,
                      plan: row.plan,
                      appliedAt: formatDay(row.startDate),
                      ...(row.endDate ? { endsAt: formatDay(row.endDate) } : {}),
                      status: row.status,
                    })),
                  }
                : {})}
              {...(onOpenContract ? { onOpenContract } : {})}
            />
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <div className="grid gap-5 xl:grid-cols-3">
              <EditableCard
                className="xl:col-span-2"
                title="Coupon details"
                locked={isArchived}
                fields={[
                  { key: 'name', label: 'Name', value: record.name, required: true },
                  {
                    key: 'id',
                    label: 'Coupon ID',
                    value: record.id,
                    display: <span className="font-mono text-[13px]">{record.id}</span>,
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
              <MetadataCard
                metadata={record.metadata ?? {}}
                {...(isArchived
                  ? {}
                  : {
                      onSave: (metadata: Record<string, string>) =>
                        update.mutateAsync({
                          id: record.id,
                          draft: { name: record.name, metadata },
                        }),
                    })}
              />
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
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <Section className="xl:col-span-2" title="Terms">
        <Properties
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
              value: <span className="font-mono text-[13px]">{coupon.code || '—'}</span>,
            },
            { label: 'Redeem after', value: formatDay(coupon.redeemAfter) },
            { label: 'Redeem before', value: formatDay(coupon.redeemBefore) },
            { label: 'Applies to', value: 'All plans' },
          ]}
        />
      </Section>
      <Section title="Redemptions">
        <CouponRedemptionMeter redeemed={coupon.totalRedemptions} max={coupon.maxRedemptions} />
      </Section>
    </div>
  )
}

/** "30% off" or "$50.00 off". */
function discountText(coupon: Coupon): string {
  if (coupon.type === CouponType.Percentage) return `${coupon.percentageOff ?? '0'}% off`
  return coupon.amountOff ? `${formatMoney(coupon.amountOff)} off` : 'Discount'
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

function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return serverReason(error) ?? 'You do not have permission to change coupons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return serverReason(error) ?? 'Could not save the coupon. Try again.'
    }
  }
  return 'Could not save the coupon. Try again.'
}

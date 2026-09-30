import { useState } from 'react'
import {
  COUPON_CADENCE_LABEL,
  COUPON_TYPE_LABEL,
  type Coupon,
  type CouponAssociation,
  CouponCadence,
  CouponStatus,
  CouponType,
} from '@fp/domain'
import {
  ApiError,
  useArchiveCoupon,
  useCoupon,
  useCouponAssociations,
  useUpdateCoupon,
} from '@fp/query'
import { CatalogStatusBadge, Money } from '@fp/ui/pages'
import {
  AppFailure,
  ConfirmDialog,
  type DetailItem,
  DetailList,
  type DetailMetric,
  DetailShell,
  EditableFields,
  EmptyState,
  LoadingRows,
  Section,
} from '@fp/ui/compositions'
import {
  Badge,
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
  /** Open with the details already in edit mode. */
  startEditing?: boolean
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
}: CouponDetailPageProps) {
  const coupon = useCoupon(couponId)
  const update = useUpdateCoupon()
  const archive = useArchiveCoupon()

  const [archiving, setArchiving] = useState(false)
  const [editing, setEditing] = useState(startEditing)

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
    <>
      <DetailShell
        breadcrumb={
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
            Coupons
          </button>
        }
        title={record.name}
        badges={
          <>
            <CatalogStatusBadge status={record.status} />
            <Badge
              variant="outline"
              size="sm"
              radius="full"
              className="border-border/60 text-foreground bg-transparent px-2 font-normal dark:bg-transparent"
            >
              {COUPON_TYPE_LABEL[record.type]}
            </Badge>
          </>
        }
        identifier={record.code || record.id}
        actions={
          <>
            <Button
              variant="outline"
              disabled={editing || isArchived}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            {isArchived ? null : (
              <Button variant="destructive" onClick={() => setArchiving(true)}>
                Archive
              </Button>
            )}
          </>
        }
        metrics={couponMetrics(record)}
      >
        {/* The most useful content first: where this coupon is in force. */}
        <CouponUsage couponId={record.id} />

        <Section
          title="Details"
          description="Use the pencil on the name, or Edit above. The discount is fixed once created."
        >
          <EditableFields
            editing={editing}
            onEditingChange={setEditing}
            className="mb-4"
            fields={[
              {
                key: 'name',
                label: 'Name',
                value: record.name,
                required: true,
                readOnly: isArchived,
              },
            ]}
            onSave={(changes) =>
              update.mutateAsync({ id: record.id, draft: { name: changes.name ?? record.name } })
            }
          />
          <DetailList items={detailItems(record)} />
        </Section>

        {record.metadata ? (
          <Section title="Metadata" description="Custom key-value pairs stored on this coupon.">
            <DetailList items={metadataItems(record.metadata)} />
          </Section>
        ) : null}
      </DetailShell>

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

/**
 * The rail: the numbers a coupon exists to carry.
 *
 * Discount is the headline (the % or the `Money` amount); redemptions leads with
 * the count used against its ceiling; and where a ceiling is set, the rate that
 * ceiling has reached. Status and type are chips in the header, not tiles —
 * a rail that restated them would add nothing.
 */
function couponMetrics(coupon: Coupon): DetailMetric[] {
  const metrics: DetailMetric[] = [
    {
      label: 'Discount',
      value:
        coupon.type === CouponType.Percentage ? (
          <span className="tabular-nums">{coupon.percentageOff ?? '0'}%</span>
        ) : coupon.amountOff ? (
          <Money value={coupon.amountOff} />
        ) : (
          '—'
        ),
      hint: cadenceText(coupon),
    },
    {
      label: 'Redemptions',
      value: <span className="tabular-nums">{coupon.totalRedemptions.toLocaleString()}</span>,
      hint:
        coupon.maxRedemptions !== null
          ? `of ${coupon.maxRedemptions.toLocaleString()}`
          : 'no limit',
    },
  ]

  // A rate only means something against a ceiling.
  if (coupon.maxRedemptions !== null && coupon.maxRedemptions > 0) {
    const rate = Math.round((coupon.totalRedemptions / coupon.maxRedemptions) * 100)
    metrics.push({
      label: 'Redemption rate',
      value: `${rate}%`,
      hint: 'of limit used',
    })
  }

  return metrics
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

/**
 * The attribute list — the record's reference, minus what the rail and header
 * already lead with (discount, redemptions, status, code).
 */
function detailItems(coupon: Coupon): DetailItem[] {
  return [
    { label: 'Type', value: COUPON_TYPE_LABEL[coupon.type] },
    { label: 'Cadence', value: cadenceText(coupon) },
    { label: 'Redeem after', value: formatDate(coupon.redeemAfter) },
    { label: 'Redeem before', value: formatDate(coupon.redeemBefore) },
    { label: 'Created', value: formatDate(coupon.createdAt) },
    { label: 'Updated', value: formatDate(coupon.updatedAt) },
  ]
}

/** Metadata as readable rows, not a raw JSON dump. */
function metadataItems(metadata: Record<string, string>): DetailItem[] {
  return Object.entries(metadata).map(([key, value]) => ({
    label: key,
    value: <span className="break-words">{value}</span>,
  }))
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
    <Section title="Where used" description="Subscriptions this coupon is applied to.">
      {associations.isPending ? (
        <LoadingRows />
      ) : associations.error ? (
        <p className="text-muted-foreground text-sm">Could not load where this coupon is used.</p>
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

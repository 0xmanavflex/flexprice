import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  type CloneFeature,
  FeatureStatus,
  FeatureType,
  PriceEntityType,
  emptyAlertSettingConfig,
} from '@fp/domain'
import {
  useCloneFeature,
  useDeleteFeature,
  useFeature,
  useFeatureCharges,
  useFeatureEntitlements,
  useGroup,
  useUpdateFeature,
  useFlexpriceServerURL,
} from '@fp/query'
import {
  EntityAlertDialog,
  FeatureCloneDialog,
  FeatureDetailView,
  type FeatureTab,
} from '@fp/ui/pages'
import { ConfirmDialog } from '@fp/ui/compositions'
import { toSubmitError } from './featureMessages'
import { detailGate } from '../shared/detailGate'
import { AddFeatureChargeDialog } from './AddFeatureChargeDialog'
import { subTab } from '../shared/subTab'

export interface FeatureDetailPageProps {
  onEdit: (featureId: string) => void
  featureId: string
  onNavigateToList: () => void
}

/**
 * One feature, in full: data and mutations here, the view in `@fp/ui`.
 *
 * Name and description save for real (per value, or together from the header
 * Edit, which opens Information). "Edit configuration" opens the stepped form.
 * Charges and entitlements are the prices and grants that reference this
 * feature; both are added on a plan, so their CTAs go to the plan flows. The
 * overview says usage is not available yet: there is no per-feature series.
 */
export function FeatureDetailPage({ featureId, onNavigateToList, onEdit }: FeatureDetailPageProps) {
  const feature = useFeature(featureId)
  const apiBaseUrl = useFlexpriceServerURL()
  // The label the feature is filed under, by name; no request when it has none.
  const group = useGroup(feature.data?.groupId ?? '')
  const navigate = useNavigate()
  const charges = useFeatureCharges(
    feature.data?.type === FeatureType.Metered ? feature.data.meterId : null,
  )
  const entitlements = useFeatureEntitlements(featureId)
  const [tab, setTab] = useState<FeatureTab>('overview')
  const update = useUpdateFeature()
  const clone = useCloneFeature()
  const remove = useDeleteFeature()
  const [cloning, setCloning] = useState(false)
  const [addingCharge, setAddingCharge] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [alerting, setAlerting] = useState(false)

  if (!feature.data) {
    return detailGate(feature, {
      noun: 'this feature',
      listName: 'features',
      onBack: onNavigateToList,
      recordPath: `/features/${encodeURIComponent(featureId)}`,
    })
  }

  const data = feature.data

  const closeClone = () => {
    setCloning(false)
    clone.reset()
  }
  const closeDelete = () => {
    setDeleting(false)
    remove.reset()
  }
  const chargesState = subTab(charges, 'charges')
  const entitlementsState = subTab(entitlements, 'entitlements')
  const submitClone = (draft: CloneFeature) =>
    clone.mutate({ id: data.id, draft }, { onSuccess: closeClone })

  return (
    <>
      <FeatureDetailView
        feature={data}
        apiBaseUrl={apiBaseUrl}
        {...(group.data?.name ? { groupName: group.data.name } : {})}
        tab={tab}
        onTabChange={setTab}
        onBack={onNavigateToList}
        onEditConfiguration={() => onEdit(featureId)}
        onDuplicate={() => setCloning(true)}
        onAlertSettings={() => setAlerting(true)}
        onDelete={() => setDeleting(true)}
        charges={charges.data ?? []}
        chargesLoading={charges.isLoading}
        chargesError={chargesState.error ?? null}
        {...(chargesState.errorKind ? { chargesErrorKind: chargesState.errorKind } : {})}
        {...(chargesState.onRetry ? { onRetryCharges: chargesState.onRetry } : {})}
        entitlements={entitlements.data ?? []}
        entitlementsLoading={entitlements.isLoading}
        entitlementsError={entitlementsState.error ?? null}
        {...(entitlementsState.errorKind
          ? { entitlementsErrorKind: entitlementsState.errorKind }
          : {})}
        {...(entitlementsState.onRetry ? { onRetryEntitlements: entitlementsState.onRetry } : {})}
        onOpenChargeParent={(charge) => {
          if (charge.entityType === PriceEntityType.Addon) {
            void navigate({ to: '/addons/$addonId', params: { addonId: charge.entityId } })
          } else if (charge.entityType === PriceEntityType.CostSheet) {
            void navigate({
              to: '/cost-sheets/$costSheetId',
              params: { costSheetId: charge.entityId },
            })
          } else if (charge.entityType === PriceEntityType.Plan) {
            void navigate({
              to: '/plans/$planId',
              params: { planId: charge.entityId },
              search: {} as never,
            })
          }
        }}
        // Only usage is charged per feature: a metered feature can be billed on a plan.
        // Not on an archived feature: new prices belong on live meters.
        {...(data.type === FeatureType.Metered &&
        data.meterId &&
        data.status !== FeatureStatus.Archived
          ? { onAddCharge: () => setAddingCharge(true) }
          : {})}
        onSaveMetadata={(metadata) =>
          update.mutateAsync({ id: data.id, draft: { name: data.name, metadata } })
        }
      />
      {/* Mounted only while open: its plan and catalogue reads wait for the click. */}
      {addingCharge ? (
        <AddFeatureChargeDialog feature={data} open onOpenChange={setAddingCharge} />
      ) : null}
      <FeatureCloneDialog
        open={cloning}
        onOpenChange={(open) => {
          if (!open) closeClone()
        }}
        source={data}
        onSubmit={submitClone}
        isSubmitting={clone.isPending}
        submitError={toSubmitError(clone.error, 'clone')}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!open) closeDelete()
        }}
        title="Archive feature"
        description={`Archive ${data.name}? Plans and entitlements that use it lose it.`}
        confirmLabel="Archive feature"
        destructive
        isPending={remove.isPending}
        error={toSubmitError(remove.error, 'delete')}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              closeDelete()
              onNavigateToList()
            },
          })
        }
      />
      {/*
        V1 keeps a feature's usage alerts on the feature itself (`alert_settings`),
        so they are saved through the feature update, with its current name.
      */}
      <EntityAlertDialog
        open={alerting}
        onOpenChange={setAlerting}
        noun="Feature"
        isLoading={false}
        loadFailed={false}
        isNew={!data.alertSettings}
        initial={data.alertSettings ?? emptyAlertSettingConfig()}
        onSave={(alertSettings) =>
          update.mutateAsync({ id: data.id, draft: { name: data.name, alertSettings } })
        }
      />
    </>
  )
}

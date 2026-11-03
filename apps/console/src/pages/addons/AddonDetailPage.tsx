import { useState } from 'react'
import { type Addon, PriceEntityType } from '@fp/domain'
import { useAddon, useDeleteAddon, usePrices, useUpdateAddon, useSyncAddonPrices } from '@fp/query'
import { AddonSubscriptionsView, CatalogDetailFrame, CatalogStatusBadge, Pill } from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, MetadataCard } from '@fp/ui/compositions'
import { ArchiveIcon, PencilIcon, PuzzleIcon, RefreshCwIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'
import {
  CatalogChargesSection,
  CatalogCreditGrantsSection,
  CatalogEntitlementsSection,
} from '../shared/CatalogSections'
import { useContractSync } from '../shared/useContractSync'

export interface AddonDetailPageProps {
  addonId: string
  /** Open with the details already in edit mode (the list row's Edit). */
  startEditing?: boolean
  onNavigateToList: () => void
}

/**
 * Two tabs, the same as a plan's.
 *
 * Charges, entitlements and credit grants were a tab each, holding one table
 * apiece, so seeing what an add-on contains took three clicks. An add-on
 * carries the same three things a plan does, so it is laid out the same way:
 * all of them on Overview, one after another, and the record on Information.
 */
type AddonTab = 'overview' | 'information'

/**
 * One add-on, in full.
 *
 * The shared detail shell: a large title with its status badge and lookup key
 * and a ⋯ menu of record actions, then two tabs. Overview stacks the prices it
 * carries, the entitlements it grants, the credit grants it hands subscribers
 * and the contracts using it; Information holds the record itself. The three
 * catalogue sections are the plan page's own (`CatalogSections`), keyed to the
 * add-on, so the two cannot drift apart.
 *
 * Name and description edit in place on the Information tab (`EditableCard`):
 * the header's Edit details switches to it. Adding or editing a charge,
 * entitlement or credit grant opens its form in a dialog, and every
 * destructive action passes through a `ConfirmDialog` first.
 */
export function AddonDetailPage({
  addonId,
  startEditing = false,
  onNavigateToList,
}: AddonDetailPageProps) {
  const addon = useAddon(addonId)
  const update = useUpdateAddon()
  const sync = useSyncAddonPrices()
  const syncing = useContractSync('add-on', addonId)
  const remove = useDeleteAddon()
  // Fetched here too (deduped by react-query) so the header can carry a real count.
  const prices = usePrices(PriceEntityType.Addon, addonId)

  const [tab, setTab] = useState<AddonTab>(startEditing ? 'information' : 'overview')
  const [archiving, setArchiving] = useState(false)

  if (!addon.data) {
    return detailGate(addon, {
      noun: 'this add-on',
      listName: 'add-ons',
      onBack: onNavigateToList,
      recordPath: `/addons/${encodeURIComponent(addonId)}`,
    })
  }

  const data = addon.data
  const chargeCount = (prices.data ?? []).length
  const badges = (
    <>
      <CatalogStatusBadge status={data.status} />
      <Pill>
        {chargeCount} {chargeCount === 1 ? 'charge' : 'charges'}
      </Pill>
    </>
  )

  return (
    <CatalogDetailFrame
      listLabel="Add-ons"
      onBack={onNavigateToList}
      icon={<PuzzleIcon />}
      title={data.name}
      badges={badges}
      id={data.id}
      menuLabel="Add-on actions"
      menu={[
        {
          id: 'edit-details',
          label: 'Edit details',
          icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
          onSelect: () => setTab('information'),
        },
        {
          // Pushes edited prices to every contract that carries this add-on.
          id: 'sync',
          label: sync.isPending || syncing.watching ? 'Syncing…' : 'Sync to contracts',
          icon: <RefreshCwIcon className="text-muted-foreground" aria-hidden />,
          disabled: sync.isPending || syncing.watching || data.status === 'archived',
          onSelect: () => sync.mutate(addonId, { onSuccess: syncing.started }),
        },
        {
          id: 'archive',
          label: 'Archive',
          icon: <ArchiveIcon aria-hidden />,
          destructive: true,
          disabled: data.status === 'archived',
          onSelect: () => setArchiving(true),
        },
      ]}
      tab={tab}
      onTabChange={(next) => setTab(next as AddonTab)}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: (
            <div className="flex min-w-0 flex-col gap-5">
              <CatalogChargesSection
                entity="addon"
                entityId={addonId}
                readOnly={data.status === 'archived'}
                emptyDescription="This add-on bills nothing until it has a charge."
              />
              <CatalogEntitlementsSection entity="addon" entityId={addonId} />
              <CatalogCreditGrantsSection entity="addon" entityId={addonId} />
              <AddonSubscriptionsView />
            </div>
          ),
        },
        {
          value: 'information',
          label: 'Information',
          content: (
            <InformationTab
              addon={data}
              onSave={(patch) =>
                update
                  .mutateAsync({
                    id: data.id,
                    draft: {
                      name: data.name,
                      lookupKey: data.lookupKey,
                      description: data.description,
                      ...patch,
                    },
                  })
                  .then(() => undefined)
              }
            />
          ),
        },
      ]}
    >
      <ConfirmDialog
        open={archiving}
        onOpenChange={(open) => {
          if (!open) {
            setArchiving(false)
            remove.reset()
          }
        }}
        title="Archive add-on"
        description={`Archive ${data.name}? Subscriptions already using it keep it, but it can no longer be added.`}
        confirmLabel="Archive add-on"
        destructive
        isPending={remove.isPending}
        error={remove.isError ? 'Could not archive the add-on. Try again.' : null}
        onConfirm={() =>
          remove.mutate(data.id, {
            onSuccess: () => {
              setArchiving(false)
              onNavigateToList()
            },
          })
        }
      />
    </CatalogDetailFrame>
  )
}

/**
 * Information: one pencil edits the name and description in place; the rest
 * is read-only. The metadata card beside it edits, adds and removes fields.
 */
function InformationTab({
  addon,
  onSave,
}: {
  addon: Addon
  onSave: (patch: {
    name?: string
    description?: string
    metadata?: Record<string, string>
  }) => Promise<void>
}) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-3">
      <EditableCard
        className="xl:col-span-2"
        title="Add-on details"
        locked={addon.status === 'archived'}
        fields={[
          { key: 'name', label: 'Name', value: addon.name, required: true },
          {
            // Integrations key off it, so the API never lets it change.
            key: 'lookupKey',
            label: 'Lookup key',
            value: addon.lookupKey,
            display: <span className="font-mono text-[13px]">{addon.lookupKey}</span>,
            readOnly: true,
          },
          { key: 'created', label: 'Created', value: formatDate(addon.createdAt), readOnly: true },
          { key: 'updated', label: 'Updated', value: formatDate(addon.updatedAt), readOnly: true },
          {
            key: 'description',
            label: 'Description',
            value: addon.description ?? '',
            multiline: true,
            placeholder: 'No description',
          },
        ]}
        onSave={(changes) => onSave(changes)}
      />
      <MetadataCard
        metadata={addon.metadata ?? {}}
        {...(addon.status === 'archived'
          ? {}
          : { onSave: (metadata: Record<string, string>) => onSave({ metadata }) })}
      />
    </div>
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

import { useState } from 'react'
import { type Addon, type CreateAddon } from '@fp/domain'
import { ApiError, useAddon, useUpdateAddon } from '@fp/query'
import { AddonEditorSheet, CatalogStatusBadge } from '@fp/ui/flexprice'
import {
  AppFailure,
  DetailList,
  DetailHeader,
  DetailStats,
  EmptyState,
  LoadingRows,
  PageBody,
  Section,
} from '@fp/ui/compositions'
import { Button } from '@fp/ui/primitives'
import { ReceiptIcon } from 'lucide-react'

export interface AddonDetailPageProps {
  addonId: string
  onNavigateToList: () => void
}

/**
 * One add-on, in full.
 *
 * A shared header, a Frame stat rail, then the add-on's own details and the
 * prices it carries. The details lead, so the page opens on the record itself
 * rather than an empty tab. Replaces V1's `AddonDetails`, which reaches into
 * `AddonApi` directly and hand-rolls its own cards; this fetches through
 * `useAddon` and composes the shared detail pieces.
 *
 * Prices show an honest empty state: V2 has no linked-price read hook yet, so
 * the section says so rather than inventing rows — the same stand-in the list
 * pages use for surfaces still being built.
 */
export function AddonDetailPage({ addonId, onNavigateToList }: AddonDetailPageProps) {
  const addon = useAddon(addonId)
  const update = useUpdateAddon()
  const [editing, setEditing] = useState(false)

  if (addon.isPending) {
    return (
      <PageBody>
        <div className="pt-4">
          <LoadingRows />
        </div>
      </PageBody>
    )
  }

  if (addon.error) {
    return (
      <PageBody>
        <AppFailure
          title={failureTitle(addon.error)}
          detail="The rest of the console still works. Try again, or go back to the list."
          onRetry={() => void addon.refetch()}
        />
      </PageBody>
    )
  }

  if (!addon.data) {
    return (
      <PageBody>
        <AppFailure
          title="This add-on no longer exists"
          detail="It may have been deleted. Everything else in the catalogue still works."
          onRetry={onNavigateToList}
        />
      </PageBody>
    )
  }

  const data = addon.data

  const closeEditor = () => {
    setEditing(false)
    update.reset()
  }

  const submit = (draft: CreateAddon) => {
    update.mutate({ id: data.id, draft }, { onSuccess: closeEditor })
  }

  return (
    <>
      <DetailHeader
        breadcrumb={
          <button
            type="button"
            onClick={onNavigateToList}
            className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Add-ons
          </button>
        }
        title={data.name}
        badges={<CatalogStatusBadge status={data.status} />}
        identifier={data.lookupKey || data.id}
        {...(data.description ? { description: data.description } : {})}
        actions={<Button onClick={() => setEditing(true)}>Edit</Button>}
      />

      <PageBody>
        <DetailStats stats={detailStats(data)} />

        <Section title="Information" description="Every attribute of this add-on.">
          <DetailList
            items={[
              { label: 'Name', value: data.name },
              { label: 'Lookup key', value: data.lookupKey },
              { label: 'Status', value: <CatalogStatusBadge status={data.status} /> },
              { label: 'Add-on ID', value: <span className="font-mono text-xs">{data.id}</span> },
              { label: 'Description', value: data.description, full: true },
              { label: 'Created', value: formatDate(data.createdAt) },
              { label: 'Updated', value: formatDate(data.updatedAt) },
            ]}
          />
        </Section>

        <Section title="Prices" description="Prices this add-on carries.">
          <EmptyState
            size="inline"
            icon={<ReceiptIcon aria-hidden />}
            title="No prices linked yet"
            description="Prices attached to this add-on will appear here once the linked-price view lands."
          />
        </Section>
      </PageBody>

      <AddonEditorSheet
        open={editing}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
        mode="edit"
        defaultValue={{
          name: data.name,
          lookupKey: data.lookupKey,
          description: data.description,
        }}
        onSubmit={submit}
        isSubmitting={update.isPending}
        submitError={toSubmitError(update.error)}
      />
    </>
  )
}

function detailStats(addon: Addon) {
  return [
    { label: 'Status', value: <CatalogStatusBadge status={addon.status} /> },
    { label: 'Lookup key', value: addon.lookupKey || '—' },
    { label: 'Updated', value: formatDate(addon.updatedAt) },
  ]
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

function failureTitle(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'forbidden':
        return 'You do not have access to this add-on.'
      case 'unauthorized':
        return 'Your session has expired. Sign in again.'
      case 'network':
        return 'Could not reach Flexprice.'
      default:
        return 'This add-on could not be loaded.'
    }
  }
  return 'This add-on could not be loaded.'
}

/** A save failure, as a sentence the editor can show inline. */
function toSubmitError(error: unknown): string | null {
  if (!error) return null

  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'invalid':
        return error.message || 'Check the details and try again.'
      case 'forbidden':
        return 'You do not have permission to change add-ons here.'
      case 'network':
        return 'Could not reach Flexprice. Check your connection and try again.'
      default:
        return 'Could not save the add-on. Try again.'
    }
  }
  return 'Could not save the add-on. Try again.'
}

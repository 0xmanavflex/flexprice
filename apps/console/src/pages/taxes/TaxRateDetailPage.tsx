import { useState } from 'react'
import { TAX_RATE_SCOPE_LABEL, TaxRateStatus, taxRateToEdit } from '@fp/domain'
import { useTaxRate, useUpdateTaxRate } from '@fp/query'
import { CatalogDetailFrame, CatalogStatusBadge, Pill } from '@fp/ui/pages'
import { ConfirmDialog, EditableCard, MetadataCard } from '@fp/ui/compositions'
import { ArchiveIcon, PencilIcon, PercentIcon } from '@fp/ui/icons'
import { detailGate } from '../shared/detailGate'

export interface TaxRateDetailPageProps {
  taxRateId: string
  onNavigateToList: () => void
  onEdit: () => void
}

/**
 * One tax rate, in full: V1's tax rate details page.
 *
 * Its name, code, description, value, scope, status and dates, then its
 * metadata. The name and description change in place; Edit opens the full form,
 * and Archive takes the rate out of use (invoices that carry it keep it); an archived
 * rate stays on this page and Edit can publish it again.
 */
export function TaxRateDetailPage({ taxRateId, onNavigateToList, onEdit }: TaxRateDetailPageProps) {
  const taxRate = useTaxRate(taxRateId)
  const update = useUpdateTaxRate()
  // Archive is a status change, not a delete: the rate stays here, and Edit
  // can publish it again.
  const archive = useUpdateTaxRate()
  const [archiving, setArchiving] = useState(false)

  if (!taxRate.data) {
    return detailGate(taxRate, {
      noun: 'this tax rate',
      listName: 'taxes',
      onBack: onNavigateToList,
      recordPath: `/taxes/rates/${encodeURIComponent(taxRateId)}`,
    })
  }

  const data = taxRate.data
  const archived = data.status === TaxRateStatus.Archived
  const value = data.percentageValue ? `${data.percentageValue}%` : '—'

  return (
    <CatalogDetailFrame
      listLabel="Taxes"
      onBack={onNavigateToList}
      icon={<PercentIcon />}
      title={data.name}
      badges={
        <>
          <CatalogStatusBadge status={data.status} />
          <Pill>{value}</Pill>
        </>
      }
      id={data.id}
      menuLabel="Tax rate actions"
      menu={[
        {
          id: 'edit',
          label: 'Edit tax rate',
          icon: <PencilIcon className="text-muted-foreground" aria-hidden />,
          onSelect: onEdit,
        },
        {
          id: 'archive',
          label: 'Archive',
          icon: <ArchiveIcon aria-hidden />,
          destructive: true,
          disabled: archived,
          onSelect: () => setArchiving(true),
        },
      ]}
      tab="information"
      onTabChange={() => undefined}
      tabs={[
        {
          value: 'information',
          label: 'Information',
          content: (
            <div className="grid items-start gap-5 xl:grid-cols-3">
              <EditableCard
                className="xl:col-span-2"
                title="Tax rate details"
                description="The value and scope are fixed once a rate is created: invoices carry them."
                locked={archived}
                fields={[
                  { key: 'name', label: 'Name', value: data.name, required: true },
                  {
                    key: 'code',
                    label: 'Code',
                    value: data.code,
                    display: data.code ? (
                      <span className="font-mono text-[13px]">{data.code}</span>
                    ) : (
                      '—'
                    ),
                    readOnly: true,
                  },
                  { key: 'description', label: 'Description', value: data.description },
                  { key: 'type', label: 'Type', value: 'Percentage', readOnly: true },
                  { key: 'value', label: 'Value', value, readOnly: true },
                  {
                    key: 'scope',
                    label: 'Scope',
                    value: TAX_RATE_SCOPE_LABEL[data.scope],
                    readOnly: true,
                  },
                  {
                    key: 'id',
                    label: 'Tax rate ID',
                    value: data.id,
                    display: <span className="font-mono text-[13px]">{data.id}</span>,
                    readOnly: true,
                  },
                  {
                    key: 'created',
                    label: 'Created',
                    value: formatDate(data.createdAt),
                    readOnly: true,
                  },
                  {
                    key: 'updated',
                    label: 'Updated',
                    value: formatDate(data.updatedAt),
                    readOnly: true,
                  },
                ]}
                onSave={(changes) =>
                  update.mutateAsync({
                    id: data.id,
                    draft: {
                      ...taxRateToEdit(data),
                      name: changes.name ?? data.name,
                      description: changes.description ?? data.description,
                    },
                  })
                }
              />
              <MetadataCard
                metadata={data.metadata ?? {}}
                {...(archived
                  ? {}
                  : {
                      onSave: (metadata: Record<string, string>) =>
                        update.mutateAsync({
                          id: data.id,
                          draft: { ...taxRateToEdit(data), metadata },
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
        title={`Archive ${data.name}?`}
        description="The rate can no longer be applied. Invoices that already carry it keep it, and you can publish it again from Edit."
        confirmLabel="Archive tax rate"
        destructive
        isPending={archive.isPending}
        error={archive.isError ? 'Could not archive the tax rate. Try again.' : null}
        onConfirm={() =>
          archive.mutate(
            { id: data.id, draft: { ...taxRateToEdit(data), status: TaxRateStatus.Archived } },
            { onSuccess: () => setArchiving(false) },
          )
        }
      />
    </CatalogDetailFrame>
  )
}

function formatDate(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value)
}

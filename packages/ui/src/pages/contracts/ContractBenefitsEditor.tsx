import { useWriteAccess } from '@ui/compositions/access/Access'
import { useState } from 'react'
import {
  entitlementToEdit,
  emptySpendingAllowance,
  type CreateEntitlement,
  type EditEntitlement,
  type Entitlement,
  type SpendingAllowance,
  type SubscriptionEntitlement,
  type TenantFeatureUsage,
} from '@fp/domain'
import { PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { DetailTable } from '../shared/DetailTable'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { EntitlementUsageTable, entitlementRowsForContract } from '../shared/EntitlementUsage'
import {
  EntitlementEditForm,
  EntitlementCreateForm,
  type FeatureOption,
} from '../product-catalog/entitlements/EntitlementForm'
import { SpendingAllowanceForm } from './SpendingAllowancesSection'
import { provenance } from '@ui/provenance'

export const ContractBenefitsEditorProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Section',
    'compositions/FormDialog',
    'pages/EntitlementForm',
    'pages/shared/DetailTable',
  ],
  note: 'Contract-only entitlement overrides and shared spending allowances; each contributing source is edited separately.',
})

export interface ContractBenefitsEditorProps {
  subscriptionId: string
  entitlements: SubscriptionEntitlement[]
  usage?: TenantFeatureUsage[] | undefined
  records: { entitlement: Entitlement; name: string; source: string }[]
  features: FeatureOption[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  readOnly?: boolean
  onCreate: (draft: CreateEntitlement) => Promise<unknown>
  onCreateAllowance: (draft: SpendingAllowance) => Promise<unknown>
  onEdit: (entitlement: Entitlement, draft: EditEntitlement) => Promise<unknown>
  onReset: (entitlement: Entitlement) => Promise<unknown>
}

export function ContractBenefitsEditor({
  subscriptionId,
  entitlements,
  usage,
  records,
  features,
  isLoading,
  error,
  onRetry,
  readOnly: locked,
  onCreate,
  onCreateAllowance,
  onEdit,
  onReset,
}: ContractBenefitsEditorProps) {
  const write = useWriteAccess()
  const readOnly = locked || !write.allowed
  const [editing, setEditing] = useState<Entitlement | 'feature' | 'allowance' | null>(null)
  const [removing, setRemoving] = useState<Entitlement | null>(null)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const open = (value: typeof editing) => {
    setProblem(null)
    setEditing(value)
  }
  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    setProblem(null)
    try {
      await action()
      setEditing(null)
      setRemoving(null)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not save. Try again.')
    } finally {
      setPending(false)
    }
  }
  const allowanceRows = records.filter((row) => !row.entitlement.featureId)
  const sourceRows = records.filter((row) => row.entitlement.featureId)
  const own = (entitlement: Entitlement) =>
    entitlement.entityType === 'SUBSCRIPTION' && entitlement.entityId === subscriptionId
  const menu = (entitlement: Entitlement, label: string) =>
    readOnly ? null : (
      <RowActionsMenu
        label={label}
        onEdit={() => open(entitlement)}
        onRemove={
          own(entitlement)
            ? () => {
                setProblem(null)
                setRemoving(entitlement)
              }
            : undefined
        }
        removeLabel={entitlement.parentEntitlementId ? 'Reset to inherited value' : 'Remove'}
      />
    )
  return (
    <>
      <Section
        title="Entitlements"
        table
        showTitle
        action={
          !readOnly ? (
            <Button variant="outline" size="sm" onClick={() => open('feature')}>
              <PlusIcon aria-hidden />
              Add entitlement
            </Button>
          ) : undefined
        }
      >
        {entitlements.length ? (
          <EntitlementUsageTable rows={entitlementRowsForContract(entitlements, usage)} />
        ) : (
          <SectionEmpty title="No features" description="This contract includes no features." />
        )}
        {isLoading ? (
          <p role="status" className="text-muted-foreground p-4 text-sm">
            Loading entitlement sources…
          </p>
        ) : error ? (
          <SectionEmpty
            title="Entitlement sources could not be loaded"
            description={error}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : sourceRows.length ? (
          <DetailTable
            label="Entitlement sources"
            noun="sources"
            rows={sourceRows}
            getRowId={(row) => row.entitlement.id}
            columns={[
              { key: 'feature', header: 'Feature', cell: (row) => row.name },
              {
                key: 'source',
                header: 'Source',
                cell: (row) =>
                  own(row.entitlement)
                    ? row.entitlement.parentEntitlementId
                      ? `Contract override · ${row.source}`
                      : 'Contract'
                    : row.source,
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => menu(row.entitlement, `${row.name} from ${row.source}`),
              },
            ]}
          />
        ) : null}
      </Section>
      <Section
        title="Spending allowances"
        table
        showTitle
        description="Money allowances shared across all usage charges."
        action={
          !readOnly ? (
            <Button variant="outline" size="sm" onClick={() => open('allowance')}>
              <PlusIcon aria-hidden />
              Add allowance
            </Button>
          ) : undefined
        }
      >
        {allowanceRows.length ? (
          <DetailTable
            label="Spending allowances"
            noun="allowances"
            rows={allowanceRows}
            getRowId={(row) => row.entitlement.id}
            columns={[
              { key: 'quota', header: 'Amount', cell: (row) => row.entitlement.grantQuota ?? '—' },
              {
                key: 'window',
                header: 'Window',
                cell: (row) =>
                  row.entitlement.grantDurationUnit === 'subscription_period'
                    ? 'Billing period'
                    : `Every ${row.entitlement.grantDurationValue ?? 1} ${row.entitlement.grantDurationUnit}`,
              },
              {
                key: 'starts',
                header: 'Starts',
                cell: (row) =>
                  row.entitlement.startDate
                    ? new Intl.DateTimeFormat('en-US', {
                        timeZone: 'UTC',
                        dateStyle: 'medium',
                      }).format(row.entitlement.startDate)
                    : 'Contract start',
              },
              {
                key: 'ends',
                header: 'Ends',
                cell: (row) =>
                  row.entitlement.endDate
                    ? new Intl.DateTimeFormat('en-US', {
                        timeZone: 'UTC',
                        dateStyle: 'medium',
                      }).format(row.entitlement.endDate)
                    : 'No end',
              },
              {
                key: 'stacking',
                header: 'Stacking',
                cell: (row) => row.entitlement.aggregationMode ?? 'additive',
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => menu(row.entitlement, 'Spending allowance'),
              },
            ]}
          />
        ) : (
          <SectionEmpty
            title="No spending allowances"
            description={
              isLoading
                ? 'Loading allowances…'
                : error
                  ? 'Allowances could not be loaded.'
                  : 'Usage charges have no shared allowance.'
            }
          />
        )}
      </Section>
      <FormDialog
        open={editing !== null}
        onOpenChange={(next) => !next && !pending && setEditing(null)}
        title={
          editing === 'feature'
            ? 'Add entitlement'
            : editing === 'allowance'
              ? 'Add spending allowance'
              : 'Edit entitlement'
        }
        isPending={pending}
      >
        {editing === 'feature' ? (
          <EntitlementCreateForm
            features={features}
            grantModel
            isSubmitting={pending}
            submitError={problem}
            onSubmit={(draft) => void run(() => onCreate(draft))}
          />
        ) : editing === 'allowance' ? (
          <SpendingAllowanceForm
            onCancel={() => setEditing(null)}
            pending={pending}
            error={problem}
            onSubmit={(draft) => void run(() => onCreateAllowance(draft))}
          />
        ) : editing && !editing.featureId ? (
          <SpendingAllowanceForm
            quotaOnly
            initial={{ ...emptySpendingAllowance(), quota: editing.grantQuota ?? '' }}
            pending={pending}
            error={problem}
            onCancel={() => setEditing(null)}
            onSubmit={(draft) => void run(() => onEdit(editing, { grantQuota: draft.quota }))}
          />
        ) : editing ? (
          <EntitlementEditForm
            allowUnlimited
            key={editing.id}
            feature={{
              id: editing.featureId,
              name: records.find((row) => row.entitlement.id === editing.id)?.name ?? 'Feature',
              type: editing.featureType,
            }}
            defaultValue={entitlementToEdit(editing)}
            isSubmitting={pending}
            submitError={problem}
            onSubmit={(draft) => void run(() => onEdit(editing, draft))}
          />
        ) : null}
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && !pending && setRemoving(null)}
        title={
          removing?.parentEntitlementId
            ? 'Reset entitlement to its inherited value?'
            : 'Remove entitlement?'
        }
        description={
          removing?.parentEntitlementId
            ? 'Only this contract’s override is removed. The plan or add-on entitlement applies again.'
            : 'This removes the entitlement from this contract.'
        }
        confirmLabel={removing?.parentEntitlementId ? 'Reset entitlement' : 'Remove'}
        destructive
        isPending={pending}
        error={problem}
        onConfirm={() => removing && void run(() => onReset(removing))}
      />
    </>
  )
}

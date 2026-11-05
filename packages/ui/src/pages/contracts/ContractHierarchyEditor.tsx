import { useWriteAccess } from '@ui/compositions/access/Access'
import { useState } from 'react'
import { type Subscription, type SubscriptionDetail } from '@fp/domain'
import { PencilIcon, PlusIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Field } from '@ui/compositions/forms/Field'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { DetailTable } from '../shared/DetailTable'
import { RowActionsMenu } from '../shared/RowActionsMenu'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { provenance } from '@ui/provenance'

export const ContractHierarchyEditorProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Section',
    'compositions/FormDialog',
    'compositions/OptionCombobox',
    'pages/shared/DetailTable',
  ],
  note: 'Change a contract’s parent or add and remove inherited customers after creation.',
})

export interface ContractHierarchyEditorProps {
  subscription: SubscriptionDetail
  inherited: Subscription[]
  customers: { id: string; name: string; externalId: string }[]
  parents: { id: string; customerId: string; customerName: string; planName: string }[]
  blockedCustomerIds?: Readonly<Record<string, unknown>> | undefined
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onParent: (parentId: string) => Promise<unknown>
  onInherit: (action: 'add' | 'remove', externalIds: string[]) => Promise<unknown>
}

export function ContractHierarchyEditor({
  subscription,
  inherited,
  customers,
  parents,
  blockedCustomerIds,
  loading,
  error,
  onRetry,
  onParent,
  onInherit,
}: ContractHierarchyEditorProps) {
  const [mode, setMode] = useState<'parent' | 'inherit' | null>(null)
  const [parent, setParent] = useState(subscription.parentSubscriptionId ?? '')
  const [customer, setCustomer] = useState('')
  const [remove, setRemove] = useState<{ name: string; externalId: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const write = useWriteAccess()
  const readOnly = subscription.status === 'cancelled' || !write.allowed
  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    setProblem(null)
    try {
      await action()
      setMode(null)
      setRemove(null)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not change hierarchy. Try again.')
    } finally {
      setPending(false)
    }
  }
  const eligible = customers.filter(
    (row) =>
      row.externalId &&
      row.id !== subscription.customerId &&
      !inherited.some((contract) => contract.customerId === row.id) &&
      !blockedCustomerIds?.[row.id],
  )
  const parentOptions = parents
    .filter(
      (row) =>
        row.id !== subscription.id &&
        row.customerId !== subscription.customerId &&
        !inherited.some((contract) => contract.id === row.id),
    )
    .map((row) => ({ value: row.id, label: `${row.customerName} · ${row.planName}` }))
  if (
    subscription.parentSubscriptionId &&
    !parentOptions.some((row) => row.value === subscription.parentSubscriptionId)
  )
    parentOptions.unshift({
      value: subscription.parentSubscriptionId,
      label: `Current parent (${subscription.parentSubscriptionId})`,
    })
  return (
    <>
      <Section
        title="Contract hierarchy"
        description={
          inherited.length > 0
            ? 'Manage the customers that inherit this contract. Remove inherited customers before assigning a parent.'
            : 'Set a parent contract or manage the customers that inherit this contract.'
        }
        actions={
          !readOnly ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || Boolean(error) || inherited.length > 0}
                onClick={() => {
                  setParent(subscription.parentSubscriptionId ?? '')
                  setProblem(null)
                  setMode('parent')
                }}
              >
                <PencilIcon aria-hidden />
                Change parent
              </Button>
              {!subscription.parentSubscriptionId &&
              subscription.subscriptionType !== 'inherited' &&
              !subscription.invoicingCustomerId ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || Boolean(error)}
                  onClick={() => {
                    setCustomer('')
                    setProblem(null)
                    setMode('inherit')
                  }}
                >
                  <PlusIcon aria-hidden />
                  Add inherited customer
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {error ? (
          <SectionEmpty
            title="Hierarchy could not be loaded"
            description={error}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        ) : loading ? (
          <p role="status" className="text-muted-foreground text-sm">
            Loading hierarchy…
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {subscription.parentSubscriptionId
                ? `Parent: ${parentOptions.find((row) => row.value === subscription.parentSubscriptionId)?.label ?? subscription.parentSubscriptionId}`
                : 'No parent contract'}
            </p>
            {inherited.length ? (
              <DetailTable
                label="Inherited customers"
                noun="customers"
                rows={inherited}
                getRowId={(row) => row.id}
                columns={[
                  { key: 'customer', header: 'Customer', cell: (row) => row.customerName },
                  { key: 'plan', header: 'Plan', cell: (row) => row.planName },
                  {
                    key: 'actions',
                    header: '',
                    cell: (row) => {
                      const found = customers.find((customer) => customer.id === row.customerId)
                      return !readOnly && found?.externalId ? (
                        <RowActionsMenu
                          label={row.customerName}
                          removeLabel="Remove inheritance"
                          onRemove={() => {
                            setProblem(null)
                            setRemove({ name: row.customerName, externalId: found.externalId })
                          }}
                        />
                      ) : null
                    },
                  },
                ]}
              />
            ) : (
              <p className="text-muted-foreground text-sm">No customers inherit this contract.</p>
            )}
          </>
        )}
      </Section>
      <FormDialog
        open={mode !== null}
        onOpenChange={(open) => !open && !pending && setMode(null)}
        title={mode === 'parent' ? 'Change parent contract' : 'Add inherited customer'}
        isPending={pending}
      >
        <Composer
          submitLabel={mode === 'parent' ? 'Save parent' : 'Add inherited customer'}
          submitting={pending}
          onCancel={() => setMode(null)}
          disabled={mode === 'inherit' && !customer}
          onSubmit={() => {
            if (mode === 'parent') void run(() => onParent(parent))
            else if (customer) void run(() => onInherit('add', [customer]))
          }}
        >
          {mode === 'parent' ? (
            <Field label="Parent contract" hint="Choose No parent to detach this contract.">
              {({ id }) => (
                <OptionCombobox
                  id={id}
                  searchable
                  value={parent || '__none__'}
                  onValueChange={(value) => setParent(value === '__none__' ? '' : value)}
                  options={[{ value: '__none__', label: 'No parent' }, ...parentOptions]}
                />
              )}
            </Field>
          ) : (
            <Field
              label="Customer"
              hint="Customers with their own contract cannot inherit another contract."
            >
              {({ id }) => (
                <OptionCombobox
                  id={id}
                  searchable
                  value={customer || undefined}
                  onValueChange={setCustomer}
                  options={eligible.map((row) => ({
                    value: row.externalId,
                    label: row.name,
                    hint: row.externalId,
                  }))}
                />
              )}
            </Field>
          )}
          {problem ? (
            <p role="alert" className="text-destructive text-sm">
              {problem}
            </p>
          ) : null}
        </Composer>
      </FormDialog>
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(open) => !open && !pending && setRemove(null)}
        title={`Remove inheritance for ${remove?.name ?? ''}?`}
        description="This customer will no longer inherit this contract."
        confirmLabel="Remove inheritance"
        destructive
        isPending={pending}
        error={problem}
        onConfirm={() => remove && void run(() => onInherit('remove', [remove.externalId]))}
      />
    </>
  )
}

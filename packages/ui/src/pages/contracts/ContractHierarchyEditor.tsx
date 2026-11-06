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
import { OptionMultiCombobox } from '@ui/compositions/forms/OptionMultiCombobox'
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
  /** The inherited contracts are loading: the section waits. */
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** The current parent as the section names it ("Acme · Pro"); its id stands in until known. */
  parentLabel?: string | null | undefined
  /**
   * Asked for when a dialog opens: the customers and parent contracts to pick
   * from are only read then, not on every visit to the contract.
   */
  onLoadOptions?: (() => void) | undefined
  /** The picker lists are loading or failed; only the dialog waits on them. */
  optionsLoading?: boolean | undefined
  optionsError?: string | null | undefined
  onRetryOptions?: (() => void) | undefined
  onDetach?: ((childSubscriptionId: string) => Promise<unknown>) | undefined
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
  parentLabel,
  onLoadOptions,
  optionsLoading = false,
  optionsError = null,
  onRetryOptions,
  onDetach,
  onParent,
  onInherit,
}: ContractHierarchyEditorProps) {
  const [mode, setMode] = useState<'parent' | 'inherit' | null>(null)
  const [parent, setParent] = useState(subscription.parentSubscriptionId ?? '')
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [remove, setRemove] = useState<{
    name: string
    externalId: string
    subscriptionId: string
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const write = useWriteAccess()
  const readOnly =
    subscription.status === 'cancelled' ||
    subscription.subscriptionType === 'inherited' ||
    !write.allowed
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
      (row) => row.id !== subscription.id && !inherited.some((contract) => contract.id === row.id),
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
                disabled={
                  loading ||
                  Boolean(error) ||
                  inherited.length > 0 ||
                  subscription.subscriptionType !== 'standalone'
                }
                onClick={() => {
                  setParent(subscription.parentSubscriptionId ?? '')
                  setProblem(null)
                  onLoadOptions?.()
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
                    setSelectedCustomers([])
                    setProblem(null)
                    onLoadOptions?.()
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
                ? `Parent: ${parentLabel || parentOptions.find((row) => row.value === subscription.parentSubscriptionId)?.label || subscription.parentSubscriptionId}`
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
                      // The inherited contract carries its customer's external id; the
                      // customer list (read only for the dialogs) is the fallback.
                      const externalId =
                        row.customerExternalId ??
                        customers.find((customer) => customer.id === row.customerId)?.externalId
                      return !readOnly && (onDetach || externalId) ? (
                        <RowActionsMenu
                          label={row.customerName}
                          removeLabel="Remove inheritance"
                          onRemove={() => {
                            setProblem(null)
                            setRemove({
                              name: row.customerName,
                              externalId: externalId ?? '',
                              subscriptionId: row.id,
                            })
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
        title={mode === 'parent' ? 'Change parent contract' : 'Add inherited customers'}
        isPending={pending}
      >
        <Composer
          submitLabel={
            mode === 'parent'
              ? 'Save parent'
              : `Add ${selectedCustomers.length || ''} inherited customer${selectedCustomers.length === 1 ? '' : 's'}`.replace(
                  '  ',
                  ' ',
                )
          }
          submitting={pending}
          onCancel={() => setMode(null)}
          disabled={
            optionsLoading ||
            Boolean(optionsError) ||
            (mode === 'inherit' && !selectedCustomers.length)
          }
          onSubmit={() => {
            if (mode === 'parent') void run(() => onParent(parent))
            else if (selectedCustomers.length)
              void run(() => onInherit('add', [...new Set(selectedCustomers)]))
          }}
        >
          {optionsError ? (
            <SectionEmpty
              title="Choices could not be loaded"
              description={optionsError}
              action={
                <Button variant="outline" onClick={onRetryOptions}>
                  Try again
                </Button>
              }
            />
          ) : optionsLoading ? (
            <p role="status" className="text-muted-foreground text-sm">
              Loading choices…
            </p>
          ) : mode === 'parent' ? (
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
              label="Customers"
              hint="Customers with their own contract cannot inherit another contract."
            >
              {({ id }) => (
                <OptionMultiCombobox
                  id={id}
                  disabled={pending}
                  value={selectedCustomers}
                  onValueChange={setSelectedCustomers}
                  placeholder="Search and select customers…"
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
        onConfirm={() =>
          remove &&
          void run(() =>
            onDetach ? onDetach(remove.subscriptionId) : onInherit('remove', [remove.externalId]),
          )
        }
      />
    </>
  )
}

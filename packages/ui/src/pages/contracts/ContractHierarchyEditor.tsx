import { useWriteAccess } from '@ui/compositions/access/Access'
import { useState } from 'react'
import {
  CircleSlashIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  UserIcon,
} from '@ui/icons'
import { type Subscription, type SubscriptionDetail } from '@fp/domain'
import { InfoHint } from '@ui/compositions/forms/InfoHint'
import { Button } from '@ui/components/primitives/button'
import { Section } from '@ui/compositions/layout/Section'
import { SectionEmpty } from '@ui/compositions/feedback/SectionEmpty'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Field } from '@ui/compositions/forms/Field'
import { OptionMultiCombobox } from '@ui/compositions/forms/OptionMultiCombobox'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { EntityLink, Pill } from '../shared/cells'
import { SUBSCRIPTION_STATUS_TONE } from '../shared/statusTones'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { toast } from 'sonner'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { provenance } from '@ui/provenance'

export const ContractHierarchyEditorProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Section',
    'compositions/FormDialog',
    'compositions/OptionCombobox',
    'pages/shared/EntityLink',
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
  /** The parent contract, when this one has one and it has loaded. */
  parent?: SubscriptionDetail | null | undefined
  onOpenContract?: ((id: string) => void) | undefined
  onOpenCustomer?: ((id: string) => void) | undefined
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
  parent: parentContract = null,
  onOpenContract,
  onOpenCustomer,
  onLoadOptions,
  optionsLoading = false,
  optionsError = null,
  onRetryOptions,
  onDetach,
  onParent,
  onInherit,
}: ContractHierarchyEditorProps) {
  const [mode, setMode] = useState<'parent' | 'inherit' | null>(null)
  const [selectedParent, setParent] = useState(subscription.parentSubscriptionId ?? '')
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [remove, setRemove] = useState<{
    name: string
    planName: string
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
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setPending(true)
    setProblem(null)
    try {
      await action()
      setMode(null)
      setRemove(null)
      if (success) toast.success(success)
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
        titleAction={
          <InfoHint>
            {inherited.length > 0
              ? 'Manage the customers that inherit this contract. Remove inherited customers before assigning a parent.'
              : 'Set a parent contract or manage the customers that inherit this contract.'}
          </InfoHint>
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
          <div className="flex flex-col gap-4">
            <HierarchySummary
              subscription={subscription}
              parent={parentContract}
              parentLabel={parentLabel}
              parentFallback={
                parentOptions.find((row) => row.value === subscription.parentSubscriptionId)?.label
              }
              {...(onOpenContract ? { onOpenContract } : {})}
              {...(onOpenCustomer ? { onOpenCustomer } : {})}
            />
            {inherited.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  Customers inheriting this contract ({inherited.length})
                </p>
                <p className="text-muted-foreground text-xs">
                  {inherited.length === 1
                    ? '1 customer inherits this contract'
                    : `${inherited.length} customers inherit this contract`}
                </p>
                <ul aria-label="Customers inheriting this contract" className="divide-y">
                  {inherited.map((row) => {
                    const externalId =
                      row.customerExternalId ??
                      customers.find((customer) => customer.id === row.customerId)?.externalId
                    const canRemove = !readOnly && (Boolean(onDetach) || Boolean(externalId))
                    return (
                      <li key={row.id} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          {onOpenCustomer ? (
                            <EntityLink
                              primary
                              wrap
                              label={row.customerName}
                              onOpen={() => onOpenCustomer(row.customerId)}
                            />
                          ) : (
                            <span className="text-sm wrap-anywhere">{row.customerName}</span>
                          )}
                          {onOpenContract ? (
                            <EntityLink
                              muted
                              wrap
                              label={row.planName ? `${row.planName} · ${row.id}` : row.id}
                              onOpen={() => onOpenContract(row.id)}
                            />
                          ) : (
                            <span className="text-muted-foreground block text-xs">
                              {row.planName ? `${row.planName} · ${row.id}` : row.id}
                            </span>
                          )}
                        </span>
                        <Pill size="sm" tone={SUBSCRIPTION_STATUS_TONE[row.status]}>
                          {row.status}
                        </Pill>
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Actions for ${row.customerName}`}
                              className="text-muted-foreground hover:bg-muted focus-visible:outline-ring flex size-8 items-center justify-center rounded-md focus-visible:outline-2"
                            >
                              <MoreHorizontalIcon aria-hidden className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-48"
                              onClick={(event) => event.stopPropagation()}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              {onOpenContract ? (
                                <DropdownMenuItem onClick={() => onOpenContract(row.id)}>
                                  <EyeIcon aria-hidden /> View child contract
                                </DropdownMenuItem>
                              ) : null}
                              {onOpenCustomer ? (
                                <DropdownMenuItem onClick={() => onOpenCustomer(row.customerId)}>
                                  <UserIcon aria-hidden /> View customer
                                </DropdownMenuItem>
                              ) : null}
                              {canRemove ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => {
                                      setProblem(null)
                                      setRemove({
                                        name: row.customerName,
                                        planName: row.planName
                                          ? `${row.planName} (${row.id})`
                                          : row.id,
                                        externalId: externalId ?? '',
                                        subscriptionId: row.id,
                                      })
                                    }}
                                  >
                                    <CircleSlashIcon aria-hidden /> Remove inheritance
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <SectionEmpty title="No customers inherit this contract" />
            )}
          </div>
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
            if (mode === 'parent') void run(() => onParent(selectedParent))
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
                  value={selectedParent || '__none__'}
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
        title={`Remove inheritance for ${remove?.name ?? 'this customer'}?`}
        description={
          remove
            ? `${remove.name} stops inheriting this contract through ${remove.planName}. The customer and that contract stay. Its charges no longer follow this contract.`
            : 'This customer stops inheriting this contract. The customer and the child contract stay.'
        }
        confirmLabel="Remove inheritance"
        destructive
        isPending={pending}
        error={problem}
        onConfirm={() =>
          remove &&
          void run(
            () =>
              onDetach ? onDetach(remove.subscriptionId) : onInherit('remove', [remove.externalId]),
            `${remove.name} no longer inherits this contract`,
          )
        }
      />
    </>
  )
}

const contractDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

function span(start: Date | null, end: Date | null): string {
  if (!start && !end) return ''
  const from = start ? contractDay.format(start) : 'Open start'
  const to = end ? contractDay.format(end) : 'No end'
  return `${from} – ${to}`
}

function HierarchySummary({
  subscription,
  parent,
  parentLabel,
  parentFallback,
  onOpenContract,
  onOpenCustomer,
}: {
  subscription: SubscriptionDetail
  parent: SubscriptionDetail | null
  parentLabel?: string | null | undefined
  parentFallback?: string | undefined
  onOpenContract?: (id: string) => void
  onOpenCustomer?: (id: string) => void
}) {
  const parentId = subscription.parentSubscriptionId
  const parentName =
    parent?.planName || parentLabel || parentFallback || parentId || 'Parent contract'
  const facts = [
    parent?.billingPeriodLabel,
    parent?.currency,
    parent ? span(parent.startDate, parent.endDate) : '',
  ].filter(Boolean)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">Parent</p>
      {parentId ? (
        <div className="border-border ml-3 flex flex-col gap-1 border-l pl-3">
          <div className="flex flex-wrap items-center gap-2">
            {onOpenContract ? (
              <EntityLink label={parentName} onOpen={() => onOpenContract(parentId)} />
            ) : (
              <span className="text-sm">{parentName}</span>
            )}
            {parent ? (
              <Pill size="sm" tone={SUBSCRIPTION_STATUS_TONE[parent.status]}>
                {parent.status}
              </Pill>
            ) : null}
          </div>
          {parent && onOpenCustomer ? (
            <EntityLink
              muted
              label={parent.customerName}
              onOpen={() => onOpenCustomer(parent.customerId)}
            />
          ) : null}
          {facts.length ? (
            <p className="text-muted-foreground text-sm">{facts.join(' · ')}</p>
          ) : null}
          {subscription.subscriptionType === 'inherited' ? (
            <p className="text-muted-foreground text-sm">
              Charges and billing follow this parent. This contract has no charges of its own.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No parent contract</p>
      )}
      {subscription.subscriptionType === 'parent' ? (
        <p className="text-muted-foreground text-sm">
          Child contracts below bill with this contract’s charges.
        </p>
      ) : null}
    </div>
  )
}

import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Trash2Icon,
  WebhookIcon,
} from '@ui/icons'
import {
  WEBHOOK_RECOVER_WINDOWS,
  type WebhookEndpoint,
  type WebhookEndpointPatch,
  type WebhookEndpointStats,
  type WebhookEventType,
  type WebhookHeader,
  type WebhookRecoverWindow,
  recoverSince,
} from '@fp/domain'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/primitives/input-group'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { DetailList } from '@ui/compositions/tables/DetailList'
import { EditableCard } from '@ui/compositions/forms/EditableCard'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionCombobox } from '@ui/compositions/forms/OptionCombobox'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Section } from '@ui/compositions/layout/Section'
import { provenance } from '@ui/provenance'
import { CatalogDetailFrame } from '../../product-catalog/catalog-detail/CatalogDetailFrame'
import { DetailTable } from '../../shared/DetailTable'
import { Pill } from '../../shared/cells'
import { SplitMeter } from '../../shared/SplitMeter'
import { WebhookEventTypePicker } from './WebhookEventTypePicker'
import { WebhookTime } from './webhookCells'

/**
 * One endpoint — Svix's endpoint page.
 *
 * The header carries the URL, whether the endpoint is enabled, its id, and the
 * menu Svix puts there (disable, recover failed messages, delete). Under it
 * the three tabs Svix has: **Overview** (URL and description, delivery stats),
 * **Testing** (send an event type's example payload) and **Advanced** (rate
 * limit, custom headers). Beside every tab, as in Svix, the endpoint's facts:
 * dates, subscribed event types and the signing secret. Below every tab, the
 * message attempts table, passed in as `attempts`.
 *
 * Every write is a promise from the page. A rejection's message is shown where
 * the write was made; success is a toast.
 */
export const WebhookEndpointDetailProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/catalog-detail/CatalogDetailFrame',
    'compositions/Section',
    'compositions/EditableCard',
    'compositions/ConfirmDialog',
    'compositions/FormDialog',
    'compositions/DetailList',
    'compositions/OptionCombobox',
    'pages/shared/SplitMeter',
    'ui/input-group',
    'reui/code-block',
  ],
  note: 'Svix endpoint page: overview/testing/advanced tabs, facts rail with subscribed events and signing secret, attempts slot.',
})

export type WebhookEndpointTab = 'overview' | 'testing' | 'advanced'

export interface WebhookSecretState {
  revealed: boolean
  onRevealedChange: (revealed: boolean) => void
  /** The `whsec_…` value, only while revealed. */
  value: string | null
  isLoading?: boolean
  onRotate: () => Promise<unknown>
}

export interface WebhookEndpointDetailProps {
  endpoint: WebhookEndpoint
  stats: WebhookEndpointStats | null
  eventTypes: WebhookEventType[]
  eventTypesLoading?: boolean
  tab: WebhookEndpointTab
  onTabChange: (tab: WebhookEndpointTab) => void
  onBack: () => void
  onUpdate: (patch: WebhookEndpointPatch) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onRecover: (since: Date) => Promise<unknown>
  onSendExample: (eventType: string) => Promise<unknown>
  secret: WebhookSecretState
  headers: WebhookHeader[]
  headersLoading?: boolean
  onSetHeader: (name: string, value: string) => Promise<unknown>
  onRemoveHeader: (name: string) => Promise<unknown>
  /** The message attempts table (`WebhookAttemptList`), rendered under every tab. */
  attempts: ReactNode
  locale?: string
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Runs a write, toasting success and keeping the failure for display. */
function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, success: string, fallback: string) => {
    setPending(true)
    setError(null)
    try {
      await action()
      toast.success(success)
      return true
    } catch (caught) {
      setError(messageOf(caught, fallback))
      return false
    } finally {
      setPending(false)
    }
  }
  return { pending, error, run, reset: () => setError(null) }
}

function isUrl(value: string): string | null {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? null
      : 'Use an http(s) URL.'
  } catch {
    return 'Enter a full URL, starting with https://.'
  }
}

export function WebhookEndpointDetail({
  endpoint,
  stats,
  eventTypes,
  eventTypesLoading = false,
  tab,
  onTabChange,
  onBack,
  onUpdate,
  onDelete,
  onRecover,
  onSendExample,
  secret,
  headers,
  headersLoading = false,
  onSetHeader,
  onRemoveHeader,
  attempts,
  locale,
}: WebhookEndpointDetailProps) {
  const [dialog, setDialog] = useState<'delete' | 'toggle' | 'recover' | null>(null)
  const [recoverWindow, setRecoverWindow] = useState<WebhookRecoverWindow>('1d')
  const action = useAction()

  const close = () => {
    setDialog(null)
    action.reset()
  }

  const facts = (
    <div className="flex flex-col gap-5">
      <Section title="Details">
        <DetailList
          columns={1}
          items={[
            { label: 'Created', value: <WebhookTime value={endpoint.createdAt} locale={locale} /> },
            {
              label: 'Last updated',
              value: <WebhookTime value={endpoint.updatedAt} locale={locale} />,
            },
            {
              label: 'Rate limit',
              value: endpoint.rateLimit ? `${endpoint.rateLimit} messages / second` : 'No limit',
            },
          ]}
        />
      </Section>
      <SubscribedEvents
        endpoint={endpoint}
        eventTypes={eventTypes}
        eventTypesLoading={eventTypesLoading}
        onUpdate={onUpdate}
      />
      <SigningSecret secret={secret} />
    </div>
  )

  const withFacts = (main: ReactNode) => (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">{main}</div>
      {facts}
    </div>
  )

  return (
    <CatalogDetailFrame
      listLabel="Webhooks"
      onBack={onBack}
      icon={<WebhookIcon />}
      title={endpoint.url}
      badges={
        endpoint.disabled ? (
          <Pill tone="neutral">Disabled</Pill>
        ) : (
          <Pill tone="success">Enabled</Pill>
        )
      }
      id={endpoint.id}
      menuLabel="Endpoint actions"
      menu={[
        {
          id: 'toggle',
          label: endpoint.disabled ? 'Enable endpoint' : 'Disable endpoint',
          onSelect: () => setDialog('toggle'),
        },
        { id: 'recover', label: 'Recover failed messages', onSelect: () => setDialog('recover') },
        {
          id: 'delete',
          label: 'Delete endpoint',
          destructive: true,
          onSelect: () => setDialog('delete'),
        },
      ]}
      tab={tab}
      onTabChange={(next) => onTabChange(next as WebhookEndpointTab)}
      tabs={[
        {
          value: 'overview',
          label: 'Overview',
          content: withFacts(
            <>
              <EditableCard
                title="Endpoint"
                fields={[
                  {
                    key: 'url',
                    label: 'Endpoint URL',
                    value: endpoint.url,
                    required: true,
                    validate: isUrl,
                    display: (
                      <span className="font-mono text-[13px] break-all">{endpoint.url}</span>
                    ),
                  },
                  {
                    key: 'description',
                    label: 'Description',
                    value: endpoint.description,
                    multiline: true,
                    placeholder: 'What this endpoint is for',
                    display: endpoint.description || (
                      <span className="text-muted-foreground">No description</span>
                    ),
                  },
                ]}
                onSave={async (changes) => {
                  await onUpdate({
                    ...(changes['url'] !== undefined ? { url: changes['url'] } : {}),
                    ...(changes['description'] !== undefined
                      ? { description: changes['description'] }
                      : {}),
                  })
                  toast.success('Endpoint saved')
                }}
              />
              <Section title="Delivery">
                {stats === null ? (
                  <p className="text-muted-foreground text-sm">Loading delivery stats…</p>
                ) : stats.succeeded + stats.failed + stats.pending + stats.sending === 0 ? (
                  <FirstDelivery endpoint={endpoint} onSendExample={() => onTabChange('testing')} />
                ) : (
                  <SplitMeter
                    label="Delivery outcomes"
                    title="Attempts"
                    value={String(stats.succeeded + stats.failed + stats.pending + stats.sending)}
                    parts={[
                      { id: 'succeeded', label: 'Succeeded', value: stats.succeeded, tone: 'good' },
                      { id: 'failed', label: 'Failed', value: stats.failed, tone: 'critical' },
                      { id: 'pending', label: 'Pending', value: stats.pending, tone: 'warning' },
                      { id: 'sending', label: 'Sending', value: stats.sending, tone: 'series-2' },
                    ]}
                  />
                )}
              </Section>
            </>,
          ),
        },
        {
          value: 'testing',
          label: 'Testing',
          content: withFacts(
            <SendExample
              endpoint={endpoint}
              eventTypes={eventTypes}
              eventTypesLoading={eventTypesLoading}
              onSendExample={onSendExample}
            />,
          ),
        },
        {
          value: 'advanced',
          label: 'Advanced',
          content: withFacts(
            <>
              <EditableCard
                title="Rate limit"
                description="The most messages per second Svix delivers to this endpoint. Leave empty for no limit."
                fields={[
                  {
                    key: 'rateLimit',
                    label: 'Messages per second',
                    value: endpoint.rateLimit ? String(endpoint.rateLimit) : '',
                    placeholder: 'No limit',
                    display: endpoint.rateLimit ? String(endpoint.rateLimit) : 'No limit',
                    validate: (next) =>
                      next === '' || (/^\d+$/.test(next) && Number(next) > 0)
                        ? null
                        : 'Enter a whole number above zero, or leave it empty.',
                  },
                ]}
                onSave={async (changes) => {
                  const next = changes['rateLimit'] ?? ''
                  await onUpdate({ rateLimit: next === '' ? null : Number(next) })
                  toast.success('Rate limit saved')
                }}
              />
              <CustomHeaders
                headers={headers}
                isLoading={headersLoading}
                onSetHeader={onSetHeader}
                onRemoveHeader={onRemoveHeader}
              />
            </>,
          ),
        },
      ]}
    >
      <Section title="Message attempts" flush>
        {attempts}
      </Section>

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && close()}
        title="Delete this endpoint?"
        description={`Flexprice stops sending events to ${endpoint.url}. Its delivery history goes with it. This cannot be undone.`}
        confirmLabel="Delete endpoint"
        destructive
        isPending={action.pending}
        error={action.error}
        onConfirm={() =>
          void action
            .run(onDelete, 'Endpoint deleted', 'The endpoint could not be deleted.')
            .then((ok) => ok && setDialog(null))
        }
      />
      <ConfirmDialog
        open={dialog === 'toggle'}
        onOpenChange={(open) => !open && close()}
        title={endpoint.disabled ? 'Enable this endpoint?' : 'Disable this endpoint?'}
        description={
          endpoint.disabled
            ? 'Deliveries resume for new events. Messages that failed while it was disabled can be recovered from the menu.'
            : 'No events are delivered while it is disabled. You can enable it again, and recover what it missed.'
        }
        confirmLabel={endpoint.disabled ? 'Enable endpoint' : 'Disable endpoint'}
        destructive={!endpoint.disabled}
        isPending={action.pending}
        error={action.error}
        onConfirm={() =>
          void action
            .run(
              () => onUpdate({ disabled: !endpoint.disabled }),
              endpoint.disabled ? 'Endpoint enabled' : 'Endpoint disabled',
              'The endpoint could not be updated.',
            )
            .then((ok) => ok && setDialog(null))
        }
      />
      <FormDialog
        open={dialog === 'recover'}
        onOpenChange={(open) => !open && close()}
        title="Recover failed messages"
        size="sm"
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void action
              .run(
                () => onRecover(recoverSince(recoverWindow)),
                'Recovery started',
                'Recovery could not be started.',
              )
              .then((ok) => ok && setDialog(null))
          }}
        >
          <p className="text-muted-foreground text-sm">
            Every message that failed on this endpoint in the window you choose is sent again.
          </p>
          <Field label="Since">
            {(field) => (
              <OptionSelect
                {...field}
                value={recoverWindow}
                onValueChange={(next) => setRecoverWindow(next as WebhookRecoverWindow)}
                options={WEBHOOK_RECOVER_WINDOWS.map((entry) => ({
                  value: entry.value,
                  label: entry.label,
                }))}
              />
            )}
          </Field>
          {action.error ? (
            <p role="alert" className="text-destructive text-sm">
              {action.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? 'Recovering…' : 'Recover'}
            </Button>
          </div>
        </form>
      </FormDialog>
    </CatalogDetailFrame>
  )
}

/* ---- the facts rail ----------------------------------------------------- */

/**
 * What the Delivery card says before anything has been delivered.
 *
 * A bare "nothing yet" left the overview's main column short of the facts
 * rail beside it, so the page read as a gap above an empty attempts table.
 * This turns the same space into the three things that decide whether the
 * first delivery happens, and the one action that makes it happen now.
 */
function FirstDelivery({
  endpoint,
  onSendExample,
}: {
  endpoint: WebhookEndpoint
  onSendExample: () => void
}) {
  const events = endpoint.filterTypes.length
  const steps = [
    { id: 'url', label: 'Endpoint URL added', done: true },
    {
      id: 'events',
      label:
        events === 0
          ? 'Subscribed to every event'
          : `Subscribed to ${events} ${events === 1 ? 'event' : 'events'}`,
      done: true,
    },
    {
      id: 'enabled',
      label: endpoint.disabled
        ? 'Endpoint is disabled — enable it to receive events'
        : 'Endpoint is enabled',
      done: !endpoint.disabled,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">No deliveries yet</p>
        <p className="text-muted-foreground text-sm">
          Success and failure counts appear here after the first message. Send an example event to
          check your receiver now.
        </p>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Delivery setup">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <CircleCheckIcon aria-hidden className="text-success size-4 shrink-0" />
            ) : (
              <CircleDashedIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
            )}
            <span className={step.done ? undefined : 'text-muted-foreground'}>{step.label}</span>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="outline" size="sm" onClick={onSendExample} disabled={endpoint.disabled}>
          <SendIcon aria-hidden />
          Send example event
        </Button>
      </div>
    </div>
  )
}

function SubscribedEvents({
  endpoint,
  eventTypes,
  eventTypesLoading,
  onUpdate,
}: {
  endpoint: WebhookEndpoint
  eventTypes: WebhookEventType[]
  eventTypesLoading: boolean
  onUpdate: (patch: WebhookEndpointPatch) => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(endpoint.filterTypes)
  const action = useAction()

  return (
    <Section
      title="Subscribed events"
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          onClick={() => {
            setDraft(endpoint.filterTypes)
            action.reset()
            setOpen(true)
          }}
        >
          Edit
        </Button>
      }
    >
      {endpoint.filterTypes.length === 0 ? (
        <p className="text-muted-foreground text-sm">All events, including ones added later.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {endpoint.filterTypes.map((name) => (
            <li key={name} className="truncate font-mono text-xs" title={name}>
              {name}
            </li>
          ))}
        </ul>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title="Subscribed events">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void action
              .run(
                () => onUpdate({ filterTypes: draft }),
                'Subscriptions saved',
                'The subscriptions could not be saved.',
              )
              .then((ok) => ok && setOpen(false))
          }}
        >
          <WebhookEventTypePicker
            eventTypes={eventTypes}
            isLoading={eventTypesLoading}
            selected={draft}
            onChange={setDraft}
            disabled={action.pending}
          />
          {action.error ? (
            <p role="alert" className="text-destructive text-sm">
              {action.error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={action.pending}>
              {action.pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </FormDialog>
    </Section>
  )
}

const MASK = 'whsec_••••••••••••••••••••••••'

function SigningSecret({ secret }: { secret: WebhookSecretState }) {
  const [rotating, setRotating] = useState(false)
  const action = useAction()
  const shown = secret.revealed ? (secret.isLoading ? 'Loading…' : (secret.value ?? '')) : MASK

  return (
    <Section
      title="Signing secret"
      description="Verify that each request came from Flexprice."
      actions={
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => setRotating(true)}>
          <RefreshCwIcon aria-hidden />
          Rotate
        </Button>
      }
    >
      <InputGroup>
        <InputGroupInput
          readOnly
          aria-label="Signing secret"
          value={shown}
          className="font-mono text-xs"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={secret.revealed ? 'Hide signing secret' : 'Reveal signing secret'}
            onClick={() => secret.onRevealedChange(!secret.revealed)}
          >
            {secret.revealed ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </InputGroupButton>
          {secret.revealed && secret.value ? (
            <InputGroupButton
              size="icon-xs"
              aria-label="Copy signing secret"
              onClick={() => {
                void navigator.clipboard?.writeText(secret.value ?? '')
                toast.success('Signing secret copied')
              }}
            >
              <CopyIcon aria-hidden />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>
      <ConfirmDialog
        open={rotating}
        onOpenChange={(open) => {
          if (!open) {
            setRotating(false)
            action.reset()
          }
        }}
        title="Rotate the signing secret?"
        description="A new secret is generated. The current one keeps verifying requests for 24 hours, so you can update your receiver without dropping events."
        confirmLabel="Rotate secret"
        isPending={action.pending}
        error={action.error}
        onConfirm={() =>
          void action
            .run(secret.onRotate, 'Signing secret rotated', 'The secret could not be rotated.')
            .then((ok) => ok && setRotating(false))
        }
      />
    </Section>
  )
}

/* ---- testing ------------------------------------------------------------ */

function SendExample({
  endpoint,
  eventTypes,
  eventTypesLoading,
  onSendExample,
}: {
  endpoint: WebhookEndpoint
  eventTypes: WebhookEventType[]
  eventTypesLoading: boolean
  onSendExample: (eventType: string) => Promise<unknown>
}) {
  // An endpoint that filters can only be sent the types it subscribes to.
  const offered =
    endpoint.filterTypes.length > 0
      ? eventTypes.filter((eventType) => endpoint.filterTypes.includes(eventType.name))
      : eventTypes
  const [eventType, setEventType] = useState('')
  const action = useAction()
  const chosen = offered.find((entry) => entry.name === eventType) ?? null

  return (
    <Section
      title="Send an example"
      description="Deliver an event type's example payload to this endpoint, to check your receiver end to end. It is a real delivery and shows in the attempts below."
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (!eventType) return
          void action.run(
            () => onSendExample(eventType),
            'Example sent',
            'The example could not be sent.',
          )
        }}
      >
        <Field label="Event type">
          {(field) => (
            <OptionCombobox
              {...field}
              value={eventType}
              onValueChange={setEventType}
              placeholder={eventTypesLoading ? 'Loading event types…' : 'Search event types…'}
              emptyText="No event type matches."
              options={offered.map((entry) => ({ value: entry.name, label: entry.name }))}
            />
          )}
        </Field>
        {chosen ? (
          chosen.example === null ? (
            <p className="text-muted-foreground text-sm">
              This event type has no example payload registered, so Svix cannot send one.
            </p>
          ) : (
            <CodeBlock
              code={JSON.stringify(chosen.example, null, 2)}
              language="json"
              label={`Example payload, ${chosen.name}`}
            >
              <CodeBlockHeader>
                <CodeBlockTitle>Example payload</CodeBlockTitle>
                <CodeBlockCopyButton className="ml-auto" />
              </CodeBlockHeader>
            </CodeBlock>
          )
        ) : null}
        {action.error ? (
          <p role="alert" className="text-destructive text-sm">
            {action.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={!eventType || action.pending || chosen?.example === null}>
            <SendIcon aria-hidden />
            {action.pending ? 'Sending…' : 'Send example'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

/* ---- advanced ----------------------------------------------------------- */

function CustomHeaders({
  headers,
  isLoading,
  onSetHeader,
  onRemoveHeader,
}: {
  headers: WebhookHeader[]
  isLoading: boolean
  onSetHeader: (name: string, value: string) => Promise<unknown>
  onRemoveHeader: (name: string) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const action = useAction()

  return (
    <Section
      title="Custom headers"
      description="Sent with every delivery to this endpoint. Values Svix marks sensitive, such as Authorization, are never shown again."
      flush
    >
      <DetailTable<WebhookHeader>
        compact
        toolbar={false}
        label="Custom headers"
        noun="headers"
        getRowId={(row) => row.name}
        rows={headers}
        isLoading={isLoading}
        empty="No custom headers."
        columns={[
          {
            key: 'name',
            header: 'Header',
            cell: (row) => <span className="font-mono text-xs">{row.name}</span>,
          },
          {
            key: 'value',
            header: 'Value',
            cell: (row) =>
              row.sensitive ? (
                <span className="text-muted-foreground text-xs">Hidden (sensitive)</span>
              ) : (
                <span className="block max-w-80 truncate font-mono text-xs" title={row.value}>
                  {row.value}
                </span>
              ),
          },
          {
            key: 'remove',
            header: '',
            className: 'w-12 text-right',
            cell: (row) => (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove header ${row.name}`}
                disabled={action.pending}
                onClick={() =>
                  void action.run(
                    () => onRemoveHeader(row.name),
                    'Header removed',
                    'The header could not be removed.',
                  )
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            ),
          },
        ]}
      />
      <form
        className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault()
          const header = name.trim()
          if (!header) return
          void action
            .run(() => onSetHeader(header, value), 'Header saved', 'The header could not be saved.')
            .then((ok) => {
              if (!ok) return
              setName('')
              setValue('')
            })
        }}
      >
        <Input
          aria-label="Header name"
          placeholder="X-Example-Header"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="font-mono text-xs sm:flex-1"
        />
        <Input
          aria-label="Header value"
          placeholder="Value"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono text-xs sm:flex-1"
        />
        <Button type="submit" variant="outline" disabled={!name.trim() || action.pending}>
          <PlusIcon aria-hidden />
          Add header
        </Button>
      </form>
      {action.error ? (
        <p role="alert" className="text-destructive px-4 pb-4 text-sm">
          {action.error}
        </p>
      ) : null}
    </Section>
  )
}

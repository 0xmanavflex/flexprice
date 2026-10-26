import { useEffect, useRef, useState } from 'react'
import {
  API_KEY_STATUS_LABEL,
  API_KEY_TYPE_LABEL,
  type ApiKey,
  ApiKeyStatus,
  ApiKeyType,
  type CreateApiKey,
  type CreatedApiKey,
  ISSUABLE_API_KEY_TYPES,
  createApiKeySchema,
  emptyApiKey,
  isExpired,
  RBAC_ENTITY,
} from '@fp/domain'
import {
  DEFAULT_API_KEY_QUERY,
  useApiKeys,
  useCreateApiKey,
  useCurrentUser,
  useDeleteApiKey,
} from '@fp/query'
import { ConfirmDialog, Field, FormDialog, LoadingRows, WriteGate } from '@fp/ui/compositions'
import { Badge, Button, Input } from '@fp/ui/primitives'
import { CheckIcon, CopyIcon } from '@fp/ui/icons'
import {
  ActionError,
  DelayedHint,
  PanelError,
  PanelActions,
  PanelFirstRun,
  WidePanel,
  formatDate,
  mutationMessage,
  toFailure,
} from './panelKit'
import { useDraft } from './useDraft'
import { currentUserId, isOwnKey } from './apiKeyOwnership'
import { useSession } from '@/app/session'

/** Where a key is used: the API reference's introduction covers authenticating with one. */
const API_DOCS_URL = 'https://docs.flexprice.io/api-reference/introduction'

/**
 * API keys: list, issue, revoke. Lives in Settings; `/api-keys` redirects to its section.
 *
 * ## A snippet list, not a data table
 *
 * A key is something you look at, copy and occasionally revoke; nobody sorts,
 * filters or pages through them. So each key is one compact row: name and
 * dates on the left, the masked key in monospace, Revoke:
 * inside one outline, with no toolbar beyond the create button. Deliberate
 * deviation from the shared table, by product request.
 *
 * ## The secret exists for one render
 *
 * `POST /secrets/api/keys` returns the key material exactly once and never
 * again; `useCreateApiKey` resolves `{ secret, key }` and the secret is
 * deliberately **not** put in the query cache, so a refetch, a remount or a
 * reload loses it for good. The create dialog turns into the secret's one
 * render: copy button, a plain sentence saying this is the only time, and an
 * explicit "I have saved it" to close: not a timer, not a click elsewhere.
 */
export function ApiKeysPanel() {
  const { session } = useSession()
  // The same `/users/me` the shell loads (shared cache): after SAML sign-in
  // the session has no user id, so it alone would make no key look like yours.
  const me = useCurrentUser(session?.token ?? null)
  const userId = currentUserId(me.data?.id, session?.userId)
  const keys = useApiKeys(DEFAULT_API_KEY_QUERY)
  const create = useCreateApiKey()
  const remove = useDeleteApiKey()

  const [isCreating, setIsCreating] = useState(false)
  const [issued, setIssued] = useState<CreatedApiKey | null>(null)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const failure = toFailure(keys.error, 'your API keys')
  const rows = keys.data?.keys ?? []

  // Never while a fresh secret is on screen: the list refetches after a key is
  // issued, and swapping the panel for the error would lose the only copy.
  if (failure && !issued) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void keys.refetch()} />
      </WidePanel>
    )
  }

  // With no keys the empty state fills the page body, centred, under the same
  // top-right create button the list has.
  const firstRun = !keys.isPending && rows.length === 0

  return (
    <WidePanel fill={firstRun}>
      <section className={firstRun ? 'flex flex-1 flex-col gap-3' : 'flex flex-col gap-3'}>
        <h1 className="sr-only">API keys</h1>
        {keys.isPending ? (
          <LoadingRows rows={3} columns={3} />
        ) : (
          <>
            <PanelActions>
              <DelayedHint text="What your systems authenticate with when they send usage or read billing data.">
                <WriteGate entity={RBAC_ENTITY.Secret}>
                  <Button onClick={() => setIsCreating(true)}>Create API key</Button>
                </WriteGate>
              </DelayedHint>
            </PanelActions>
            {firstRun ? (
              <PanelFirstRun
                scene="developers"
                title="No API keys yet"
                description="An API key lets your servers send usage events and call the Flexprice API without a person signing in."
                docsHref={API_DOCS_URL}
                docsLabel="API docs"
              />
            ) : (
              <ul aria-label="API keys" className="bg-background divide-y rounded-xl border">
                {rows.map((key) => (
                  <KeyRow
                    key={key.id}
                    apiKey={key}
                    ownKey={isOwnKey(key.ownerId, userId)}
                    onRevoke={() => setRevoking(key)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <CreateKeyDialog
        open={isCreating}
        issued={issued}
        isPending={create.isPending}
        error={mutationMessage(create.error, 'The key could not be created.')}
        onClose={() => {
          if (create.isPending) return
          setIsCreating(false)
          setIssued(null)
          create.reset()
        }}
        onSubmit={(draft) => {
          void create
            .mutateAsync(draft)
            .then((result) => {
              // The secret is held in component state and nowhere else:
              // putting it in the cache is what would let it outlive the
              // one moment it is meant to be visible.
              setIssued(result)
            })
            .catch(() => {
              // Already surfaced through `create.error`; swallowed so the
              // rejection is not an unhandled one.
            })
        }}
      />

      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevoking(null)
            remove.reset()
          }
        }}
        title={revoking ? `Revoke ${revoking.name || revoking.displayId}?` : 'Revoke API key'}
        description="Anything still using this key stops working immediately. It cannot be restored."
        confirmLabel="Revoke"
        destructive
        isPending={remove.isPending}
        error={mutationMessage(remove.error, 'The key could not be revoked.')}
        onConfirm={() => {
          if (!revoking) return
          remove.mutate(revoking.id, { onSuccess: () => setRevoking(null) })
        }}
      />
    </WidePanel>
  )
}

/** The prefix the API keeps, padded so it reads as a key with the rest hidden. */
function maskedKey(key: ApiKey): string {
  return `${key.displayId || key.id}${'•'.repeat(12)}`
}

/** One key: name and dates, the masked key, Revoke. The secret is not stored, so there is nothing to copy. */
function KeyRow({
  apiKey,
  ownKey,
  onRevoke,
}: {
  apiKey: ApiKey
  /** The signed-in person's own key: anyone with secret write may revoke it. */
  ownKey: boolean
  onRevoke: () => void
}) {
  const name = apiKey.name || apiKey.displayId || apiKey.id
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          {name}
          <Badge variant="secondary" size="sm">
            {API_KEY_TYPE_LABEL[apiKey.type]}
          </Badge>
          {apiKey.status === ApiKeyStatus.Published ? null : (
            <Badge variant="destructive-light" size="sm">
              {API_KEY_STATUS_LABEL[apiKey.status]}
            </Badge>
          )}
          {isExpired(apiKey) ? (
            <Badge variant="warning-light" size="sm">
              Expired
            </Badge>
          ) : null}
        </span>
        <span className="text-muted-foreground text-xs">
          Created {formatDate(apiKey.createdAt)}
          {apiKey.serviceAccountName ? ` · ${apiKey.serviceAccountName}` : ''}
          {/* null means never used, which is not the same as unknown. */}
          {` · Last used ${apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'never'}`}
          {apiKey.expiresAt ? ` · Expires ${formatDate(apiKey.expiresAt)}` : ''}
        </span>
      </div>
      <code className="bg-muted max-w-full min-w-0 truncate rounded-md px-2.5 py-1 font-mono text-xs">
        {maskedKey(apiKey)}
      </code>
      {/*
        Revoking needs secret write (V1); a key someone else owns (a colleague's,
        a service account's) needs super admin too, as the API enforces
        (`secret.go`). A key that is no longer live has nothing to revoke.
      */}
      {apiKey.status === ApiKeyStatus.Published ? (
        <WriteGate entity={RBAC_ENTITY.Secret} {...(ownKey ? {} : { superAdmin: true })}>
          <Button size="sm" variant="ghost" onClick={onRevoke}>
            Revoke
          </Button>
        </WriteGate>
      ) : null}
    </li>
  )
}

/**
 * A freshly issued secret, shown whole (wrapped, never truncated) with a
 * labelled copy button, so a long key is legible and copyable at a glance.
 */
function SecretReveal({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <code className="bg-muted rounded-md px-3 py-2.5 font-mono text-sm break-all select-all">
        {value}
      </code>
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => setCopied(true))
              // Clipboard access can be refused; say nothing rather than claim success.
              .catch(() => setCopied(false))
          }}
        >
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? 'Copied' : 'Copy key'}
        </Button>
      </div>
    </div>
  )
}

function CreateKeyDialog({
  open,
  issued,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean
  issued: CreatedApiKey | null
  isPending: boolean
  error: string | null
  onSubmit: (draft: CreateApiKey) => void
  onClose: () => void
}) {
  const draft = useDraft<CreateApiKey>(createApiKeySchema, emptyApiKey())
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) draft.reset(emptyApiKey())
    wasOpen.current = open
  }, [open, draft])
  const type = draft.value.type

  /*
   * `ISSUABLE_API_KEY_TYPES` is declared `ApiKeyType[]`: wider than the two
   * literals `createApiKeySchema` accepts, because `integration` is a real key
   * type that simply cannot be issued from here. Narrowed rather than cast, so
   * a type added to that list which the schema rejects loses its button
   * instead of gaining one that fails validation on submit.
   */
  const issuable = ISSUABLE_API_KEY_TYPES.filter(
    (option): option is CreateApiKey['type'] =>
      option === ApiKeyType.Private || option === ApiKeyType.Publishable,
  )

  return (
    <FormDialog
      open={open}
      size={issued ? 'md' : 'sm'}
      title={issued ? 'Copy this key now' : 'New API key'}
      // The secret is dismissed by "I have saved it", never by a stray click or a close control.
      dismissible={!issued}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      {issued ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            This is the only time Flexprice will show it. A lost key has to be revoked and replaced.
          </p>
          <SecretReveal value={issued.secret} label={issued.key.name || 'the new API key'} />
          <div className="flex justify-end">
            <Button onClick={onClose}>I have saved it</Button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={draft.handleSubmit(onSubmit)}>
          <Field
            label="Name"
            required
            {...(draft.error('name') ? { error: draft.error('name') } : {})}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                autoFocus
                placeholder="Billing worker"
                disabled={isPending}
                value={draft.text('name')}
                onChange={(event) => draft.setText('name', event.target.value)}
                {...field}
              />
            )}
          </Field>

          <Field
            label="Expires on"
            hint="Leave blank for a key that never expires."
            {...(draft.error('expiresAt') ? { error: draft.error('expiresAt') } : {})}
          >
            {({ id, ...field }) => (
              <Input
                id={id}
                type="date"
                disabled={isPending}
                value={draft.text('expiresAt')}
                onChange={(event) => draft.setText('expiresAt', event.target.value)}
                {...field}
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-1.5" disabled={isPending}>
            <legend className="text-sm font-medium">Type</legend>
            <div role="group" aria-label="Key type" className="flex flex-wrap gap-1.5">
              {issuable.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={type === option ? 'default' : 'outline'}
                  aria-pressed={type === option}
                  onClick={() => draft.update((current) => ({ ...current, type: option }))}
                >
                  {API_KEY_TYPE_LABEL[option]}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {type === ApiKeyType.Publishable
                ? 'Safe to ship in a browser or mobile app. It can only do what a customer may do.'
                : 'Can do anything your account can. Keep it on a server.'}
            </p>
          </fieldset>

          <ActionError message={error} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  )
}

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
} from '@fp/domain'
import { DEFAULT_API_KEY_QUERY, useApiKeys, useCreateApiKey, useDeleteApiKey } from '@fp/query'
import { ConfirmDialog, EmptyState, Field, LoadingRows } from '@fp/ui/compositions'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fp/ui/primitives'
import { KeyRoundIcon } from 'lucide-react'
import {
  ActionError,
  ActionNote,
  PanelError,
  WidePanel,
  formatDate,
  mutationMessage,
  toFailure,
  SettingsBlock,
  TableBlock,
} from './panelKit'
import { useDraft } from './useDraft'

/**
 * API keys — list, issue, revoke.
 *
 * ## The secret exists for one render
 *
 * `POST /secrets/api/keys` returns the key material exactly once and never
 * again; `useCreateApiKey` resolves `{ secret, key }` and the secret is
 * deliberately **not** put in the query cache, so a refetch, a remount or a
 * reload loses it for good. That is the correct behaviour for a credential and
 * it puts a requirement on this screen: the one render it gets has to be
 * unmistakable.
 *
 * So the secret appears in a panel of its own, with a copy button, and with a
 * sentence saying plainly that this is the only time it will be shown. It is
 * dismissed by an explicit "I have saved it", not by a timer and not by
 * navigating — a credential that vanishes because somebody clicked elsewhere
 * is a support ticket.
 */
export function ApiKeysPanel() {
  const keys = useApiKeys(DEFAULT_API_KEY_QUERY)
  const create = useCreateApiKey()
  const remove = useDeleteApiKey()

  const [isCreating, setIsCreating] = useState(false)
  const [issued, setIssued] = useState<CreatedApiKey | null>(null)
  const [revoking, setRevoking] = useState<ApiKey | null>(null)

  const failure = toFailure(keys.error, 'your API keys')
  const rows = keys.data?.keys ?? []

  if (failure) {
    return (
      <WidePanel>
        <PanelError failure={failure} onRetry={() => void keys.refetch()} />
      </WidePanel>
    )
  }

  return (
    <WidePanel>
      {issued ? <IssuedSecret issued={issued} onDismiss={() => setIssued(null)} /> : null}

      <TableBlock
        title="API keys"
        description="What your systems authenticate with when they send usage or read billing data."
        actions={
          <Button size="sm" onClick={() => setIsCreating(true)}>
            Create API key
          </Button>
        }
      >
        {keys.isPending ? (
          <LoadingRows rows={3} columns={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<KeyRoundIcon aria-hidden />}
            title="No API keys yet"
            description="An API key lets your systems send usage and read billing data without a person signing in."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-px text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="whitespace-normal">
                    <span className="flex flex-col">
                      <span className="font-medium">{key.name || key.displayId || key.id}</span>
                      {key.serviceAccountName ? (
                        <span className="text-muted-foreground text-xs">
                          {key.serviceAccountName}
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{API_KEY_TYPE_LABEL[key.type]}</Badge>
                      {key.status === ApiKeyStatus.Published ? null : (
                        <Badge variant="destructive-light">
                          {API_KEY_STATUS_LABEL[key.status]}
                        </Badge>
                      )}
                      {isExpired(key) ? <Badge variant="warning-light">Expired</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {/* null means never used, which is not the same as unknown. */}
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                  </TableCell>
                  <TableCell className="w-px text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setRevoking(key)}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableBlock>

      <CreateKeyDialog
        open={isCreating}
        isPending={create.isPending}
        error={mutationMessage(create.error, 'The key could not be created.')}
        onOpenChange={(open) => {
          if (open) return
          setIsCreating(false)
          create.reset()
        }}
        onSubmit={(draft) => {
          void create
            .mutateAsync(draft)
            .then((result) => {
              // The secret is held in component state and nowhere else —
              // putting it in the cache is what would let it outlive the
              // one moment it is meant to be visible.
              setIssued(result)
              setIsCreating(false)
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

/**
 * The one render the secret gets.
 *
 * Read-only input rather than plain text so it can be selected, focused and
 * copied with the keyboard as well as the button; `spellCheck={false}` because
 * a browser underlining a credential in red reads as an error.
 */
function IssuedSecret({ issued, onDismiss }: { issued: CreatedApiKey; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  return (
    <SettingsBlock
      title="Copy this key now"
      description="This is the only time Flexprice will show it. Closing this panel does not revoke the key — it just means the secret is gone from this screen for good, and a lost key has to be revoked and replaced."
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          readOnly
          spellCheck={false}
          aria-label={`Secret for ${issued.key.name || 'the new API key'}`}
          value={issued.secret}
          className="font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard
              .writeText(issued.secret)
              .then(() => setCopied(true))
              // Clipboard access can be refused; the field is still selectable,
              // so the fallback is to say nothing rather than claim success.
              .catch(() => setCopied(false))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <ActionNote message={copied ? 'Copied to your clipboard.' : null} />

      <div>
        <Button variant="secondary" onClick={onDismiss}>
          I have saved it
        </Button>
      </div>
    </SettingsBlock>
  )
}

function CreateKeyDialog({
  open,
  isPending,
  error,
  onSubmit,
  onOpenChange,
}: {
  open: boolean
  isPending: boolean
  error: string | null
  onSubmit: (draft: CreateApiKey) => void
  onOpenChange: (open: boolean) => void
}) {
  const draft = useDraft<CreateApiKey>(createApiKeySchema, emptyApiKey())
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) draft.reset(emptyApiKey())
    wasOpen.current = open
  }, [open, draft])
  const type = draft.value.type

  /*
   * `ISSUABLE_API_KEY_TYPES` is declared `ApiKeyType[]` — wider than the two
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API key</DialogTitle>
          <DialogDescription>Name it after the system that will hold it.</DialogDescription>
        </DialogHeader>
        <form
          id="create-api-key"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={draft.handleSubmit(onSubmit)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

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
                ? 'A publishable key is safe to ship in a browser or mobile app. It can only do what a customer may do.'
                : 'A secret key can do anything your account can. Keep it on a server.'}
            </p>
          </fieldset>

          <ActionError message={error} />
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-api-key" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

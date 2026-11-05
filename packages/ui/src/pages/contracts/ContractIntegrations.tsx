import { useState } from 'react'
import { WorkflowStatus, type EntitySyncRun, type IntegrationLink } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { Input } from '@ui/components/primitives/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { ConfirmDialog } from '@ui/compositions/feedback/ConfirmDialog'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import {
  ArrowUpRightIcon,
  CircleSlashIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  DownloadIcon,
  UploadIcon,
} from '@ui/icons'
import { provenance } from '@ui/provenance'
import { toast } from 'sonner'
import { IntegrationMark } from '../customers/IntegrationMark'
import { Pill, type PillTone } from '../shared/cells'

/**
 * The contract header's integration marks. The mappings belong to the contract's
 * customer, so the marks say which accounting or billing system already knows
 * this customer. Hover for the provider-side id and when the link was made;
 * click for the menu that copies the id or unlinks it; the plus links a
 * connected provider that has no mapping yet.
 */
export const ContractIntegrationsProvenance = provenance({
  source: 'composition',
  composes: [
    'primitives/tooltip',
    'primitives/dropdown-menu',
    'compositions/FormDialog',
    'compositions/ConfirmDialog',
    'pages/customers/IntegrationMark',
  ],
  note: 'Shared header marks and Related rows for customer, invoice and plan mappings, with entity-specific copy labels and optional link/unlink controls. Plan supports an overflow-triggered link dialog; supplied HTML reference.',
})

export interface LinkableProvider {
  providerType: string
  name: string
}

export interface ContractIntegrationsProps {
  /** Header marks or rows in the Related card. */
  layout?: 'marks' | 'rows'
  showLink?: boolean
  entityLabel?: string
  linkOpen?: boolean | undefined
  onLinkOpenChange?: ((open: boolean) => void) | undefined
  links: IntegrationLink[]
  /** Connected providers this customer has no mapping for yet. */
  linkable: LinkableProvider[]
  onLink?: (input: { providerType: string; providerEntityId: string }) => Promise<unknown>
  onUnlink?: (input: { providerType: string }) => Promise<unknown>
  /**
   * Provider names a push reaches: every connection that syncs this entity
   * outbound. The API pushes to all of them at once, so the Related card has
   * one "Push to {names}" action, shown whether or not a mapping exists yet
   * (a push creates the provider record).
   */
  pushProviders?: string[]
  onPush?: () => void
  /** Provider names a pull reads from (inbound sync on); one "Pull from {names}" action. */
  pullProviders?: string[]
  onPull?: () => void
  /** A push or pull request is on its way: both actions wait for it. */
  syncing?: boolean | undefined
  /**
   * The latest sync run per provider (a push starts one per provider and
   * answers before any finishes). Shown under the mappings in the rows layout.
   */
  syncRuns?: EntitySyncRun[] | undefined
  /**
   * Where a mapping can be opened at its provider (an invoice on Stripe). A
   * row with one opens it from its name and from its menu.
   */
  providerHref?: ((link: IntegrationLink) => string | null) | undefined
  /**
   * The page puts Link, Push and Pull in its own header menu, so the rows
   * only list the mappings.
   */
  actionsInHeader?: boolean
}

const stamp = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const SYNC_STATE: Record<string, { label: string; tone: PillTone }> = {
  [WorkflowStatus.Running]: { label: 'Syncing', tone: 'info' },
  [WorkflowStatus.ContinuedAsNew]: { label: 'Syncing', tone: 'info' },
  [WorkflowStatus.Completed]: { label: 'Synced', tone: 'success' },
  [WorkflowStatus.Failed]: { label: 'Failed', tone: 'danger' },
  [WorkflowStatus.TimedOut]: { label: 'Timed out', tone: 'danger' },
  [WorkflowStatus.Terminated]: { label: 'Stopped', tone: 'warning' },
  [WorkflowStatus.Canceled]: { label: 'Canceled', tone: 'neutral' },
}

function when(value: Date | null): string {
  return value && !Number.isNaN(value.getTime()) ? stamp.format(value) : 'Unknown'
}

export function ContractIntegrations({
  layout = 'marks',
  entityLabel = 'customer',
  linkOpen,
  onLinkOpenChange,
  showLink = true,
  links,
  linkable,
  onLink,
  onUnlink,
  pushProviders,
  onPush,
  pullProviders,
  onPull,
  syncing = false,
  syncRuns = [],
  providerHref,
  actionsInHeader = false,
}: ContractIntegrationsProps) {
  const [unlinking, setUnlinking] = useState<IntegrationLink | null>(null)
  const [internalLinking, setInternalLinking] = useState(false)
  const linking = linkOpen ?? internalLinking
  const setLinking = onLinkOpenChange ?? setInternalLinking
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLink = showLink && !actionsInHeader && Boolean(onLink) && linkable.length > 0
  const pushTo = onPush && pushProviders && pushProviders.length > 0 ? pushProviders : null
  const canPush = layout === 'rows' && !actionsInHeader && pushTo !== null
  const pullFrom = onPull && pullProviders && pullProviders.length > 0 ? pullProviders : null
  const canPull = layout === 'rows' && !actionsInHeader && pullFrom !== null
  const none = `No integrations linked to this ${entityLabel}.`

  // In the Related card the rows are the card's whole body, so rendering nothing
  // left a bare "Related" heading over an empty box. Say so instead. The header
  // marks have nowhere to put a sentence, so they still render nothing: unless
  // the parent opened the link dialog itself (a plan's overflow menu), which
  // has to mount even though there is nothing to show beside it.
  if (
    links.length === 0 &&
    !canLink &&
    !linking &&
    !canPush &&
    !canPull &&
    (layout !== 'rows' || syncRuns.length === 0)
  ) {
    return layout === 'rows' ? (
      <p className="text-muted-foreground px-6 py-4 text-sm">{none}</p>
    ) : null
  }

  const run = async (action: () => Promise<unknown>, done: () => void) => {
    setPending(true)
    setError(null)
    try {
      await action()
      done()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The change could not be saved')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={layout === 'rows' ? 'flex flex-col divide-y' : 'flex items-center gap-1.5'}>
      {links.map((link) =>
        layout === 'rows' ? (
          <div
            key={link.providerType}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-4 px-6 py-3"
          >
            {providerHref?.(link) ? (
              <a
                href={providerHref(link) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open this ${entityLabel} in ${link.name}`}
                className="hover:text-foreground focus-visible:outline-ring flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-2"
              >
                <IntegrationMark integration={link} />
                <span className="truncate text-sm underline-offset-2 hover:underline">
                  {link.name}
                </span>
                <ArrowUpRightIcon aria-hidden className="text-muted-foreground size-3.5 shrink-0" />
              </a>
            ) : (
              <span className="flex min-w-0 items-center gap-2.5">
                <IntegrationMark integration={link} />
                <span className="truncate text-sm">{link.name}</span>
              </span>
            )}
            <span className="flex min-w-0 items-center gap-1">
              <Tooltip>
                {/* The row shows a shortened id; the accessible name carries it whole. */}
                <TooltipTrigger
                  aria-label={`${link.name} ID ${link.providerEntityId}`}
                  className="inline-flex min-w-0 items-center text-sm"
                >
                  <span className="truncate font-mono">{shortId(link.providerEntityId)}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-72 font-mono break-all">
                  {link.providerEntityId}
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-7 shrink-0"
                aria-label={`Copy ${entityLabel} ID`}
                onClick={() => copyEntityId(link, entityLabel)}
              >
                <CopyIcon aria-hidden />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`Manage ${link.name} integration`}
                  className="text-muted-foreground hover:bg-muted focus-visible:outline-ring ml-auto flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:outline-2"
                >
                  <MoreHorizontalIcon aria-hidden className="size-4" />
                </DropdownMenuTrigger>
                <IntegrationMenu
                  link={link}
                  entityLabel={entityLabel}
                  href={providerHref?.(link) ?? null}
                  onUnlink={onUnlink}
                  onAskUnlink={() => {
                    setError(null)
                    setUnlinking(link)
                  }}
                />
              </DropdownMenu>
            </span>
          </div>
        ) : (
          <DropdownMenu key={link.providerType}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    aria-label={`${link.name} integration`}
                    className="focus-visible:outline-ring flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                  />
                }
              >
                <IntegrationMark integration={link} />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="block max-w-72 p-3">
                <p className="mb-2 text-xs font-medium">{link.name}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="opacity-70">Provider {entityLabel} ID</dt>
                  <dd className="font-mono break-all">{link.providerEntityId}</dd>
                  <dt className="opacity-70">Created</dt>
                  <dd>{when(link.createdAt)}</dd>
                  <dt className="opacity-70">Updated</dt>
                  <dd>{when(link.updatedAt)}</dd>
                </dl>
              </TooltipContent>
            </Tooltip>
            <IntegrationMenu
              link={link}
              entityLabel={entityLabel}
              href={providerHref?.(link) ?? null}
              onUnlink={onUnlink}
              onAskUnlink={() => {
                setError(null)
                setUnlinking(link)
              }}
            />
          </DropdownMenu>
        ),
      )}
      {layout === 'rows' && links.length === 0 ? (
        <p className="text-muted-foreground px-6 py-3 text-sm">{none}</p>
      ) : null}
      {canLink ? (
        layout === 'rows' ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground h-auto justify-start rounded-none px-6 py-3"
            onClick={() => {
              setError(null)
              setLinking(true)
            }}
          >
            <PlusIcon aria-hidden className="size-3.5" />
            Link integration
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 rounded-lg"
                  aria-label="Link an integration"
                  onClick={() => {
                    setError(null)
                    setLinking(true)
                  }}
                />
              }
            >
              <PlusIcon aria-hidden className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Link an integration</TooltipContent>
          </Tooltip>
        )
      ) : null}
      {canPush && pushTo && onPush ? (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground h-auto justify-start rounded-none px-6 py-3"
          disabled={syncing}
          onClick={onPush}
        >
          <UploadIcon aria-hidden className="size-3.5" />
          Push to {pushTo.join(', ')}
        </Button>
      ) : null}
      {canPull && pullFrom && onPull ? (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground h-auto justify-start rounded-none px-6 py-3"
          disabled={syncing}
          onClick={onPull}
        >
          <DownloadIcon aria-hidden className="size-3.5" />
          Pull from {pullFrom.join(', ')}
        </Button>
      ) : null}

      {layout === 'rows' && syncRuns.length > 0 ? (
        <div className="space-y-2 px-6 py-3">
          <p className="text-muted-foreground text-xs">Last sync</p>
          <ul className="space-y-1.5">
            {syncRuns.map((run) => {
              const shown = SYNC_STATE[run.status ?? ''] ?? { label: 'Unknown', tone: 'neutral' }
              const at = run.closeTime ?? run.startTime
              return (
                <li
                  key={run.providerId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">{run.provider}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {at ? (
                      <span className="text-muted-foreground text-xs tabular-nums">{when(at)}</span>
                    ) : null}
                    <Pill size="sm" tone={shown.tone}>
                      {shown.label}
                    </Pill>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(next) => (next || pending ? undefined : setUnlinking(null))}
        title={`Unlink ${unlinking?.name ?? 'integration'}?`}
        description={`This ${entityLabel} is unlinked from ${unlinking?.name ?? 'the provider'}. Nothing is deleted there, and you can link it again later.`}
        confirmLabel="Unlink"
        pendingLabel="Unlinking…"
        destructive
        isPending={pending}
        error={error}
        onConfirm={() =>
          unlinking &&
          onUnlink &&
          void run(
            () => onUnlink({ providerType: unlinking.providerType }),
            () => setUnlinking(null),
          )
        }
      />
      <LinkDialog
        entityLabel={entityLabel}
        open={linking}
        providers={linkable}
        pending={pending}
        error={error}
        onClose={() => setLinking(false)}
        onSubmit={(input) =>
          onLink &&
          void run(
            () => onLink(input),
            () => setLinking(false),
          )
        }
      />
    </div>
  )
}

function shortId(value: string): string {
  if (value.length <= 18) return value
  return `${value.slice(0, 9)}…${value.slice(-4)}`
}

function copyEntityId(link: IntegrationLink, entityLabel: string) {
  void navigator.clipboard
    ?.writeText(link.providerEntityId)
    .then(() => toast.success(`${link.name} ${entityLabel} ID copied`))
    .catch(() => toast.error('Copy failed'))
}

function IntegrationMenu({
  link,
  entityLabel,
  href,
  onUnlink,
  onAskUnlink,
}: {
  link: IntegrationLink
  entityLabel: string
  href: string | null
  onUnlink?: ContractIntegrationsProps['onUnlink']
  onAskUnlink: () => void
}) {
  return (
    <DropdownMenuContent align="end" className="min-w-48">
      {href ? (
        <DropdownMenuItem onClick={() => void window.open(href, '_blank', 'noopener,noreferrer')}>
          <ArrowUpRightIcon aria-hidden /> Open in {link.name}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onClick={() => copyEntityId(link, entityLabel)}>
        <CopyIcon aria-hidden /> Copy {entityLabel} ID
      </DropdownMenuItem>
      {onUnlink ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onAskUnlink}>
            <CircleSlashIcon aria-hidden /> Unlink {link.name}
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  )
}

function LinkDialog({
  entityLabel,
  open,
  providers,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  entityLabel: string
  open: boolean
  providers: LinkableProvider[]
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: { providerType: string; providerEntityId: string }) => void
}) {
  const [providerType, setProviderType] = useState(providers[0]?.providerType ?? '')
  const [providerEntityId, setProviderEntityId] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const selected = providers.some((p) => p.providerType === providerType)
    ? providerType
    : (providers[0]?.providerType ?? '')

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title="Link an integration"
      size="sm"
      isPending={pending}
    >
      <Composer
        submitLabel="Link"
        onCancel={onClose}
        submitting={pending}
        onSubmit={() => {
          const id = providerEntityId.trim()
          if (!selected) return setProblem('Choose an integration')
          if (!id) return setProblem(`Enter the ${entityLabel} ID at the provider`)
          setProblem(null)
          onSubmit({ providerType: selected, providerEntityId: id })
        }}
      >
        <div className="flex flex-col gap-2">
          <LabelWithHint htmlFor="link-provider" hint="Only connected integrations are listed.">
            Integration
          </LabelWithHint>
          <OptionSelect
            id="link-provider"
            value={selected}
            onValueChange={setProviderType}
            options={providers.map((p) => ({ value: p.providerType, label: p.name }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <LabelWithHint
            htmlFor="link-customer-id"
            hint={`The ID this ${entityLabel} already has at the provider.`}
          >
            {entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} ID at the provider
          </LabelWithHint>
          <Input
            id="link-customer-id"
            autoComplete="off"
            value={providerEntityId}
            onChange={(event) => setProviderEntityId(event.target.value)}
          />
        </div>
        {problem || error ? (
          <p role="alert" className="text-destructive text-sm">
            {problem ?? error}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

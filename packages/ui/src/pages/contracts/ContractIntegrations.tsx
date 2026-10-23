import { useState } from 'react'
import type { IntegrationLink } from '@fp/domain'
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
  UploadIcon,
} from '@ui/icons'
import { provenance } from '@ui/provenance'
import { toast } from 'sonner'
import { IntegrationMark } from '../customers/IntegrationMark'

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
  /** Provider names that can receive a push. Shows "Push to {name}" on that row. */
  pushProviders?: string[]
  onPush?: () => void
}

const stamp = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

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
}: ContractIntegrationsProps) {
  const [unlinking, setUnlinking] = useState<IntegrationLink | null>(null)
  const [internalLinking, setInternalLinking] = useState(false)
  const linking = linkOpen ?? internalLinking
  const setLinking = onLinkOpenChange ?? setInternalLinking
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLink = showLink && Boolean(onLink) && linkable.length > 0
  const none = `No integrations linked to this ${entityLabel}.`

  // In the Related card the rows are the card's whole body, so rendering nothing
  // left a bare "Related" heading over an empty box. Say so instead. The header
  // marks have nowhere to put a sentence, so they still render nothing — unless
  // the parent opened the link dialog itself (a plan's overflow menu), which
  // has to mount even though there is nothing to show beside it.
  if (links.length === 0 && !canLink && !linking) {
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
            <span className="flex min-w-0 items-center gap-2.5">
              <IntegrationMark integration={link} />
              <span className="truncate text-sm">{link.name}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <Tooltip>
                {/* The row shows a shortened id; the accessible name carries it whole. */}
                <TooltipTrigger
                  aria-label={`${link.name} ID ${link.providerEntityId}`}
                  className="inline-flex min-w-0 items-center gap-1 text-sm"
                >
                  <span className="truncate font-mono">{shortId(link.providerEntityId)}</span>
                  <ArrowUpRightIcon
                    aria-hidden
                    className="text-muted-foreground size-3.5 shrink-0"
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-72 font-mono break-all">
                  {link.providerEntityId}
                </TooltipContent>
              </Tooltip>
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
                  {...(onPush && pushProviders?.includes(link.name) ? { onPush } : {})}
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

function IntegrationMenu({
  link,
  entityLabel,
  onUnlink,
  onAskUnlink,
  onPush,
}: {
  link: IntegrationLink
  entityLabel: string
  onUnlink?: ContractIntegrationsProps['onUnlink']
  onAskUnlink: () => void
  onPush?: () => void
}) {
  return (
    <DropdownMenuContent align="end" className="min-w-48">
      {onPush ? (
        <DropdownMenuItem onClick={onPush}>
          <UploadIcon aria-hidden /> Push to {link.name}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        onClick={() => {
          void navigator.clipboard
            ?.writeText(link.providerEntityId)
            .then(() => toast.success(`${link.name} ${entityLabel} ID copied`))
            .catch(() => toast.error('Copy failed'))
        }}
      >
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

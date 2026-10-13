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
import { CopyIcon, PlusIcon } from '@ui/icons'
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
  note: 'Header integration marks: detail tooltip, link and unlink menu, and the dialogs behind them.',
})

export interface LinkableProvider {
  providerType: string
  name: string
}

export interface ContractIntegrationsProps {
  links: IntegrationLink[]
  /** Connected providers this customer has no mapping for yet. */
  linkable: LinkableProvider[]
  onLink: (input: { providerType: string; providerEntityId: string }) => Promise<unknown>
  onUnlink: (input: { providerType: string }) => Promise<unknown>
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
  links,
  linkable,
  onLink,
  onUnlink,
}: ContractIntegrationsProps) {
  const [unlinking, setUnlinking] = useState<IntegrationLink | null>(null)
  const [linking, setLinking] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (links.length === 0 && linkable.length === 0) return null

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
    <div className="flex items-center gap-1.5">
      {links.map((link) => (
        <DropdownMenu key={link.providerType}>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  aria-label={`${link.name} integration`}
                  className="focus-visible:outline-ring cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              }
            >
              <IntegrationMark integration={link} />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="block max-w-72 p-3">
              <p className="mb-2 text-xs font-medium">{link.name}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="opacity-70">Customer ID</dt>
                <dd className="font-mono break-all">{link.providerEntityId}</dd>
                <dt className="opacity-70">Created</dt>
                <dd>{when(link.createdAt)}</dd>
                <dt className="opacity-70">Updated</dt>
                <dd>{when(link.updatedAt)}</dd>
              </dl>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(link.providerEntityId)
                  .then(() => toast.success(`${link.name} customer ID copied`))
                  .catch(() => toast.error('Copy failed'))
              }}
            >
              <CopyIcon aria-hidden /> Copy customer ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setError(null)
                setUnlinking(link)
              }}
            >
              Unlink {link.name}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
      {linkable.length > 0 ? (
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
      ) : null}

      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(next) => (next || pending ? undefined : setUnlinking(null))}
        title={`Unlink ${unlinking?.name ?? 'integration'}?`}
        description={`This customer stops syncing with ${unlinking?.name ?? 'the provider'}. Nothing is deleted there, and you can link it again later.`}
        confirmLabel="Unlink"
        pendingLabel="Unlinking…"
        destructive
        isPending={pending}
        error={error}
        onConfirm={() =>
          unlinking &&
          void run(
            () => onUnlink({ providerType: unlinking.providerType }),
            () => setUnlinking(null),
          )
        }
      />
      <LinkDialog
        open={linking}
        providers={linkable}
        pending={pending}
        error={error}
        onClose={() => setLinking(false)}
        onSubmit={(input) =>
          void run(
            () => onLink(input),
            () => setLinking(false),
          )
        }
      />
    </div>
  )
}

function LinkDialog({
  open,
  providers,
  pending,
  error,
  onClose,
  onSubmit,
}: {
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
          if (!id) return setProblem('Enter the customer ID at the provider')
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
            hint="The id this customer already has at the provider, for example cus_123."
          >
            Customer ID at the provider
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

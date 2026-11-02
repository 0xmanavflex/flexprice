import { useState } from 'react'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { Field } from '@ui/compositions/forms/Field'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Switch } from '@ui/components/primitives/switch'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { provenance } from '@ui/provenance'

export const AddCardDialogProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/FormDialog',
    'compositions/detail/DetailKit',
    'compositions/Field',
    'compositions/OptionSelect',
    'ui/switch',
    'reui/code-block',
  ],
  note: "V1's Save card modal: pick a connected provider, create its hosted setup page, then open or copy the link.",
})

export interface AddCardProvider {
  providerType: string
  name: string
}

export interface AddCardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  /** Connected providers a card can be saved at. More than one shows a choice. */
  providers: AddCardProvider[]
  /** Creates the setup page and resolves to its address; reject with an Error to show it. */
  onCreateLink: (input: { provider: string; setDefault: boolean }) => Promise<string>
}

/**
 * Save a card for a customer. The card itself is entered on the provider's
 * hosted page, never here: this dialog asks where and whether it becomes the
 * default, then hands over the link to open now or send to the customer.
 */
export function AddCardDialog({
  open,
  onOpenChange,
  customerName,
  providers,
  onCreateLink,
}: AddCardDialogProps) {
  const [provider, setProvider] = useState(providers[0]?.providerType ?? '')
  const [setDefault, setSetDefault] = useState(true)
  const [link, setLink] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = providers.find((p) => p.providerType === provider) ?? providers[0]

  const close = () => {
    setProvider(providers[0]?.providerType ?? '')
    setSetDefault(true)
    setLink(null)
    setError(null)
    onOpenChange(false)
  }

  const submit = () => {
    if (!chosen) return
    setPending(true)
    setError(null)
    onCreateLink({ provider: chosen.providerType, setDefault })
      .then(setLink)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'The setup link could not be created.'),
      )
      .finally(() => setPending(false))
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Add card"
      description={
        link
          ? `Open the ${chosen?.name ?? 'provider'} page to enter the card, or send the link to ${customerName}.`
          : `Save a card for ${customerName} through a secure ${chosen?.name ?? 'provider'} page.`
      }
      size="sm"
      isPending={pending}
    >
      {link ? (
        <Composer
          submitLabel={`Open ${chosen?.name ?? 'setup'} page`}
          onSubmit={() => window.open(link, '_blank', 'noopener,noreferrer')}
          onCancel={close}
        >
          <CodeBlock code={link} language="text" label="Setup link">
            <CodeBlockHeader>
              <CodeBlockTitle>Setup link</CodeBlockTitle>
              <CodeBlockCopyButton className="ml-auto" />
            </CodeBlockHeader>
          </CodeBlock>
        </Composer>
      ) : (
        <Composer
          submitLabel="Create setup link"
          onSubmit={submit}
          onCancel={close}
          submitting={pending}
          disabled={!chosen}
        >
          {providers.length > 1 ? (
            <Field label="Payment provider" required>
              {(aria) => (
                <OptionSelect
                  id={aria.id}
                  value={provider}
                  onValueChange={setProvider}
                  options={providers.map((p) => ({ value: p.providerType, label: p.name }))}
                  aria-describedby={aria['aria-describedby']}
                  disabled={pending}
                />
              )}
            </Field>
          ) : null}
          <label className="flex items-center justify-between gap-3 text-sm">
            Make it the default payment method
            <Switch checked={setDefault} disabled={pending} onCheckedChange={setSetDefault} />
          </label>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </Composer>
      )}
    </FormDialog>
  )
}

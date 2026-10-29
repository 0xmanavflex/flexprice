import { useState } from 'react'
import { Controller, type Control, type FieldErrors, type Path } from 'react-hook-form'
import { EyeIcon, EyeOffIcon } from '@ui/icons'
import {
  type ConnectionField,
  type ConnectionFormValues,
  type ConnectionSpec,
  type Integration,
  type SyncOption,
  effectiveEntityId,
  syncKey,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Input } from '@ui/components/primitives/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@ui/components/primitives/input-group'
import { Switch } from '@ui/components/primitives/switch'
import { Textarea } from '@ui/components/primitives/textarea'
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@ui/components/reui/code-block/code-block'
import { Field } from '@ui/compositions/forms/Field'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { provenance } from '@ui/provenance'
import type { ListBillingEntity } from '../shared/billingEntityColumn'

/**
 * The pieces both connection sheets draw from a provider's spec: a field per
 * credential, a switch per sync direction, and the webhook address to register.
 * Nothing here knows which provider it is; `@fp/domain` `CONNECTION_SPECS` does.
 */
export const ConnectionFieldsProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/Field',
    'compositions/OptionSelect',
    'ui/input-group',
    'ui/textarea',
    'ui/switch',
    'reui/code-block',
  ],
  note: 'Schema-driven connection form parts: write-only secret inputs, sync switches and the webhook address.',
})

/** A password-style input with a show/hide control. Secrets are never echoed back by the API, so there is nothing to prefill. */
function SecretInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  label,
  ...aria
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string | undefined
  label: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: true | undefined
  required?: boolean | undefined
}) {
  const [shown, setShown] = useState(false)
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        {...aria}
      />
      <InputGroupAddon align="inline-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`${shown ? 'Hide' : 'Show'} ${label}`}
          aria-pressed={shown}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  )
}

export function SpecField<T extends { fields: Record<string, string> }>({
  field,
  control,
  errors,
  disabled,
}: {
  field: ConnectionField
  control: Control<T>
  errors: FieldErrors<T>
  disabled?: boolean
}) {
  const name = `fields.${field.key}` as Path<T>
  const message = (errors.fields as Record<string, { message?: string }> | undefined)?.[field.key]
    ?.message
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: raw }) => {
        const bound = raw as unknown as {
          value: string | undefined
          onChange: (value: string) => void
          onBlur: () => void
        }
        return (
          <Field
            label={field.label}
            required={field.required}
            error={message}
            {...(field.hint ? { hint: field.hint } : {})}
          >
            {(aria) => {
              if (field.kind === 'secret')
                return (
                  <SecretInput
                    {...aria}
                    value={bound.value ?? ''}
                    onChange={bound.onChange}
                    onBlur={bound.onBlur}
                    placeholder={field.placeholder}
                    label={field.label}
                  />
                )
              if (field.kind === 'select')
                return (
                  <OptionSelect
                    id={aria.id}
                    value={bound.value ?? ''}
                    onValueChange={bound.onChange}
                    options={field.options ?? []}
                    aria-describedby={aria['aria-describedby']}
                    aria-invalid={aria['aria-invalid']}
                    {...(disabled ? { disabled } : {})}
                  />
                )
              if (field.kind === 'textarea')
                return (
                  <Textarea
                    {...aria}
                    rows={6}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono text-xs"
                    placeholder={field.placeholder}
                    value={bound.value ?? ''}
                    onChange={(event) => bound.onChange(event.target.value)}
                    onBlur={bound.onBlur}
                  />
                )
              return (
                <Input
                  {...aria}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={bound.value ?? ''}
                  onChange={(event) => bound.onChange(event.target.value)}
                  onBlur={bound.onBlur}
                />
              )
            }}
          </Field>
        )
      }}
    />
  )
}

/** The entities a connection of this provider can belong to; one that already has another is shown but not choosable. */
export function BillingEntityField({
  integration,
  entities,
  connectionId,
  control,
  error,
  disabled,
}: {
  integration: Integration
  entities: readonly ListBillingEntity[]
  /** The connection being moved, which does not block its own entity. */
  connectionId?: string
  control: Control<ConnectionFormValues>
  error?: string | undefined
  disabled?: boolean
}) {
  const options = entities.map((entity) => {
    const holder = integration.connections.find(
      (item) => item.id !== connectionId && effectiveEntityId(item, entities) === entity.id,
    )
    return {
      value: entity.id,
      label: entity.name,
      ...(holder ? { disabled: true, hint: `Has ${holder.name}` } : {}),
    }
  })
  return (
    <Controller
      control={control}
      name="billingEntityId"
      render={({ field: bound }) => (
        <Field label="Billing entity" required error={error}>
          {(aria) => (
            <OptionSelect
              id={aria.id}
              value={bound.value ?? ''}
              onValueChange={bound.onChange}
              options={options}
              placeholder="Choose a billing entity"
              aria-describedby={aria['aria-describedby']}
              aria-invalid={aria['aria-invalid']}
              {...(disabled ? { disabled } : {})}
            />
          )}
        </Field>
      )}
    />
  )
}

/** One row per sync direction the provider supports, off unless the reader turns it on. */
export function SyncOptions({
  options,
  control,
}: {
  options: SyncOption[]
  control: Control<ConnectionFormValues>
}) {
  return (
    <ul className="divide-y rounded-lg border" aria-label="What to sync">
      {options.map((option) => {
        const key = syncKey(option)
        const labelId = `sync-${key.replace(':', '-')}`
        return (
          <li key={key} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <p id={labelId} className="text-sm font-medium">
                {option.label}
              </p>
              <p className="text-muted-foreground text-[13px]">{option.description}</p>
            </div>
            <Controller
              control={control}
              name={`sync.${key}`}
              render={({ field }) => (
                <Switch
                  aria-labelledby={labelId}
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** The address to register at the provider, and the events it should send. */
export function WebhookGuide({
  spec,
  url,
  events,
}: {
  spec: ConnectionSpec
  url: string
  events: string[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <CodeBlock code={url} language="text" label="Webhook URL">
        <CodeBlockHeader>
          <CodeBlockTitle>Webhook URL</CodeBlockTitle>
          <CodeBlockCopyButton />
        </CodeBlockHeader>
      </CodeBlock>
      {events.length > 0 ? (
        <CodeBlock code={events.join('\n')} language="text" label="Webhook events">
          <CodeBlockHeader>
            <CodeBlockTitle>
              {spec.providerType === 'chargebee' ? 'Event' : 'Events to send'}
            </CodeBlockTitle>
            <CodeBlockCopyButton />
          </CodeBlockHeader>
        </CodeBlock>
      ) : null}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { CircleAlertIcon, InfoIcon } from '@ui/icons'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  type CreateEnvironment,
  createEnvironmentSchema,
  emptyEnvironment,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { buttonVariants } from '@ui/components/primitives/button'
import { Field, FieldError, FieldGroup } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Alert, AlertAction, AlertDescription } from '@ui/components/reui/alert'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Create an environment, in a dialog.
 *
 * Two fields, and the second one is the whole point. Sandbox and Production are
 * not equivalent picks from a list, so they sit side by side as two small cards,
 * each with a two-line explainer of what it means, and the Create button below.
 *
 * Production is self-serve for almost nobody, so when it cannot be created here
 * the card stays selectable — choosing it is how someone asks for it — but
 * "Create environment" is disabled and a short "contact us" note with a Slack
 * link takes its place as the way forward.
 *
 * The chrome is the shared `FormDialog` with a `Composer` footer. It opens over
 * the page the person is already on.
 */
export const EnvironmentFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'ui/button',
    'ui/input',
    'ui/radio-group',
    'ui/field',
    '@reui/alert',
  ],
  note: 'Reference FormDialog and Composer. The type is a pair of side-by-side cards, not a select. Sandbox is the default.',
})

export interface EnvironmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue?: CreateEnvironment
  onSubmit: (environment: CreateEnvironment) => void
  isSubmitting?: boolean
  submitError?: string | null
  /**
   * Whether production can be created here at all. When false, the Production
   * card is still selectable, but selecting it disables create and shows the
   * contact note instead.
   */
  canCreateProduction?: boolean
  /** Where "Contact us" goes when production cannot be self-served. */
  contactHref?: string
}

/** Two lines at most each: what the environment is for, and what it costs to get wrong. */
const EXPLAINER: Record<CreateEnvironment['type'], string> = {
  [EnvironmentType.Sandbox]: 'For testing with fake data. Nothing is charged.',
  [EnvironmentType.Production]: 'Real customers and real money. Changes go live.',
}

const TYPES = [EnvironmentType.Sandbox, EnvironmentType.Production] as const

export function EnvironmentForm({
  open,
  onOpenChange,
  defaultValue = emptyEnvironment,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  canCreateProduction = true,
  contactHref,
}: EnvironmentFormProps) {
  const form = useForm<CreateEnvironment>({
    resolver: standardSchemaResolver(createEnvironmentSchema),
    defaultValues: defaultValue,
    mode: 'onSubmit',
  })

  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) form.reset(defaultValue)
    wasOpen.current = open
  }, [open, defaultValue, form])

  const type = form.watch('type')
  const typeError = form.formState.errors.type?.message
  const productionWithheld = type === EnvironmentType.Production && !canCreateProduction

  const submit = form.handleSubmit((value) => {
    // The disabled button is the lock; this is the bolt behind it, for a
    // submit that arrives by Enter in the name field.
    if (value.type === EnvironmentType.Production && !canCreateProduction) return
    onSubmit(value)
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmitting) return
        onOpenChange(next)
      }}
      size="sm"
      title="Create environment"
    >
      <Composer
        submitLabel={isSubmitting ? 'Creating…' : 'Create environment'}
        submitting={isSubmitting}
        disabled={productionWithheld}
        onCancel={() => onOpenChange(false)}
        onSubmit={() => void submit()}
      >
        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <LabelWithHint
              htmlFor="environment-name"
              hint="What this environment is called in the environment switcher."
            >
              Name
              <span aria-hidden className="text-destructive">
                *
              </span>
            </LabelWithHint>
            <Input
              id="environment-name"
              autoFocus
              placeholder="EU staging"
              disabled={isSubmitting}
              aria-invalid={form.formState.errors.name ? true : undefined}
              {...form.register('name')}
            />
            {form.formState.errors.name?.message ? (
              <FieldError>{form.formState.errors.name.message}</FieldError>
            ) : null}
          </Field>

          <Field className="gap-2">
            <LabelWithHint hint="A sandbox is for testing with fake data. Production handles real customers and real money.">
              Type
              <span aria-hidden className="text-destructive">
                *
              </span>
            </LabelWithHint>
            <fieldset className="flex flex-col gap-1.5" disabled={isSubmitting}>
              <legend className="sr-only">Type</legend>
              <RadioGroup
                value={type}
                onValueChange={(value) => form.setValue('type', value as CreateEnvironment['type'])}
                className="grid grid-cols-2 gap-3"
              >
                {TYPES.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                      type === option
                        ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <RadioGroupItem value={option} className="mt-0.5" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{ENVIRONMENT_TYPE_LABEL[option]}</span>
                      <span className="text-muted-foreground line-clamp-2 text-xs/relaxed">
                        {EXPLAINER[option]}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            {typeError ? <FieldError>{typeError}</FieldError> : null}
          </Field>
        </FieldGroup>

        {productionWithheld ? (
          // TODO(checkout): production becomes a paid upgrade. Replace this
          // contact note with the checkout flow and enable create once paid.
          <Alert>
            <InfoIcon aria-hidden className="text-muted-foreground" />
            <AlertDescription>
              Production is set up with our team. Contact us and we will enable it for you.
            </AlertDescription>
            {contactHref ? (
              <AlertAction>
                <a
                  href={contactHref}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Contact us on Slack
                </a>
              </AlertAction>
            ) : null}
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

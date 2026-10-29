import { useEffect, useRef } from 'react'
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  CircleAlertIcon,
  InfoIcon,
  MailIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from '@ui/icons'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  SANDBOX_AUTO_CANCELLATION_DAYS,
  type CreateEnvironment,
  createEnvironmentSchema,
  emptyEnvironment,
} from '@fp/domain'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { Button } from '@ui/components/primitives/button'
import { ButtonGroup } from '@ui/components/primitives/button-group'
import { Slack } from '@ui/components/primitives/svgs/slack'
import { Field, FieldError, FieldGroup } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/reui/alert'
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
 * the card stays selectable: choosing it is how someone asks for it: but
 * "Create environment" is disabled and V1's "requires an approval" note takes
 * its place, with V1's three ways to reach us: Slack, email, or a booked call.
 *
 * Where the workspace pays Flexprice itself (self-billing), production is the
 * upgrade: in the trial, choosing it shows what the upgrade costs and what it
 * brings, and the button becomes **Upgrade**: paying creates the production
 * environment (the API names it "Production"), so there is no name to type.
 * Once live with a production environment, choosing it says so and offers to
 * switch to it.
 *
 * A sandbox carries V1's warning: its subscriptions are cancelled after
 * `SANDBOX_AUTO_CANCELLATION_DAYS` days.
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
    'ui/button-group',
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
  /** How to reach us when production cannot be self-served (V1's Slack, email and call). */
  contact?: EnvironmentContact
  /**
   * Self-billing's answer for Production, which takes precedence over
   * `canCreateProduction`: in the trial it is the upgrade; once live with a
   * production environment it is that environment.
   */
  production?: ProductionOffer
}

export type ProductionOffer =
  | {
      kind: 'upgrade'
      /** The trial's event cap, for "The 50,000 event limit is lifted". */
      eventCap: number | null
      /** The plan's price as the API reports it ("$199.00 a month + …"). Null while unknown. */
      price: string | null
      onUpgrade: () => void
    }
  | {
      kind: 'exists'
      /** The production environment's name. */
      name: string
      onSwitch: () => void
    }

/** Each option is shown only when it has a value; a deployment can hide any of them. */
export interface EnvironmentContact {
  slackUrl?: string | null | undefined
  email?: string | null | undefined
  bookCallUrl?: string | null | undefined
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
  contact,
  production,
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
  const isProduction = type === EnvironmentType.Production
  const upgrade = isProduction && production?.kind === 'upgrade' ? production : null
  const existing = isProduction && production?.kind === 'exists' ? production : null
  const productionWithheld = isProduction && !upgrade && (Boolean(existing) || !canCreateProduction)
  const hasContact = Boolean(contact?.slackUrl || contact?.email || contact?.bookCallUrl)

  const submit = form.handleSubmit((value) => {
    // The disabled button is the lock; this is the bolt behind it, for a
    // submit that arrives by Enter in the name field.
    if (value.type === EnvironmentType.Production && productionWithheld) return
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
        submitLabel={upgrade ? 'Upgrade' : isSubmitting ? 'Creating…' : 'Create environment'}
        submitting={isSubmitting}
        disabled={productionWithheld}
        onCancel={() => onOpenChange(false)}
        // Upgrading creates the environment, so there is nothing of the form to check.
        onSubmit={() => (upgrade ? upgrade.onUpgrade() : void submit())}
      >
        <FieldGroup className="gap-4">
          {upgrade ? null : (
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
          )}

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

        {type === EnvironmentType.Sandbox ? (
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>
              Sandbox subscriptions are automatically cancelled after{' '}
              {SANDBOX_AUTO_CANCELLATION_DAYS} days.
            </AlertDescription>
          </Alert>
        ) : null}

        {upgrade ? (
          <section
            aria-label="Production comes with an upgrade"
            className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex items-start gap-2.5">
              <SparklesIcon aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Production comes with an upgrade</p>
                {upgrade.price ? (
                  <p className="text-muted-foreground text-[13px]">{upgrade.price}, in production.</p>
                ) : null}
              </div>
            </div>
            <ul className="flex flex-col gap-1.5 pl-6.5 text-[13px]">
              {[
                'A production environment is created',
                `The ${upgrade.eventCap?.toLocaleString('en-US') ?? 'trial'} event limit is lifted`,
                'Your sandbox stays as it is',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <CheckIcon aria-hidden className="text-success mt-0.5 size-3.5 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground pl-6.5 text-xs">
              It is named Production; you can rename it afterwards.
            </p>
          </section>
        ) : null}

        {existing ? (
          <Alert variant="info">
            <InfoIcon aria-hidden />
            <AlertTitle>You already have a production environment.</AlertTitle>
            <AlertDescription>{existing.name} is yours. Need another? Contact us.</AlertDescription>
            <div className="col-start-2 mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  existing.onSwitch()
                  onOpenChange(false)
                }}
              >
                Switch to {existing.name}
                <ArrowRightIcon aria-hidden />
              </Button>
              {contact ? (
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`mailto:${contact.email}`} role="link" />}
                >
                  <MailIcon aria-hidden />
                  Email us
                </Button>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {productionWithheld && !existing ? (
          <Alert variant="info">
            <InfoIcon aria-hidden />
            <AlertTitle>Production environments require an approval.</AlertTitle>
            <AlertDescription>
              {hasContact
                ? 'Contact us to get started:'
                : 'Contact your administrator to get started.'}
            </AlertDescription>
            {hasContact ? (
              <ButtonGroup aria-label="Contact us" className="col-start-2 mt-2">
                {contact?.slackUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={contact.slackUrl} target="_blank" rel="noreferrer" role="link" />
                    }
                  >
                    <Slack aria-hidden className="size-4" />
                    Slack
                  </Button>
                ) : null}
                {contact?.email ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={`mailto:${contact.email}`} role="link" />}
                  >
                    <MailIcon aria-hidden />
                    Email
                  </Button>
                ) : null}
                {contact?.bookCallUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={contact.bookCallUrl} target="_blank" rel="noreferrer" role="link" />
                    }
                  >
                    <CalendarIcon aria-hidden />
                    Book a call
                  </Button>
                ) : null}
              </ButtonGroup>
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

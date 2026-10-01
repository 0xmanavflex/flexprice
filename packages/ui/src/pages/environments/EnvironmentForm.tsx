import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import {
  ENVIRONMENT_TYPE_DESCRIPTION,
  ENVIRONMENT_TYPE_LABEL,
  EnvironmentType,
  type CreateEnvironment,
  createEnvironmentSchema,
  emptyEnvironment,
} from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/primitives/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

/**
 * Create an environment, in a dialog.
 *
 * Two fields, and the second one is the whole point. Production and Sandbox
 * are not equivalent picks from a list, so each is a card carrying one line
 * about what it means. Creating production can be withheld — most tenants
 * arrange it rather than self-serving it. When it is, the option stays visible
 * and disabled with the reason attached.
 *
 * The chrome is the ReUI dialog: title, description, fields, and the muted
 * footer bar. It opens over the page the person is already on.
 */
export const EnvironmentFormProvenance = provenance({
  source: 'composition',
  composes: ['ui/dialog', 'ui/input', 'ui/radio-group', 'ui/field', '@reui/alert'],
  note: 'ReUI dialog. The type is a pair of one-line cards, not a select. Sandbox is the default.',
})

export interface EnvironmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValue?: CreateEnvironment
  onSubmit: (environment: CreateEnvironment) => void
  isSubmitting?: boolean
  submitError?: string | null
  /**
   * Whether production can be created here at all. When false, the reason is
   * required — a disabled control with no explanation is just a broken one.
   */
  canCreateProduction?: boolean
  productionUnavailableReason?: string
}

const FORM_ID = 'environment-form'

const TYPES = [EnvironmentType.Sandbox, EnvironmentType.Production] as const

export function EnvironmentForm({
  open,
  onOpenChange,
  defaultValue = emptyEnvironment,
  onSubmit,
  isSubmitting = false,
  submitError = null,
  canCreateProduction = true,
  productionUnavailableReason,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmitting) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create environment</DialogTitle>
          <DialogDescription>
            Data does not cross between environments. A sandbox is the safe default; production is
            real customers and real money.
          </DialogDescription>
        </DialogHeader>

        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit((value) => {
            if (value.type === EnvironmentType.Production && !canCreateProduction) {
              form.setError('type', {
                message: productionUnavailableReason ?? 'Production cannot be created here.',
              })
              return
            }
            onSubmit(value)
          })}
          noValidate
        >
          <FieldGroup className="gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="environment-name">
                Name
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </FieldLabel>
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
              <FieldLabel>
                Type
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <fieldset className="flex flex-col gap-1.5" disabled={isSubmitting}>
                <legend className="sr-only">Type</legend>
                <RadioGroup
                  value={type}
                  onValueChange={(value) => form.setValue('type', value as CreateEnvironment['type'])}
                  className="grid gap-1.5"
                >
                  {TYPES.map((option) => {
                    const isProduction = option === EnvironmentType.Production
                    const disabled = isProduction && !canCreateProduction

                    return (
                      <label
                        key={option}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors',
                          type === option && 'border-primary/40 bg-accent/50',
                          disabled && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <RadioGroupItem value={option} disabled={disabled} />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm font-medium">{ENVIRONMENT_TYPE_LABEL[option]}</span>
                          <span className="text-muted-foreground text-xs">
                            {disabled && productionUnavailableReason
                              ? productionUnavailableReason
                              : ENVIRONMENT_TYPE_DESCRIPTION[option]}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </RadioGroup>
              </fieldset>
              {typeError ? <FieldError>{typeError}</FieldError> : null}
            </Field>
          </FieldGroup>
        </form>

        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create environment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

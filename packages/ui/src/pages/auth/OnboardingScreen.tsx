import { useId } from 'react'
import { type Resolver } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { REFERRAL_SOURCES, type TenantOnboarding, tenantOnboardingSchema } from '@fp/domain'
import { Button } from '@ui/components/primitives/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { RadioGroup, RadioGroupItem } from '@ui/components/primitives/radio-group'
import { Spinner } from '@ui/components/primitives/spinner'
import { useCalmForm } from '@ui/compositions/forms/useCalmForm'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'
import { AuthFrame, FormHead } from './AuthFrame'

export const OnboardingScreenProvenance = provenance({
  source: 'composition',
  composes: [
    'pages/auth/AuthFrame',
    'ui/field',
    'ui/input',
    'ui/radio-group',
    'ui/spinner',
    'ui/button',
  ],
  note: 'Tenant onboarding from the dashboard redesign (OnboardingPage): three questions in AuthFrame, the Vapi review on the right. The referral chips are radio-group items, as EnvironmentForm draws its choice cards.',
})

export interface OnboardingScreenProps {
  onSubmit: (answers: TenantOnboarding) => void
  /** The tenant is being saved: the form gives way to "Setting up …". */
  isSubmitting?: boolean
  /** A failure, already a sentence. */
  error?: string | null
  /** Prefills the organization name, e.g. the tenant name sign-up created. */
  defaultOrgName?: string
}

/**
 * The three questions a new workspace answers once, after sign-up and before
 * Home: organization name, website, and how they found Flexprice. The same
 * questions and name rules as V1 (`@fp/domain` `tenantOnboardingSchema`).
 */
export function OnboardingScreen({
  onSubmit,
  isSubmitting = false,
  error = null,
  defaultOrgName = '',
}: OnboardingScreenProps) {
  const form = useCalmForm<TenantOnboarding>({
    resolver: standardSchemaResolver(tenantOnboardingSchema) as Resolver<TenantOnboarding>,
    defaultValues: { orgName: defaultOrgName, orgUrl: '', referralSource: '' },
  })
  const errors = form.formState.errors
  const source = form.watch('referralSource')
  const orgId = useId()
  const urlId = useId()
  const sourceId = useId()
  const errorId = (id: string, present: boolean) => (present ? `${id}-error` : undefined)

  if (isSubmitting) {
    const name = form.getValues('orgName').trim()
    return (
      <AuthFrame quote="vapi">
        <div
          className="flex flex-col items-center gap-4 py-24 text-center"
          role="status"
          aria-live="polite"
        >
          <Spinner className="text-muted-foreground size-8" aria-hidden />
          <p className="text-sm">
            {name ? `Setting up ${name}'s workspace…` : 'Setting up your workspace…'}
          </p>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame quote="vapi">
      <form
        onSubmit={form.handleSubmit((answers) => onSubmit(answers))}
        noValidate
        aria-labelledby="onboarding-heading"
        className="flex w-full flex-col gap-6"
      >
        <FormHead
          id="onboarding-heading"
          title="Welcome to Flexprice"
          description="Three quick questions to set up your workspace."
        />

        {error ? (
          <p
            role="alert"
            className="border-destructive/20 bg-destructive/10 text-destructive-foreground dark:text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <FieldGroup className="gap-5">
          <Field data-invalid={errors.orgName ? true : undefined}>
            <FieldLabel htmlFor={orgId}>Organization name</FieldLabel>
            <Input
              id={orgId}
              autoComplete="organization"
              placeholder="Acme Robotics"
              className="h-9"
              aria-invalid={errors.orgName ? true : undefined}
              aria-describedby={errorId(orgId, Boolean(errors.orgName))}
              {...form.register('orgName')}
            />
            {errors.orgName?.message ? (
              <FieldError id={`${orgId}-error`} className="text-xs">
                {errors.orgName.message}
              </FieldError>
            ) : null}
          </Field>

          <Field data-invalid={errors.orgUrl ? true : undefined}>
            <FieldLabel htmlFor={urlId}>Website</FieldLabel>
            <Input
              id={urlId}
              type="url"
              autoComplete="url"
              placeholder="https://acme.com"
              className="h-9"
              aria-invalid={errors.orgUrl ? true : undefined}
              aria-describedby={errorId(urlId, Boolean(errors.orgUrl))}
              {...form.register('orgUrl')}
            />
            {errors.orgUrl?.message ? (
              <FieldError id={`${urlId}-error`} className="text-xs">
                {errors.orgUrl.message}
              </FieldError>
            ) : null}
          </Field>

          <Field data-invalid={errors.referralSource ? true : undefined}>
            <FieldLabel id={sourceId}>How did you find us?</FieldLabel>
            <RadioGroup
              value={source}
              onValueChange={(value) =>
                form.setValue('referralSource', String(value), {
                  shouldValidate: form.formState.isSubmitted,
                })
              }
              aria-labelledby={sourceId}
              aria-describedby={errorId(sourceId, Boolean(errors.referralSource))}
              className="flex flex-wrap gap-2"
            >
              {REFERRAL_SOURCES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] transition-colors',
                    source === option.value
                      ? 'border-primary/60 bg-primary/4 ring-primary/20 ring-2'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
            {errors.referralSource?.message ? (
              <FieldError id={`${sourceId}-error`} className="text-xs">
                {errors.referralSource.message}
              </FieldError>
            ) : null}
          </Field>
        </FieldGroup>

        <Button type="submit" className="h-9">
          Get started
        </Button>
      </form>
    </AuthFrame>
  )
}

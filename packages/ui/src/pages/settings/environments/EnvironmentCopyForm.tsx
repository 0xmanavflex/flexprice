import { useEffect, useRef, useState } from 'react'
import { CircleCheckIcon, ClockIcon, InfoIcon, TriangleAlertIcon } from '@ui/icons'
import { LabelWithHint } from '@ui/compositions/forms/LabelWithHint'
import { Composer } from '@ui/compositions/detail/DetailKit'
import { FormDialog } from '@ui/compositions/forms/FormDialog'
import { OptionSelect } from '@ui/compositions/forms/OptionSelect'
import { Field, FieldError, FieldGroup } from '@ui/components/primitives/field'
import { Input } from '@ui/components/primitives/input'
import { Alert, AlertDescription } from '@ui/components/reui/alert'
import { provenance } from '@ui/provenance'

/**
 * Copy an environment's published plans and features into another, in a dialog.
 *
 * V1's "Copy environment", and the way a sandbox setup is taken live: from a
 * sandbox the target starts on Production, so promoting is one confirm. The
 * target is an existing environment or a new sandbox; a new production
 * environment is not offered, because creating one goes through approval or
 * the upgrade in "Create environment".
 *
 * The copy skips anything whose lookup key the target already has, so the
 * dialog says plainly that running it again adds only what is new and does not
 * update what was copied before.
 */
export const EnvironmentCopyFormProvenance = provenance({
  source: 'composition',
  composes: [
    'compositions/form-dialog',
    'compositions/detail-kit',
    'compositions/option-select',
    'ui/input',
    'ui/field',
    '@reui/alert',
  ],
  note: 'Same FormDialog and Composer as Create environment. Target select defaults to Production from a sandbox.',
})

export interface CopyableEnvironment {
  id: string
  name: string
  kind: 'production' | 'sandbox'
}

export type EnvironmentCopyTarget = { targetEnvironmentId: string } | { name: string }

export interface EnvironmentCopyFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The environment being copied: the one the console is in. */
  source: CopyableEnvironment
  /** Every environment; the source is left out of the targets. */
  environments: readonly CopyableEnvironment[]
  onSubmit: (target: EnvironmentCopyTarget) => void
  isSubmitting?: boolean
  submitError?: string | null
}

const NEW_SANDBOX = '__new_sandbox__'

/** What the copy carries, as V1 lists it. */
const COPIED = [
  {
    title: 'All active features',
    description: 'Static, boolean and metered features, with their meters',
  },
  {
    title: 'All active plans',
    description: 'With every price, entitlement and credit grant on each plan',
  },
] as const

/** From a sandbox, Production first: that is what taking a setup live means. */
function defaultTarget(source: CopyableEnvironment, targets: readonly CopyableEnvironment[]) {
  if (source.kind === 'sandbox') {
    const production = targets.find((environment) => environment.kind === 'production')
    if (production) return production.id
  }
  return targets[0]?.id ?? NEW_SANDBOX
}

export function EnvironmentCopyForm({
  open,
  onOpenChange,
  source,
  environments,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: EnvironmentCopyFormProps) {
  const targets = environments.filter((environment) => environment.id !== source.id)
  const [targetId, setTargetId] = useState(() => defaultTarget(source, targets))
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  // Fresh each time it opens, so a previous run's choice does not linger.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTargetId(defaultTarget(source, targets))
      setName('')
      setNameError(null)
    }
    wasOpen.current = open
  }, [open, source, targets])

  const isNew = targetId === NEW_SANDBOX
  const target = targets.find((environment) => environment.id === targetId)
  const toProduction = target?.kind === 'production'

  const submit = () => {
    if (isNew) {
      if (!name.trim()) {
        setNameError('Name the new sandbox.')
        return
      }
      onSubmit({ name: name.trim() })
      return
    }
    onSubmit({ targetEnvironmentId: targetId })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isSubmitting) return
        onOpenChange(next)
      }}
      size="sm"
      title="Copy environment"
    >
      <Composer
        submitLabel={isSubmitting ? 'Copying…' : 'Copy plans and features'}
        submitting={isSubmitting}
        onCancel={() => onOpenChange(false)}
        onSubmit={submit}
      >
        <p className="text-muted-foreground text-[13px]">
          Copies from <strong className="text-foreground font-medium">{source.name}</strong>{' '}
          {isNew ? 'into a new environment.' : 'into the environment you choose.'}
        </p>

        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertDescription>
            Everything active is copied as it is. Archive anything you do not want carried over
            before you copy.
          </AlertDescription>
        </Alert>

        <FieldGroup className="gap-4">
          <Field className="gap-2">
            <LabelWithHint
              htmlFor="copy-target"
              hint="An existing environment, or a new sandbox made for the copy."
            >
              Copy into
            </LabelWithHint>
            <OptionSelect
              id="copy-target"
              value={targetId}
              onValueChange={setTargetId}
              disabled={isSubmitting}
              options={[
                ...targets.map((environment) => ({
                  value: environment.id,
                  label: environment.name,
                  hint: environment.kind === 'production' ? 'Production' : 'Sandbox',
                })),
                {
                  value: NEW_SANDBOX,
                  label: 'Create a new environment',
                  hint: 'A new sandbox for the copy',
                },
              ]}
            />
          </Field>

          {isNew ? (
            <Field className="gap-2">
              <LabelWithHint htmlFor="copy-name" hint="What the new sandbox is called.">
                New environment name
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </LabelWithHint>
              <Input
                id="copy-name"
                autoFocus
                placeholder="For example Staging"
                value={name}
                disabled={isSubmitting}
                aria-invalid={nameError ? true : undefined}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameError(null)
                }}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
          ) : null}
        </FieldGroup>

        {toProduction ? (
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>
              The plans go live in {target.name}: customers there can be put on them as soon as the
              copy finishes.
            </AlertDescription>
          </Alert>
        ) : null}

        <section aria-labelledby="copy-what" className="overflow-hidden rounded-lg border">
          <h3
            id="copy-what"
            className="bg-muted/40 text-muted-foreground border-b px-4 py-2.5 text-xs tracking-wide uppercase"
          >
            What will be copied
          </h3>
          <ul className="divide-y">
            {COPIED.map((item) => (
              <li key={item.title} className="flex items-start gap-3 px-4 py-3">
                <CircleCheckIcon aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-[13px]">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="bg-muted/40 text-muted-foreground border-t px-4 py-2.5 text-[13px]">
            Drafts, archived items, customers, contracts, invoices and wallet balances are not
            copied.
            {isNew
              ? null
              : ` Anything whose lookup key ${target?.name ?? 'the target'} already has is skipped, so running it again adds only what is new; plans copied before are not updated.`}
          </p>
        </section>

        <p className="text-muted-foreground flex items-start gap-2 text-[13px]">
          <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {isNew
            ? 'The environment is created at once. Features and plans are copied in the background and can take a few minutes to appear.'
            : 'Features and plans are copied in the background and can take a few minutes to appear.'}
        </p>

        {submitError ? (
          <p role="alert" className="text-destructive text-sm">
            {submitError}
          </p>
        ) : null}
      </Composer>
    </FormDialog>
  )
}

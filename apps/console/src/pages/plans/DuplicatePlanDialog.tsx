import { useState } from 'react'
import { type Plan } from '@fp/domain'
import { useClonePlan } from '@fp/query'
import { Field, FormDialog } from '@fp/ui/compositions'
import { Button, Input } from '@fp/ui/primitives'

export interface DuplicatePlanDialogProps {
  /** The plan to copy; null keeps the dialog closed. */
  plan: Plan | null
  onClose: () => void
  /** The copy exists; open it. */
  onDuplicated: (planId: string) => void
}

/**
 * Duplicating a plan, as V1 did it: the copy gets its own name, lookup key and
 * description before it is made, and carries the original's metadata. The
 * charges, entitlements and credit grants are copied by the API.
 */
export function DuplicatePlanDialog({ plan, onClose, onDuplicated }: DuplicatePlanDialogProps) {
  return plan ? (
    <DuplicateForm key={plan.id} plan={plan} onClose={onClose} onDuplicated={onDuplicated} />
  ) : null
}

function DuplicateForm({
  plan,
  onClose,
  onDuplicated,
}: {
  plan: Plan
  onClose: () => void
  onDuplicated: (planId: string) => void
}) {
  const clone = useClonePlan()
  const [name, setName] = useState(`${plan.name} (copy)`)
  const [lookupKey, setLookupKey] = useState(plan.lookupKey ? `${plan.lookupKey}-copy` : '')
  const [description, setDescription] = useState(plan.description)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) return setProblem('Enter a name for the copy')
    setProblem(null)
    clone.mutate(
      {
        id: plan.id,
        name: name.trim(),
        lookupKey: lookupKey.trim(),
        description: description.trim(),
        metadata: plan.metadata,
      },
      {
        onSuccess: (result) => {
          const id = (result as { id?: string } | undefined)?.id
          onClose()
          if (id) onDuplicated(id)
        },
      },
    )
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => (open || clone.isPending ? undefined : onClose())}
      title={`Duplicate ${plan.name}`}
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field label="Name" required {...(problem ? { error: problem } : {})}>
          {({ id, ...field }) => (
            <Input
              id={id}
              value={name}
              disabled={clone.isPending}
              onChange={(event) => setName(event.target.value)}
              {...field}
            />
          )}
        </Field>
        <Field label="Lookup key" hint="Optional. A stable key to reference the copy by.">
          {({ id, ...field }) => (
            <Input
              id={id}
              value={lookupKey}
              disabled={clone.isPending}
              onChange={(event) => setLookupKey(event.target.value)}
              {...field}
            />
          )}
        </Field>
        <Field label="Description" hint="Optional.">
          {({ id, ...field }) => (
            <Input
              id={id}
              value={description}
              disabled={clone.isPending}
              onChange={(event) => setDescription(event.target.value)}
              {...field}
            />
          )}
        </Field>
        <p className="text-muted-foreground text-xs">
          Charges, entitlements, credit grants and metadata are copied too.
        </p>
        {clone.isError ? (
          <p role="alert" className="text-destructive text-sm">
            The plan could not be duplicated. Check the lookup key is not taken, then try again.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={clone.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={clone.isPending}>
            {clone.isPending ? 'Duplicating…' : 'Duplicate plan'}
          </Button>
        </div>
      </form>
    </FormDialog>
  )
}

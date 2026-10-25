import { useId } from 'react'
import { Checkbox } from '@ui/components/primitives/checkbox'
import { cn } from '@ui/lib/cn'
import { provenance } from '@ui/provenance'

export const CheckboxRowProvenance = provenance({
  source: 'composition',
  composes: ['ui/checkbox'],
  note: 'The stock Checkbox with its label wired by id, for a yes/no that reads as a sentence.',
})

export interface CheckboxRowProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  children: string
  /** A muted line under the label, for a choice that needs a sentence. */
  description?: string | undefined
}

export function CheckboxRow({
  checked,
  onCheckedChange,
  disabled,
  className,
  children,
  description,
}: CheckboxRowProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  return (
    <div className={cn('flex gap-2', description ? 'items-start' : 'items-center', className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={!!disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        {...(description ? { 'aria-describedby': descriptionId, className: 'mt-0.5' } : {})}
      />
      {description ? (
        <div className="space-y-0.5">
          <label htmlFor={id} className="block text-sm">
            {children}
          </label>
          <p id={descriptionId} className="text-muted-foreground text-xs">
            {description}
          </p>
        </div>
      ) : (
        <label htmlFor={id} className="text-sm">
          {children}
        </label>
      )}
    </div>
  )
}

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
}

export function CheckboxRow({
  checked,
  onCheckedChange,
  disabled,
  className,
  children,
}: CheckboxRowProps) {
  const id = useId()
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={!!disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <label htmlFor={id} className="text-sm">
        {children}
      </label>
    </div>
  )
}

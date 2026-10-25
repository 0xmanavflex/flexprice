import type { ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from '@ui/icons'
import { Button } from '@ui/components/primitives/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/primitives/dropdown-menu'
import { provenance } from '@ui/provenance'

/**
 * Sorting, as a menu rather than only as a column header.
 *
 * The header carets stay: they are the faster control once you can see the
 * column. This exists for when you cannot: a nine-column grid scrolled
 * sideways, or a narrow window where the column you want to sort by is off
 * screen. Two radio groups rather than a list of "Name A–Z, Name Z–A, …",
 * because field and direction are independent and pairing them doubles the
 * options for no gain.
 *
 * Controlled. The route owns the sort, so this and the column headers are
 * reading the same value and cannot disagree.
 */
export const SortMenuProvenance = provenance({
  source: 'composition',
  composes: ['ui/dropdown-menu', 'ui/button'],
  note: 'Field and direction as two radio groups, for when the header is off screen.',
})

export interface SortOption<T extends string> {
  value: T
  label: string
}

export interface SortMenuProps<T extends string> {
  options: SortOption<T>[]
  field: T
  direction: 'asc' | 'desc'
  onChange: (field: T, direction: 'asc' | 'desc') => void
  /** Which edge to line the menu up with. Match the trigger's side. */
  align?: 'start' | 'end'
  /**
   * What opens the menu. Defaults to the outline "Sort" button below.
   *
   * Additive and optional: `EntityList`'s toolbar is a row of equal icon
   * buttons, and the label would make Sort the odd one out. Whatever is passed
   * must still say what the current sort is: the default's `aria-label` is
   * the model.
   */
  trigger?: ReactNode
}

export function SortMenu<T extends string>({
  options,
  field,
  direction,
  onChange,
  align = 'start',
  trigger,
}: SortMenuProps<T>) {
  const current = options.find((option) => option.value === field)

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger render={trigger as never} />
      ) : (
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              // The current sort is in the name, so it does not need to be read
              // off the screen to be known.
              aria-label={`Sort by ${current?.label ?? field}, ${
                direction === 'asc' ? 'ascending' : 'descending'
              }. Change sorting`}
            />
          }
        >
          <ArrowUpDownIcon aria-hidden className="size-4" />
        </DropdownMenuTrigger>
      )}

      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={field}
            onValueChange={(value) => onChange(value as T, direction)}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={direction}
            onValueChange={(value) => onChange(field, value as 'asc' | 'desc')}
          >
            <DropdownMenuRadioItem value="asc">
              <ArrowUpIcon aria-hidden className="size-4" />
              Ascending
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              <ArrowDownIcon aria-hidden className="size-4" />
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

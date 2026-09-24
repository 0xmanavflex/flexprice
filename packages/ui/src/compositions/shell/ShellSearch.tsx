import { useId, useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { Button } from '@ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@ui/primitives/dialog'
import { Input } from '@ui/primitives/input'

/**
 * Search that survives a narrow header, from `@reui/app-shell-16`.
 *
 * Two sidebars leave this header around 450px at `md`, where an inline field
 * crushes the rest of the row — so below `lg` the field collapses to an icon
 * button opening the same search in a dialog. Search stays reachable at every
 * width; only its surface changes.
 */
export function ShellSearch({ onSearch }: { onSearch?: (term: string) => void }) {
  const [open, setOpen] = useState(false)
  const inputId = useId()

  return (
    <>
      <form
        role="search"
        className="relative hidden w-48 lg:block"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch?.(new FormData(event.currentTarget).get('q')?.toString() ?? '')
        }}
      >
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <Input name="q" aria-label="Search" placeholder="Search" className="h-9 pl-9" />
      </form>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Find a customer, invoice, plan or feature.</DialogDescription>
          </DialogHeader>
          <Input
            id={inputId}
            autoFocus
            aria-label="Search"
            placeholder="Search"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              onSearch?.(event.currentTarget.value)
              setOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

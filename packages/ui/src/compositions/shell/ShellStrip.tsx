import { ArrowUpRightIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'

/**
 * A one-line strip under the shell's top bar: a sentence and one link.
 *
 * It is always there, not dismissible, and it scrolls with the page like the
 * bar above it. Today it carries "Go back to old UI", so anyone moving to the
 * new console can step back while V1 still runs; the old console carries the
 * mirror, "Take me to the new UI".
 */
export const ShellStripProvenance = provenance({
  source: 'composition',
  composes: [],
  note: 'A full-width notice row under the shell header; one sentence and one outbound link.',
})

export interface ShellStripProps {
  message: string
  actionLabel: string
  href: string
}

export function ShellStrip({ message, actionLabel, href }: ShellStripProps) {
  return (
    <div className="bg-muted/60 shrink-0 border-b">
      <div className="text-muted-foreground mx-auto flex min-h-9 w-full max-w-[var(--shell-max)] min-w-0 flex-wrap items-center justify-center gap-x-2 px-6 py-1 text-xs">
        <span>{message}</span>
        {/* A link, not a Button: it leaves for another site, and Button would
            announce it as a button. Styled as Button's link variant. */}
        <a
          href={href}
          className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          {actionLabel}
          <ArrowUpRightIcon aria-hidden className="size-3" />
        </a>
      </div>
    </div>
  )
}

import { type ReactNode, useId } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/components/primitives/tooltip'
import { InfoIcon } from '@ui/icons'
import { provenance } from '@ui/provenance'

export const SettingsBlockProvenance = provenance({
  source: 'composition',
  composes: ['ui/tooltip'],
  note: 'The settings region (untitled bordered surface, info strip, footer actions) and the delayed hint, moved from the console panel kit.',
})

/**
 * One settings region: a bordered surface with no visible header.
 *
 * Settings opens straight onto its content, so there is no titled card above
 * a form any more. `label` still names the region for assistive tech (an
 * `sr-only` heading), `info` is the one explanatory block a form may carry at
 * its top, and `actions` land in the footer bar. `flush` drops the body
 * padding, for rows that pad themselves (`SettingRow`, `FormRow`).
 */
export function SettingsBlock({
  label,
  info,
  actions,
  flush = false,
  children,
}: {
  label: string
  info?: ReactNode
  actions?: ReactNode
  flush?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="bg-background flex min-w-0 flex-col overflow-hidden rounded-xl border"
    >
      <h3 id={id} className="sr-only">
        {label}
      </h3>
      {info ? <InfoBlock>{info}</InfoBlock> : null}
      <div className={flush ? 'min-w-0' : 'flex min-w-0 flex-col gap-4 overflow-x-auto px-5 py-4'}>
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
          {actions}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The info block a form-type setting may open with: what the fields add up to,
 * said once, above them. Not a subtitle: it is part of the form's content.
 */
export function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 border-b px-5 py-3 text-[13px]">
      <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  )
}

/** How long a hover has to last before a settings hint appears. */
export const HINT_DELAY_MS = 3000

/**
 * A one-line explanation, on hover, after a deliberate pause.
 *
 * Settings has no subtitles: the empty states do the educating. Where one line
 * really helps, it waits here: three seconds of hovering, so it never gets in
 * the way of someone who already knows. With `children` the hint hangs off
 * them (a button, a label); without, it hangs off a small (i).
 */
export function DelayedHint({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={HINT_DELAY_MS}
        render={
          children ? (
            <span className="inline-flex" />
          ) : (
            <span
              role="img"
              aria-label={text}
              className="text-muted-foreground inline-flex size-4 shrink-0 items-center justify-center"
            />
          )
        }
      >
        {children ?? <InfoIcon aria-hidden className="size-3.5" />}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

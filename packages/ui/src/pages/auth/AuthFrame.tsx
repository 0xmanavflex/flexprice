import type { ReactNode } from 'react'
import { AUTH_IMAGES } from '@ui/assets/auth'
import { provenance } from '@ui/provenance'
import { ReviewPanel } from './ReviewPanel'

/**
 * The frame every sign-in screen shares, after the dashboard redesign: the
 * Flexprice mark top left, the form left-aligned in the middle of the column
 * (400px at most), the copyright at the foot, and the review panel on the
 * right. Below `lg` the review panel is dropped and the form has the screen.
 */
export const AuthFrameProvenance = provenance({
  source: 'composition',
  composes: ['pages/auth/ReviewPanel'],
  note: 'Auth split layout from the dashboard redesign (block-ref auth-11 for the form column).',
})

export interface AuthFrameProps {
  children: ReactNode
  /** Which review the panel opens on, by id (`optimality`, `truffle`, `vapi`…). */
  quote?: string
  /** Extra links in the footer, after the copyright. */
  footer?: ReactNode
}

export function AuthFrame({ children, quote, footer }: AuthFrameProps) {
  return (
    <div className="bg-background grid min-h-svh lg:h-svh lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:overflow-hidden">
      <section className="flex min-h-svh min-w-0 flex-col px-6 py-8 sm:px-10 lg:h-svh lg:min-h-0 lg:overflow-y-auto">
        <header>
          <img
            src={AUTH_IMAGES.logoMark}
            alt="Flexprice"
            className="size-9 dark:brightness-0 dark:invert"
          />
        </header>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <footer className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span>© {new Date().getFullYear()} Flexprice AI, Inc.</span>
          {footer}
        </footer>
      </section>
      <ReviewPanel {...(quote ? { start: quote } : {})} />
    </div>
  )
}

/** Heading and one line under it, left-aligned: the top of every form. */
export function FormHead({
  title,
  description,
  id,
}: {
  title: string
  description: ReactNode
  id?: string
}) {
  return (
    <div className="mb-2 flex flex-col gap-2">
      <h1 id={id} className="text-[26px]/[1.2] font-medium tracking-tight text-balance">
        {title}
      </h1>
      <p className="text-muted-foreground text-[15px]">{description}</p>
    </div>
  )
}

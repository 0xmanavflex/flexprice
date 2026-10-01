import type { ReactNode } from 'react'

export interface PlanTabCardProps {
  title: string
  description: string
  /** The primary action, usually "Add …". */
  action?: ReactNode
  children: ReactNode
}

/** The shared frame of a plan tab: a titled card whose body (a table or list) runs edge to edge. */
export function PlanTabCard({ title, description, action, children }: PlanTabCardProps) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <header className="flex items-start justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

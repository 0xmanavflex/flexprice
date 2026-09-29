import { useNavigate } from '@tanstack/react-router'
import { DashboardHome } from '@fp/ui/flexprice'

/**
 * Home — the console overview.
 *
 * `DashboardHome` is the surface; this route component gives it the one thing it
 * cannot have on its own, a way to navigate, and the scroll region it reads top
 * to bottom in. The shell's content region is `overflow-hidden` (list pages
 * scroll their own grid), so a page that reads top to bottom owns its scroll —
 * the same pattern the shell documents for forms.
 */
export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto">
      <DashboardHome onNavigate={(path) => void navigate({ to: path, search: {} as never })} />
    </div>
  )
}

/**
 * How old a figure is, in words a person would say.
 *
 * Deliberately coarse: "Updated 3 min ago" is true for a minute, and a label
 * that re-renders every second is its own kind of noise. Below ten seconds it
 * says "just now" rather than counting.
 */
export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${Math.floor(seconds / 10) * 10} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** When the next label change happens, so a ticking label wakes only as often as it must. */
export function nextTickMs(ms: number): number {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 10_000
  if (seconds < 3600) return 30_000
  return 5 * 60_000
}

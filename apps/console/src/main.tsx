import { createRoot } from 'react-dom/client'
import { parseSurfaceHosts, surfaceFor, surfacePath } from './surfaces/surface'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

/**
 * A tab left open across a deploy asks for chunks whose hashed names no longer
 * exist; the host answers with index.html and the dynamic import fails. Reload
 * to pick up the new build. The timestamp stops a loop if the chunk is truly
 * gone, while still letting a later deploy recover the same tab again.
 */
window.addEventListener('vite:preloadError', (event) => {
  const key = 'fp:chunk-reload'
  try {
    const last = Number(sessionStorage.getItem(key) ?? 0)
    if (Date.now() - last < 30_000) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

/**
 * Which app this is, decided before anything mounts.
 *
 * Every surface's domain points at this one deployment; the hostname (or, on a
 * host that names no surface, an `/i/…` or `/p/…` path prefix) picks one, and only that
 * surface's code is loaded: each `import()` below is its own chunk, so the
 * hosted invoice page and the customer portal never download the console. See
 * `surfaces/surface.ts`.
 */
const match = surfaceFor(
  window.location,
  parseSurfaceHosts(import.meta.env.VITE_SURFACE_HOSTS as string | undefined),
)
const root = createRoot(container)

if (match.surface === 'invoice') {
  const { mount } = await import('./surfaces/invoice/mount')
  mount(root, surfacePath(window.location.pathname, match.basePath))
} else if (match.surface === 'portal') {
  const { mount } = await import('./surfaces/portal/mount')
  await mount(root, surfacePath(window.location.pathname, match.basePath), match.basePath)
} else {
  const { mount } = await import('./surfaces/console/mount')
  await mount(root)
}

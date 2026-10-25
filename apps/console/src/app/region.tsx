import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { RegionOption } from '@fp/ui/pages'
import { REGION_HOST_ALIASES, env } from '@/env'
import { regionHref, regionOfOrigin, type RegionId } from './regionRouting'

/**
 * Which Flexprice region this dashboard is, and how to reach the others.
 *
 * ## Why switching region is a navigation
 *
 * It used to swap `VITE_FLEXPRICE_API_URL` in place: the same page, pointed at
 * another region's API. That is the wrong shape for what these regions are.
 * Each one is a separate deployment with its own accounts, its own identity
 * provider and its own data: so talking to the US API from the India
 * dashboard means carrying an India session to a backend that never issued it.
 * Picking a region now goes to that region's dashboard, which is also what V1
 * does (`switchRegion` in `utils/region/regionUtils.ts`).
 *
 * The current path and query come along, so someone on `/invoices?status=open`
 * lands on the same screen in the region they chose rather than on its home
 * page. Whether they are signed in there is that deployment's business.
 *
 * ## Which region this is
 *
 * `VITE_FLEXPRICE_REGION` declares it. The origin is used as a fallback so a
 * deployment that forgets the variable still identifies itself correctly, and
 * so a host that is an alias of a region (`us.app.flexprice.io`) is not shown
 * a switcher inviting it to "move" to the region it is already in.
 *
 * Unset and unrecognised means not part of the hosted set: self-hosted, a
 * preview build, mocks: and the switcher does not appear at all. There is
 * nowhere for it to go that would make sense.
 */

const LABELS: Record<RegionId, string> = {
  in: 'India',
  us: 'United States',
  ca: 'Canada',
}

interface RegionState {
  /** The regions to offer; empty when this build is not one of the hosted set. */
  regions: readonly RegionOption[]
  /** This deployment's region. Falls back to `in` only so callers have a string. */
  region: RegionId
  /** Navigates to that region's dashboard, keeping the current page. */
  setRegion: (region: RegionId) => void
  /** The API this console talks to. Its own: never another region's. */
  serverURL: string
}

const RegionContext = createContext<RegionState | null>(null)

export function RegionProvider({ children }: { children: ReactNode }) {
  const value = useMemo<RegionState>(() => {
    const urls = env.regionUrls
    const detected =
      typeof globalThis.location === 'undefined'
        ? null
        : regionOfOrigin(globalThis.location.origin, urls, REGION_HOST_ALIASES)
    // The declared region wins: a deployment knows what it is, and an origin
    // can be a preview URL that matches nothing.
    const current = env.region ?? detected

    return {
      // Nothing to switch to when this is not a hosted region, and no point
      // offering the one you are already in.
      regions:
        current === null
          ? []
          : (Object.keys(urls) as RegionId[]).map((id) => ({ id, label: LABELS[id] })),
      region: current ?? 'in',
      setRegion: (next) => {
        if (next === current) return
        const { pathname, search } = globalThis.location
        globalThis.location.assign(regionHref(next, urls, pathname, search))
      },
      serverURL: env.apiUrl,
    }
  }, [])

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

export function useRegion(): RegionState {
  const value = useContext(RegionContext)
  if (!value) throw new Error('useRegion must be used inside RegionProvider')
  return value
}

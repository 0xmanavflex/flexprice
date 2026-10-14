import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { RegionId, RegionOption } from '@fp/ui/pages'
import { env } from '@/env'

/**
 * Which Flexprice region the console talks to.
 *
 * The hosted product runs in two regions with separate accounts and separate
 * APIs. The build sets one (`VITE_FLEXPRICE_API_URL`); when it is one of the two
 * hosted APIs, the sign-in and sign-up forms offer the other too, and the pick
 * is remembered in this browser so the next visit lands in the same place.
 * Mocks and self-hosted builds have nothing to switch to, so no picker shows.
 */
const HOSTED: (RegionOption & { url: string })[] = [
  { id: 'in', label: 'India', url: 'https://api.cloud.flexprice.io/v1' },
  { id: 'us', label: 'United States', url: 'https://us.api.flexprice.io/v1' },
]

const STORAGE_KEY = 'flexprice.region'

const trimSlash = (url: string) => url.replace(/\/+$/, '')
const buildRegion = HOSTED.find((region) => trimSlash(region.url) === trimSlash(env.apiUrl))
/** True only for a hosted build: then both regions are reachable. */
const switchable = !env.useMocks && buildRegion !== undefined

function readStored(): RegionId | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    return value === 'in' || value === 'us' ? value : null
  } catch {
    return null
  }
}

function writeStored(region: RegionId) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, region)
  } catch {
    // Private mode or blocked storage: the pick lasts this visit only.
  }
}

interface RegionState {
  /** The regions to offer; empty when the build cannot switch. */
  regions: readonly RegionOption[]
  region: RegionId
  setRegion: (region: RegionId) => void
  /** The API the console talks to. */
  serverURL: string
}

const RegionContext = createContext<RegionState | null>(null)

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<RegionId>(
    () => (switchable ? readStored() : null) ?? buildRegion?.id ?? 'in',
  )
  const value = useMemo<RegionState>(() => {
    const serverURL = switchable
      ? (HOSTED.find((entry) => entry.id === region)?.url ?? env.apiUrl)
      : env.apiUrl
    return {
      regions: switchable ? HOSTED.map(({ id, label }) => ({ id, label })) : [],
      region,
      setRegion: (next) => {
        writeStored(next)
        setRegionState(next)
      },
      serverURL,
    }
  }, [region])
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

export function useRegion(): RegionState {
  const value = useContext(RegionContext)
  if (!value) throw new Error('useRegion must be used inside RegionProvider')
  return value
}

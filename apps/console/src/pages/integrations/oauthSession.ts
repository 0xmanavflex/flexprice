const KEY = 'flexprice.oauth'

export interface PendingOAuth {
  provider: string
  sessionId: string
  /** Zoho only: the organisation the reader entered, which the provider does not echo back. */
  organizationId?: string | undefined
}

export function savePendingOAuth(pending: PendingOAuth): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // The callback page then asks the reader to start again.
  }
}

export function readPendingOAuth(): PendingOAuth | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PendingOAuth>
    return typeof value.provider === 'string' && typeof value.sessionId === 'string'
      ? {
          provider: value.provider,
          sessionId: value.sessionId,
          organizationId:
            typeof value.organizationId === 'string' ? value.organizationId : undefined,
        }
      : null
  } catch {
    return null
  }
}

export function clearPendingOAuth(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

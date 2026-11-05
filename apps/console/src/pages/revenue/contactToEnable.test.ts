import { describe, expect, it, vi } from 'vitest'
import { openSupportChat } from '@/app/supportChat/SupportChat'
import { contactToEnableRevenueRecognition } from './contactToEnable'

// The chat component pulls in the session and the UI kit; only its opener matters here.
vi.mock('@/app/supportChat/SupportChat', () => ({ openSupportChat: vi.fn() }))

describe('contactToEnableRevenueRecognition', () => {
  it('opens the support chat when the deployment has one', () => {
    expect(contactToEnableRevenueRecognition({ chat: true, email: 'support@example.com' })).toBe(
      openSupportChat,
    )
  })

  it('falls back to an email to the configured contact address', () => {
    const contact = contactToEnableRevenueRecognition({ chat: false, email: 'support@example.com' })
    const location = { href: '' }
    vi.stubGlobal('window', { location })
    contact?.()
    vi.unstubAllGlobals()
    expect(location.href).toBe('mailto:support@example.com?subject=Enable%20revenue%20recognition')
  })

  it('offers nothing when every contact option is hidden', () => {
    expect(contactToEnableRevenueRecognition({ chat: false, email: null })).toBeUndefined()
  })
})

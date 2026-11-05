import { describe, expect, it } from 'vitest'
import { changelogEntries } from './changelog'

describe('changelogEntries', () => {
  it('leads with Flexprice for Slack when its demo video is set, keeping six', () => {
    const entries = changelogEntries('https://www.loom.com/share/demo')
    expect(entries[0]).toMatchObject({
      title: 'Flexprice for Slack',
      href: 'https://www.loom.com/share/demo',
    })
    expect(entries).toHaveLength(6)
  })

  it('leaves the Slack card out without a video', () => {
    expect(changelogEntries(null).some((entry) => entry.title === 'Flexprice for Slack')).toBe(
      false,
    )
  })
})

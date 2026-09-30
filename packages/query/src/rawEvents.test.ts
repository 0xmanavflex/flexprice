import { describe, expect, it } from 'vitest'
import { DEFAULT_RAW_EVENT_QUERY } from '@fp/domain'
import { toRawEvent, toRawEventFilter } from './rawEvents'

describe('toRawEvent', () => {
  it('keeps the properties bag verbatim', () => {
    const event = toRawEvent({
      id: 'evt_1',
      eventName: 'api_call',
      externalCustomerId: 'acme',
      source: 'sdk',
      timestamp: '2026-09-01T10:00:00Z',
      properties: { tokens: 12, model: 'x' },
    })

    expect(event.properties).toEqual({ tokens: 12, model: 'x' })
    expect(event.timestamp?.toISOString()).toBe('2026-09-01T10:00:00.000Z')
  })

  it('reads a missing or unparseable timestamp as null rather than Invalid Date', () => {
    expect(toRawEvent({}).timestamp).toBeNull()
    expect(toRawEvent({ timestamp: 'not a date' }).timestamp).toBeNull()
  })

  it('defaults absent fields to empty rather than crashing', () => {
    expect(toRawEvent({})).toMatchObject({ id: '', eventName: '', source: '', properties: {} })
  })
})

describe('toRawEventFilter', () => {
  it('pages by offset and sends newest-first by default', () => {
    expect(toRawEventFilter({ ...DEFAULT_RAW_EVENT_QUERY, page: 3 })).toEqual({
      pageSize: 25,
      offset: 50,
      order: 'desc',
    })
  })

  it('sends only the filters that were set', () => {
    expect(
      toRawEventFilter({ ...DEFAULT_RAW_EVENT_QUERY, search: 'api_call', customer: 'acme' }),
    ).toMatchObject({ eventName: 'api_call', externalCustomerId: 'acme' })
  })
})

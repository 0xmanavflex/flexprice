import { describe, expect, it } from 'vitest'
import { eventImportErrors, eventImportTemplateCsv, isEventImportActive } from './eventImport'

describe('eventImportTemplateCsv', () => {
  it('names the columns the backend reads, with no byte-order mark before the first', () => {
    const [header, example] = eventImportTemplateCsv().trim().split('\r\n')
    expect(header).toBe(
      'event_name,external_customer_id,timestamp,event_id,source,properties.region',
    )
    expect(example?.split(',')).toHaveLength(6)
    expect(eventImportTemplateCsv().charCodeAt(0)).toBe('e'.charCodeAt(0))
  })
})

describe('eventImportErrors', () => {
  it('splits the backend summary into one line per failed row', () => {
    expect(
      eventImportErrors(
        'Record 2: timestamp error: invalid timestamp format; Record 5: event_name is required',
      ),
    ).toEqual([
      'Record 2: timestamp error: invalid timestamp format',
      'Record 5: event_name is required',
    ])
  })

  it('keeps a summary that is not per row whole', () => {
    expect(eventImportErrors('Failed to download import object')).toEqual([
      'Failed to download import object',
    ])
    expect(eventImportErrors('')).toEqual([])
  })
})

describe('isEventImportActive', () => {
  it('is true only while queued or importing', () => {
    expect(isEventImportActive('PENDING')).toBe(true)
    expect(isEventImportActive('PROCESSING')).toBe(true)
    expect(isEventImportActive('COMPLETED')).toBe(false)
    expect(isEventImportActive('FAILED')).toBe(false)
  })
})

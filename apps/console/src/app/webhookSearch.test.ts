import { describe, expect, it } from 'vitest'
import { parseWebhookEndpointSearch, parseWebhookHubSearch } from './webhookSearch'

describe('parseWebhookHubSearch', () => {
  it('defaults to the endpoints view', () => {
    expect(parseWebhookHubSearch({})).toEqual({ tab: 'endpoints' })
    expect(parseWebhookHubSearch({ tab: 'nonsense' })).toEqual({ tab: 'endpoints' })
  })

  it('keeps a known view and a message id', () => {
    expect(parseWebhookHubSearch({ tab: 'logs', msg: 'msg_2mW0A1b' })).toEqual({
      tab: 'logs',
      msg: 'msg_2mW0A1b',
    })
  })

  it('drops a message id that is not one', () => {
    expect(parseWebhookHubSearch({ tab: 'logs', msg: '<script>' })).toEqual({ tab: 'logs' })
  })
})

describe('parseWebhookEndpointSearch', () => {
  it('defaults to overview', () => {
    expect(parseWebhookEndpointSearch({ tab: 'billing' })).toEqual({ tab: 'overview' })
    expect(parseWebhookEndpointSearch({ tab: 'advanced' })).toEqual({ tab: 'advanced' })
  })
})

import { describe, expect, it } from 'vitest'
import { AggregationType, type Feature } from '@fp/domain'
import { featureFixtures } from './featureFixtures'
import { buildIngestCurl } from './FeatureDetailView'

const metered = (patch: Partial<Feature>): Feature =>
  ({ ...featureFixtures[0]!, eventName: 'llm_completion', ...patch }) as Feature

describe('buildIngestCurl', () => {
  it("calls the environment's own API host, not production", () => {
    const curl = buildIngestCurl(metered({}), 'https://api-dev.cloud.flexprice.io/v1/')
    expect(curl).toContain('--url https://api-dev.cloud.flexprice.io/v1/events')
    expect(curl).not.toContain('api.cloud.flexprice.io')
  })

  it('sends the property the feature aggregates', () => {
    const curl = buildIngestCurl(
      metered({ aggregationType: AggregationType.Sum, aggregationField: 'tokens' }),
    )
    expect(curl).toContain('"properties": { "tokens": "<value>" }')
  })

  it('needs no property for a count', () => {
    const curl = buildIngestCurl(metered({ aggregationType: AggregationType.Count }))
    expect(curl).toContain('"properties": {}')
  })
})

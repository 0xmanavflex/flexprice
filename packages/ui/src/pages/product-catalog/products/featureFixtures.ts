import {
  AggregationType,
  DEFAULT_FEATURE_QUERY,
  type Feature,
  type FeatureQuery,
  FeatureStatus,
  FeatureType,
} from '@fp/domain'

/** Features as plain domain values: no client, no provider, no network. */
export const featureFixtures: Feature[] = [
  {
    id: 'feat_01',
    name: 'API calls',
    lookupKey: 'api_calls',
    description: 'Billable API requests',
    type: FeatureType.Metered,
    status: FeatureStatus.Published,
    eventName: 'api_call',
    aggregationType: AggregationType.Count,
    meterId: 'meter_01',
    unitSingular: 'call',
    unitPlural: 'calls',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-02-02T00:00:00Z'),
  },
  {
    id: 'feat_02',
    name: 'Tokens processed',
    lookupKey: 'tokens',
    description: 'LLM tokens, weighted by model',
    type: FeatureType.Metered,
    status: FeatureStatus.Published,
    eventName: 'llm_completion',
    aggregationType: AggregationType.SumWithMultiplier,
    meterId: 'meter_02',
    unitSingular: 'token',
    unitPlural: 'tokens',
    createdAt: new Date('2026-02-01T00:00:00Z'),
    updatedAt: new Date('2026-03-05T00:00:00Z'),
  },
  {
    id: 'feat_03',
    name: 'SSO',
    lookupKey: 'sso',
    description: 'Single sign-on',
    type: FeatureType.Boolean,
    status: FeatureStatus.Published,
    eventName: null,
    aggregationType: null,
    meterId: null,
    unitSingular: '',
    unitPlural: '',
    createdAt: new Date('2026-02-14T00:00:00Z'),
    updatedAt: new Date('2026-02-14T00:00:00Z'),
  },
  {
    id: 'feat_04',
    name: 'Seats',
    lookupKey: 'seats',
    description: '',
    type: FeatureType.Static,
    status: FeatureStatus.Published,
    eventName: null,
    aggregationType: null,
    meterId: null,
    unitSingular: 'seat',
    unitPlural: 'seats',
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  },
  {
    // Archived, no lookup key and no description: the row a hand-written demo omits.
    id: 'feat_05',
    name: 'Retention window',
    lookupKey: '',
    description: '',
    type: FeatureType.Config,
    status: FeatureStatus.Archived,
    eventName: null,
    aggregationType: null,
    meterId: null,
    unitSingular: '',
    unitPlural: '',
    createdAt: null,
    updatedAt: null,
  },
]

export const fixtureFeatureQuery: FeatureQuery = { ...DEFAULT_FEATURE_QUERY }

export function manyFeatures(count: number): Feature[] {
  return Array.from({ length: count }, (_, index) => {
    const base = featureFixtures[index % featureFixtures.length] as Feature
    return { ...base, id: `feat_page_${index}`, name: `${base.name} ${index}` }
  })
}

import { describe, expect, it } from 'vitest'
import { eventPropertyNames, expressionProblem } from './featureExpression'

describe('expressionProblem', () => {
  it('passes finished expressions', () => {
    expect(expressionProblem('duration_seconds / 60 / 100')).toBeNull()
    expect(expressionProblem('(tokens + cached) * 2')).toBeNull()
    expect(expressionProblem("region == 'eu' ? 1 : 0")).toBeNull()
    expect(expressionProblem('-amount')).toBeNull()
    expect(expressionProblem('')).toBeNull()
  })

  it('names what is unfinished', () => {
    expect(expressionProblem('(tokens + 1')).toBe('A ( is never closed.')
    expect(expressionProblem('tokens + 1)')).toBe('Unexpected ).')
    expect(expressionProblem("region == 'eu")).toBe('A quote is never closed.')
    expect(expressionProblem('tokens *')).toBe('The expression ends with an operator.')
    expect(expressionProblem('/ 60')).toBe('The expression starts with an operator.')
  })
})

describe('eventPropertyNames', () => {
  it('lists the properties of matching events, most common first', () => {
    const events = [
      { eventName: 'call', properties: { duration_seconds: 1, region: 'eu' } },
      { eventName: 'call', properties: { duration_seconds: 2 } },
      { eventName: 'other', properties: { ignored: 1 } },
    ]
    expect(eventPropertyNames(events, 'call')).toEqual(['duration_seconds', 'region'])
    expect(eventPropertyNames(events, 'missing')).toEqual([])
  })
})

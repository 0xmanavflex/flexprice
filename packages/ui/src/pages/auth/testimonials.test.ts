import { describe, expect, it } from 'vitest'
import { CUSTOMER_LOGOS, TESTIMONIALS } from './testimonials'

describe('TESTIMONIALS', () => {
  it('plays the reviews in the agreed order', () => {
    expect(TESTIMONIALS.map((t) => `${t.name} (${t.company})`)).toEqual([
      'Cali Collins (Optimality)',
      'Ram A (Vapi)',
      'Martin Sønderkær Jung (C&B Systemer)',
      'Justin Benson (Aftershoot)',
      'Shubhendu Shishir (Simplismart)',
      'Shaunak Srivastava (Truffle AI)',
    ])
  })
})

describe('CUSTOMER_LOGOS', () => {
  const logo = (name: string) => CUSTOMER_LOGOS.find((l) => l.name === name)

  it('keeps Vapi and Facilio smaller than the rest, on the left edge', () => {
    const others = CUSTOMER_LOGOS.filter((l) => l.name !== 'Vapi' && l.name !== 'Facilio')
    const smallest = Math.min(...others.map((l) => l.height))
    expect(logo('Vapi')?.height).toBeLessThan(smallest)
    expect(logo('Facilio')?.height).toBeLessThan(smallest)
    // Facilio's file has transparent padding on its left; the offset cancels it.
    expect(logo('Facilio')?.offset).toBeLessThan(0)
  })
})

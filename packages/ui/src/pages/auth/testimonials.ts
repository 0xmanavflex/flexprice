import { AUTH_LOGOS, AUTH_PEOPLE } from '@ui/assets/auth'

/**
 * The customer reviews and logos beside the sign-in forms: the same people,
 * photos and logos as admin.flexprice.io, via the dashboard redesign.
 */
export interface Testimonial {
  id: string
  quote: string
  name: string
  role: string
  company: string
  photo: string
  logo: string
  /** Logo height in the review: the source files carry different padding. */
  logoClass: string
  /** The company's stage, shown as a tag under the person. */
  stage?: string
}

// The order the reviews play in, from the 2026-10-27 review.
export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'optimality',
    quote:
      "Every pricing change took us weeks & by the time it shipped the market had moved. With Flexprice we've done 3 pricing overhauls in under a year, without engineering holding us back.",
    name: 'Cali Collins',
    role: 'CPO & Co-founder',
    company: 'Optimality',
    photo: AUTH_PEOPLE.cali,
    logo: AUTH_LOGOS.optimality,
    logoClass: 'h-8',
  },
  {
    id: 'vapi',
    quote:
      'Honestly the customer dashboard was the one thing our team felt the most. We stopped getting those billing questions that used to pile up every month by using Flexprice.',
    name: 'Ram A',
    role: 'Head of Finance',
    company: 'Vapi',
    photo: AUTH_PEOPLE.ram,
    logo: AUTH_LOGOS.vapi,
    // A solid wordmark with no padding: one step down so it weighs what the others do.
    logoClass: 'h-4',
    stage: 'Series B',
  },
  {
    id: 'cb',
    quote:
      "We weren't willing to give up control of our data, but we still needed a reliable subscription tool. Flexprice on-prem was the only thing that worked for us!",
    name: 'Martin Sønderkær Jung',
    role: 'CTO',
    company: 'C&B Systemer',
    photo: AUTH_PEOPLE.martin,
    logo: AUTH_LOGOS.cb,
    logoClass: 'h-5',
  },
  {
    id: 'aftershoot',
    quote:
      "Flexprice streamlined our entire pricing workflow. We went from messy internal scripts to clean, configurable usage plans in no time, and it's been a huge relief for our team.",
    name: 'Justin Benson',
    role: 'Co-Founder',
    company: 'Aftershoot',
    photo: AUTH_PEOPLE.justin,
    logo: AUTH_LOGOS.aftershoot,
    logoClass: 'h-6',
    stage: 'Series A',
  },
  {
    id: 'simplismart',
    quote:
      'Flexprice has completely transformed how we handle billing. Setting up usage-based pricing was a breeze, and their SDKs fit right into our stack.',
    name: 'Shubhendu Shishir',
    role: 'Head of Engineering',
    company: 'Simplismart',
    photo: AUTH_PEOPLE.shubhendu,
    logo: AUTH_LOGOS.simplismart,
    logoClass: 'h-5',
    stage: 'Series A',
  },
  {
    id: 'truffle',
    quote:
      'Flexprice saved us thousands of development hours that we would have spent building in-house. Managing pricing plans and experimenting with models is now effortless.',
    name: 'Shaunak Srivastava',
    role: 'Co-founder (YC 25)',
    company: 'Truffle AI',
    photo: AUTH_PEOPLE.shaunak,
    logo: AUTH_LOGOS.truffle,
    logoClass: 'h-4',
    stage: 'Y Combinator',
  },
]

/**
 * The "Trusted by" logos, optically sized: each height gives every logo the
 * same visual weight, and `offset` cancels the transparent padding on the left
 * of the file so all six start on one edge. Measured from the files; re-measure
 * if one changes.
 */
export const CUSTOMER_LOGOS = [
  { name: 'Krutrim', src: AUTH_LOGOS.krutrim, height: 38, offset: -8 },
  { name: 'Vapi', src: AUTH_LOGOS.vapi, height: 16, offset: 0 },
  { name: 'Simplismart', src: AUTH_LOGOS.simplismart, height: 30, offset: -9 },
  { name: 'Aftershoot', src: AUTH_LOGOS.aftershoot, height: 31, offset: -6 },
  { name: 'Facilio', src: AUTH_LOGOS.facilio, height: 20, offset: -6 },
  { name: 'Gigin', src: AUTH_LOGOS.gigin, height: 23, offset: 0 },
]

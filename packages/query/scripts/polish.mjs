/**
 * Rewrites the *display* fields of the generated corpus so it can be demoed.
 *
 * `synthesize.mjs` expands captured rows by suffixing them, which reads as
 * "Globex 6", plans described as "Replaced." and totals like 1734.55. This pass
 * runs over `src/__fixtures__/generated/*.json` in place: realistic company
 * names, contacts and addresses, a real plan ladder, add-on copy, round price
 * points and invoice totals. Ids, keys, nesting and every state axis are left
 * alone, so routes and tests keyed on `*_synth_*` ids are unaffected.
 *
 * Idempotent and deterministic (fixed rosters indexed by position). Run it after
 * `synthesize.mjs`, which rebuilds the corpus from captures and would undo it:
 *
 *   node scripts/synthesize.mjs && node scripts/polish.mjs
 *
 * Rows hand-authored into the generated files (plan-scoped prices, coupons,
 * entitlements, credit grants, price units) are not touched by the generator,
 * so polishing in place is what keeps them.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/__fixtures__/generated')
const load = (name) => JSON.parse(readFileSync(resolve(dir, `${name}.json`), 'utf8'))
const save = (name, data) =>
  writeFileSync(resolve(dir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`)

const COMPANIES = [
  [
    'Northwind Logistics',
    'northwindlogistics.com',
    'Seattle',
    'WA',
    '98101',
    'US',
    'America/Los_Angeles',
    'enterprise',
  ],
  [
    'Lumen Analytics',
    'lumenanalytics.io',
    'Austin',
    'TX',
    '78701',
    'US',
    'America/Chicago',
    'growth',
  ],
  [
    'Brightpath Health',
    'brightpath.health',
    'Boston',
    'MA',
    '02110',
    'US',
    'America/New_York',
    'enterprise',
  ],
  [
    'Kestrel Robotics',
    'kestrelrobotics.com',
    'Pittsburgh',
    'PA',
    '15222',
    'US',
    'America/New_York',
    'growth',
  ],
  [
    'Harbor & Finch',
    'harborfinch.co',
    'Portland',
    'OR',
    '97204',
    'US',
    'America/Los_Angeles',
    'starter',
  ],
  [
    'Meridian Payments',
    'meridianpay.com',
    'Chicago',
    'IL',
    '60601',
    'US',
    'America/Chicago',
    'enterprise',
  ],
  [
    'Oakridge Education',
    'oakridge.edu',
    'Denver',
    'CO',
    '80202',
    'US',
    'America/Denver',
    'nonprofit',
  ],
  [
    'Sable Studios',
    'sablestudios.tv',
    'Los Angeles',
    'CA',
    '90013',
    'US',
    'America/Los_Angeles',
    'starter',
  ],
  [
    'Quantum Leaf',
    'quantumleaf.ai',
    'San Francisco',
    'CA',
    '94105',
    'US',
    'America/Los_Angeles',
    'growth',
  ],
  [
    'Fernhill Foods',
    'fernhillfoods.com',
    'Minneapolis',
    'MN',
    '55401',
    'US',
    'America/Chicago',
    'starter',
  ],
  [
    'Atlas Freight Co.',
    'atlasfreight.com',
    'Atlanta',
    'GA',
    '30303',
    'US',
    'America/New_York',
    'enterprise',
  ],
  ['Pixelforge', 'pixelforge.dev', 'Toronto', 'ON', 'M5V 2T6', 'CA', 'America/Toronto', 'growth'],
  [
    'Bluebird Mobility',
    'bluebirdmobility.ca',
    'Vancouver',
    'BC',
    'V6B 1A1',
    'CA',
    'America/Vancouver',
    'starter',
  ],
  ['Tessellate Labs', 'tessellate.io', 'London', '', 'EC2A 4NE', 'GB', 'Europe/London', 'growth'],
  [
    'Corvid Security',
    'corvidsec.co.uk',
    'Manchester',
    '',
    'M1 4BT',
    'GB',
    'Europe/London',
    'enterprise',
  ],
  [
    'Alder & Pine',
    'alderpine.studio',
    'Edinburgh',
    '',
    'EH2 2ER',
    'GB',
    'Europe/London',
    'starter',
  ],
  [
    'Nordlicht Energie',
    'nordlicht-energie.de',
    'Hamburg',
    '',
    '20457',
    'DE',
    'Europe/Berlin',
    'enterprise',
  ],
  ['Kreuzberg Commerce', 'kreuzberg.shop', 'Berlin', '', '10997', 'DE', 'Europe/Berlin', 'growth'],
  ['Maison Lumière', 'maisonlumiere.fr', 'Paris', '', '75003', 'FR', 'Europe/Paris', 'starter'],
  ['Fjord Data', 'fjorddata.no', 'Oslo', '', '0150', 'NO', 'Europe/Oslo', 'growth'],
  [
    'Amstel Ventures',
    'amstelventures.nl',
    'Amsterdam',
    '',
    '1012 JS',
    'NL',
    'Europe/Amsterdam',
    'enterprise',
  ],
  ['Banyan Cloud', 'banyancloud.in', 'Bengaluru', 'KA', '560001', 'IN', 'Asia/Kolkata', 'growth'],
  ['Saffron Pay', 'saffronpay.in', 'Mumbai', 'MH', '400051', 'IN', 'Asia/Kolkata', 'enterprise'],
  ['Vidya Learning', 'vidyalearning.in', 'Pune', 'MH', '411001', 'IN', 'Asia/Kolkata', 'nonprofit'],
  ['Lotus Retail', 'lotusretail.in', 'Hyderabad', 'TS', '500081', 'IN', 'Asia/Kolkata', 'starter'],
  [
    'Merlion Systems',
    'merlionsystems.sg',
    'Singapore',
    '',
    '048616',
    'SG',
    'Asia/Singapore',
    'enterprise',
  ],
  [
    'Koala Commerce',
    'koalacommerce.com.au',
    'Sydney',
    'NSW',
    '2000',
    'AU',
    'Australia/Sydney',
    'growth',
  ],
  [
    'Tui Software',
    'tuisoftware.co.nz',
    'Auckland',
    '',
    '1010',
    'NZ',
    'Pacific/Auckland',
    'starter',
  ],
  ['Sakura Gaming', 'sakuragaming.jp', 'Tokyo', '', '100-0004', 'JP', 'Asia/Tokyo', 'growth'],
  [
    'Cobalt Ledger',
    'cobaltledger.com',
    'New York',
    'NY',
    '10005',
    'US',
    'America/New_York',
    'enterprise',
  ],
]

const FIRST_NAMES = [
  'Priya',
  'Daniel',
  'Mei',
  'Lucas',
  'Amara',
  'Tomás',
  'Sofia',
  'Kenji',
  'Hannah',
  'Rohan',
]

function polishCustomers(corpus) {
  corpus?.items.forEach((row, i) => {
    const [name, domain, city, state, postal, country, timezone, segment] =
      COMPANIES[i % COMPANIES.length]
    row.name = name
    row.email = `billing@${domain}`
    row.external_id = `cust_${domain.split('.')[0].replace(/[^a-z0-9]/g, '')}`
    row.address_line1 = `${100 + ((i * 37) % 800)} ${['Market', 'Harbour', 'Elm', 'Station', 'Park'][i % 5]} ${['Street', 'Avenue', 'Road'][i % 3]}`
    row.address_line2 = i % 4 === 0 ? `Suite ${200 + i}` : ''
    row.address_city = city
    row.address_state = state
    row.address_postal_code = postal
    row.address_country = country
    row.timezone = timezone
    row.tax_treatment = country === 'US' || country === 'IN' ? 'taxable' : 'reverse_charge'
    row.metadata = { segment, owner: FIRST_NAMES[i % FIRST_NAMES.length] }
  })
}

/** Tiers, cheapest first; the price a plan's recurring charge is built from. */
const PLAN_TIERS = [
  ['Free', 'free', 'For trying the product on a side project. No card needed.', 0],
  ['Developer', 'developer', 'Individual developers shipping their first integration.', 29],
  ['Starter', 'starter', 'Small teams getting to production with the essentials.', 99],
  ['Team', 'team', 'Collaboration, shared dashboards and role-based access.', 249],
  ['Growth', 'growth', 'Higher limits and priority email support for scaling products.', 499],
  ['Pro', 'pro', 'Advanced analytics, webhooks and a 99.9% uptime commitment.', 899],
  ['Scale', 'scale', 'Volume pricing for high-traffic workloads.', 1499],
  ['Business', 'business', 'SSO, audit logs and a named customer success contact.', 2499],
  ['Platform', 'platform', 'Multi-entity billing for marketplaces and platforms.', 3999],
  ['Enterprise', 'enterprise', 'Custom limits, invoicing terms and a 99.99% SLA.', 7500],
  ['Startup program', 'startup_program', 'Discounted first-year plan for funded startups.', 149],
  ['Nonprofit', 'nonprofit', 'Reduced rate for registered nonprofit organisations.', 199],
]

const tierOf = (i) => PLAN_TIERS[i % PLAN_TIERS.length]

function polishPlans(corpus) {
  corpus?.items.forEach((row, i) => {
    const [name, key, description, monthly] = tierOf(i)
    row.name = name
    row.lookup_key = `plan_${key}`
    row.description = description
    row.display_order = i
    for (const [n, price] of (row.prices ?? []).entries()) {
      price.display_name = n === 0 ? `${name} usage` : `${name} subscription`
      price.lookup_key = `plan_${key}_${n === 0 ? 'usage' : 'base'}`
      if (price.type === 'USAGE') {
        price.amount = '0.002'
        price.display_amount = '$0.002'
      } else {
        price.amount = monthly.toFixed(2)
        price.display_amount = `$${price.amount}`
      }
    }
  })
}

const ADDONS = [
  [
    'Extra seats pack',
    'extra_seats_pack',
    'Ten additional team seats, billed alongside the base plan.',
  ],
  [
    'Priority support',
    'priority_support',
    'Four-hour response time on weekdays, with a shared Slack channel.',
  ],
  [
    'Onboarding package',
    'onboarding_package',
    'Guided setup and data migration with a solutions engineer.',
  ],
  [
    'White labelling',
    'white_labelling',
    'Remove branding from invoices, emails and the customer portal.',
  ],
  [
    'Custom domain',
    'custom_domain',
    'Serve the customer portal and invoices from your own domain.',
  ],
  ['99.99% SLA', 'sla_9999', 'Contractual uptime guarantee with service credits.'],
  [
    'Extended audit log',
    'extended_audit_log',
    'Keep audit events for seven years instead of ninety days.',
  ],
  ['SAML single sign-on', 'saml_sso', 'Connect Okta, Entra ID or Google Workspace.'],
  ['Dedicated webhook IPs', 'dedicated_webhook_ips', 'Static egress addresses you can allow-list.'],
  ['Advanced analytics', 'advanced_analytics', 'Cohort, churn and revenue-by-customer reporting.'],
  ['Data warehouse export', 'warehouse_export', 'Nightly sync to Snowflake, BigQuery or S3.'],
  [
    'Sandbox environment',
    'sandbox_environment',
    'A second environment for testing pricing changes safely.',
  ],
]

function polishAddons(corpus) {
  corpus?.items.forEach((row, i) => {
    const [name, key, description] = ADDONS[i % ADDONS.length]
    row.name = name
    row.lookup_key = key
    row.description = description
  })
}

/** Plausible invoice totals per currency — round enough to read, varied enough to sort. */
const INVOICE_TOTALS = {
  USD: [49, 99, 249, 499, 899, 1499, 2499, 3999, 7500, 12400],
  EUR: [45, 92, 230, 460, 830, 1380, 2300, 3680, 6900, 11400],
  INR: [3999, 8250, 20750, 41500, 74700, 124500, 207500, 332000, 622500, 1029000],
  GBP: [39, 79, 199, 399, 719, 1199, 1999, 3199, 5999, 9900],
}

function polishInvoices(corpus) {
  corpus?.items.forEach((row, i) => {
    const ladder = INVOICE_TOTALS[row.currency] ?? INVOICE_TOTALS.USD
    const total = ladder[(i * 7 + Math.floor(i / 4)) % ladder.length]
    const paidShare =
      Number(row.amount_paid) > 0 ? Number(row.amount_paid) / Math.max(Number(row.total), 1) : 0
    const fmt = (n) => n.toFixed(2)
    row.total = fmt(total)
    row.subtotal = fmt(total)
    row.amount_due = fmt(total)
    row.amount_paid = fmt(total * Math.min(1, Math.round(paidShare * 100) / 100))
    row.amount_remaining = fmt(total - Number(row.amount_paid))
    if (row.invoice_number) row.invoice_number = `INV-2026-${String(1000 + i * 7).padStart(4, '0')}`
    const items = row.line_items ?? []
    items.forEach((item, n) => {
      item.display_name = n === 0 ? 'Platform subscription' : 'Usage — API calls'
      item.amount = fmt(n === 0 ? total * 0.8 : (total * 0.2) / Math.max(items.length - 1, 1))
    })
  })
}

const customers = load('customers')
const plans = load('plans')
const addons = load('addons')
const invoices = load('invoices')
const subscriptions = load('subscriptions')
const prices = load('prices')

polishCustomers(customers)
polishPlans(plans)
polishAddons(addons)
polishInvoices(invoices)

const byId = (corpus) => new Map(corpus.items.map((row) => [row.id, row]))
const customerById = byId(customers)
const planById = byId(plans)

// Embedded copies must follow the rows they embed, or a list shows one name and
// its detail page another.
for (const row of [...invoices.items, ...subscriptions.items]) {
  const customer = customerById.get(row.customer_id)
  if (customer) row.customer = structuredClone(customer)
}
for (const row of subscriptions.items) {
  const plan = planById.get(row.plan_id)
  if (!plan) continue
  row.plan = structuredClone(plan)
  for (const item of row.line_items ?? []) item.plan_display_name = plan.name
}

for (const row of prices.items) {
  const id = String(row.id)
  const planScoped = /^price_plan(\d{4})_(base|api|tokens)$/.exec(id)
  if (planScoped) {
    // Hand-authored plan-scoped prices: the base charge must match the tier its
    // plan was renamed to, or the plan page contradicts its own price list.
    const [tierName, , , monthly] = tierOf(Number(planScoped[1]))
    if (planScoped[2] === 'base') {
      row.amount = monthly.toFixed(2)
      // The API derives display_amount from amount (`Price.GetDisplayAmount`),
      // so the two never disagree there; a fixture where they do shows one price
      // in the charges table and another on the plan card.
      row.display_amount = `$${row.amount}`
      row.display_name = `${tierName} base`
    }
    continue
  }
  if (!id.startsWith('price_synth_')) continue
  const ladder =
    row.type === 'USAGE'
      ? ['0.002', '0.01', '0.05']
      : ['29.00', '99.00', '249.00', '499.00', '899.00']
  row.amount = ladder[Number(id.slice(-4)) % ladder.length]
  row.display_amount = row.amount
  row.display_name = row.type === 'USAGE' ? 'Usage' : 'Subscription'
}

for (const [name, data] of Object.entries({
  customers,
  plans,
  addons,
  invoices,
  subscriptions,
  prices,
})) {
  save(name, data)
  console.log(`  polished ${name.padEnd(14)} ${data.items.length} rows`)
}

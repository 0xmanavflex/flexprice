/**
 * The dependency matrix, as ESLint errors.
 *
 *              Pages
 *            /   |   \
 *          UI  Actions  Query      <- peers, all application-facing
 *            \   |   /
 *             Domain
 *                |
 *          @flexprice/sdk
 *                |
 *             Backend
 *
 * Every entry below is one line of that picture. They are errors rather than
 * review comments for a specific reason: V1's `AGENTS.md` forbids `any` and
 * there are 73 of them; it says tests are co-located and ~12% of files have
 * one. A rule a tool does not check is a preference, and preferences lose to
 * deadlines.
 *
 * ## Why each layer gets exactly one entry
 *
 * ESLint flat config merges by *rule name*, not by option. Two config objects
 * that both match a file and both set `no-restricted-imports` do not combine
 * their patterns — the later one replaces the earlier one wholesale, and the
 * first set silently stops being enforced. That failure is invisible: the
 * config still loads, lint still passes, and a boundary you believe is guarded
 * is not.
 *
 * So each layer declares its complete forbidden set once, and
 * `architecture.test.ts` lints a file at each path to prove it.
 */

const SDK = ['@flexprice/sdk', '@flexprice/sdk/*']
const API = ['@fp/api', '@fp/api/*']
const QUERY = ['@fp/query', '@fp/query/*', '@tanstack/react-query']
const UI = ['@fp/ui', '@fp/ui/*']
const ACTIONS = ['@fp/actions', '@fp/actions/*']
const ADAPTER = ['@fp/sdk-adapter', '@fp/sdk-adapter/*']
const REACT = ['react', 'react-dom', 'react/*', 'react-dom/*']

const ADAPTER_MESSAGE =
  '@fp/sdk-adapter is a temporary compensation for gaps in the OpenAPI contract, and only @fp/query may use it. Letting it spread is how a stopgap becomes permanent. See docs/api-contract-gap.md.'

/** One scoped config object with a single, complete `no-restricted-imports`. */
function layer(files, patterns) {
  return { files, rules: { 'no-restricted-imports': ['error', { patterns }] } }
}

/**
 * Domain is pure product vocabulary.
 *
 * It is the one layer everything else imports, so anything it depends on
 * becomes a dependency of everything. Keeping React out is also what lets
 * domain logic be tested as plain functions.
 */
export const domainRules = layer(['packages/domain/**/*.{ts,tsx}'], [
  {
    group: REACT,
    message:
      'Domain is pure product vocabulary and must not depend on React. If you need a hook, it belongs in @fp/query or the app.',
  },
  {
    group: [...UI, ...QUERY, ...API, ...SDK, ...ACTIONS, ...ADAPTER],
    message:
      'Domain sits below UI, actions, query and the SDK. Importing any of them makes the bottom layer depend on the top.',
  },
])

/** Query owns server state. It may reach the SDK; it speaks domain. */
export const queryRules = layer(['packages/query/**/*.{ts,tsx}'], [
  {
    group: [...UI, ...ACTIONS],
    message:
      'The data layer must not import UI or actions. If a query needs one, the dependency is pointing the wrong way.',
  },
])

/**
 * Actions describe what the product can do. They may use domain and query,
 * but not reach past query to the SDK — that would be a second path to the
 * backend with its own error handling and its own retry policy.
 */
export const actionsRules = layer(['packages/actions/**/*.{ts,tsx}'], [
  {
    group: UI,
    message:
      'Actions are headless — they describe capabilities, they do not render. Import UI from a page instead.',
  },
  {
    group: [...SDK, ...API],
    message:
      'Actions reach the backend through @fp/query, not the SDK directly — otherwise there are two paths to the API with two different error and retry policies.',
  },
  { group: ADAPTER, message: ADAPTER_MESSAGE },
])

/**
 * UI is presentation. It may not fetch, and may not name a transport type.
 *
 * Stricter than "UI may call the query layer", and chosen deliberately: a
 * component that cannot fetch renders in a story, tests without a network, and
 * survives the API changing shape. Loading, empty and error become props rather
 * than states you must provoke a server into producing.
 */
export const uiRules = layer(['packages/ui/**/*.{ts,tsx}'], [
  {
    group: [...SDK, ...API],
    message:
      'UI is presentation. It must not import the SDK or @fp/api — take a domain type as a prop and let the page do the wiring.',
  },
  {
    group: QUERY,
    message:
      'UI must not fetch. Move the query into the page and pass the result down, so the component stays renderable in a story and testable without a network.',
  },
  {
    group: ACTIONS,
    message:
      'UI must not depend on actions. Take an `onX` callback as a prop and let the page bind it — this is what keeps agent infrastructure out of the component tree.',
  },
  { group: ADAPTER, message: ADAPTER_MESSAGE },
])

/** The adapter sits beside query, below everything else. */
export const adapterRules = layer(['packages/sdk-adapter/**/*.{ts,tsx}'], [
  {
    group: [...UI, ...ACTIONS, ...QUERY],
    message:
      'The adapter is a transport-level stopgap. It must not import UI, actions or the query layer.',
  },
])

/**
 * Apps compose. A page is exactly where UI, actions and query legitimately
 * meet — but it still goes through the door rather than around it.
 */
export const appRules = layer(['apps/**/*.{ts,tsx}'], [
  {
    group: [...SDK, ...API],
    message:
      'Apps talk to the backend through @fp/query. Importing the SDK or @fp/api directly bypasses the retry policy, the error shape and the auth headers.',
  },
  { group: ADAPTER, message: ADAPTER_MESSAGE },
])

/** Every architecture rule, in dependency order. */
export const architecture = [
  domainRules,
  adapterRules,
  queryRules,
  actionsRules,
  uiRules,
  appRules,
]

export default architecture

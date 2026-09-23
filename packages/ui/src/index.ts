/**
 * @fp/ui — presentation, and nothing else.
 *
 *              Pages
 *            /   |   \
 *          UI  Actions  Query        <- peers, all application-facing
 *            \   |   /
 *             Domain
 *                |
 *          @flexprice/sdk
 *
 * A component here takes props and renders. It does not fetch, does not know a
 * query key exists, and never sees a transport type. Pages do the wiring.
 *
 * That is a stronger rule than "UI may call the query layer", and it is chosen
 * deliberately: a component that cannot fetch is a component that renders in a
 * story, tests without a network, and survives the API changing shape. Every
 * state it can be in — loading, empty, error — becomes expressible as props
 * rather than something you must provoke a server into producing.
 *
 * Four folders, each with a different bar for entry:
 *
 *   primitives/    Vendored from the ReUI registry. Never hand-edited, so an
 *                  upstream update stays a re-install.
 *   compositions/  Generic behaviour composed over ReUI parts. The preferred
 *                  way to differ from the registry.
 *   flexprice/     Product components that know billing vocabulary —
 *                  InvoiceStatusBadge, MoneyCell. Domain types are welcome
 *                  here; transport types are not.
 *   provenance/    Where each component came from, in the type system.
 *
 * The thing to avoid is what V1 became: 616 component files, 371 of them in one
 * `molecules/` folder. Thin is the feature.
 */
export * from './provenance'

# Keeping in step with `@flexprice/sdk`

The SDK is the console's only contract with the backend. It is generated from
the backend's OpenAPI spec (`flexprice/docs/swagger/swagger-3-0.json`) and
published on its own schedule, so three things can drift: the backend, the
SDK, and what the console assumes. `scripts/check-sdk.mjs` compares all three.

## The rules

1. **The console calls only operations the installed SDK has.** Enforced on
   every PR by `lint.yml` (`node scripts/check-sdk.mjs --check`).
2. **`as never` casts on SDK calls only go down.** Each one switches off the
   request-type check for that call, which is how a renamed field reaches
   production. The count is ratcheted in `scripts/sdk-baseline.json`; fix a
   cast, then lower the baseline with `--write-baseline`.
3. **An SDK upgrade is its own PR.** Dependabot opens it the day a version is
   published (`.github/dependabot.yml`, label `sdk-update`). Types, unit tests
   and stories on that PR show what broke. Do not bundle the bump with
   feature work.
4. **Known gaps are written down.** Backend operations or fields missing from
   the SDK are listed in `scripts/sdk-baseline.json` after someone has looked
   at them. A new gap is a failure, an old one is not.
5. **Every upgrade starts with the report.** Run
   `node scripts/check-sdk.mjs --remote` and read it before touching code.

## What the weekly watch does

`sdk-watch.yml` runs Mondays 06:00 UTC (or on demand) and compares:

| Check                          | Fails when                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| npm                            | a newer `@flexprice/sdk` is published than the installed one          |
| backend spec vs SDK operations | the spec has a route the SDK lacks                                    |
| backend spec vs SDK models     | a spec field is missing from the SDK model, and is not a recorded gap |
| console vs SDK                 | the console calls a method the SDK does not have                      |

On failure it opens one issue labelled `sdk-update` (or comments on the open
one) with the full report.

## Reading the report

```
node scripts/check-sdk.mjs --remote
```

- **operations the console never calls**: SDK coverage the console has not
  used yet. Not a problem; it is the menu for the next feature.
- **backend fields missing from SDK models, `*`**: a field the console reads
  through a type the SDK does not have yet. Wait for the SDK or read it
  through the raw response, but write the gap down.
- **SDK operations the backend spec no longer has**: likely removed or
  renamed upstream. Check before the next upgrade; the webhook payload entries
  are added by the SDK itself and are not counted.

## Limits

- The spec is only as current as the last time the backend regenerated it. If
  a backend PR changes a handler without regenerating the spec, neither the
  SDK nor this check sees it. That is the upstream gap described in
  `docs/api-contract-gap.md`.
- Routes with no swagger annotation are not in the spec or the SDK, so they
  are invisible here.
- Field matching is by name only, not by type.

# Prompt: capture API fixtures into the V2 repo

Copy everything between the lines into whatever is doing the capture.

---

## Task

Capture real API responses from the Flexprice **dev** environment and commit
them as scrubbed JSON fixtures into the V2 console repo.

**Repo:** `https://github.com/dskhairnar/flexprice-console` (private)
**Branch:** `feat/v2-foundation`
**API base URL:** `https://api-dev.cloud.flexprice.io/v1`

## The easy path

A capture script already exists and does all of this, including scrubbing:

```bash
cd packages/query
printf 'FLEXPRICE_API_KEY=<dev key>\n' > .env.local   # gitignored
node scripts/capture.mjs
```

The script loads `.env.local` itself via Node's built-in `process.loadEnvFile`,
so there is nothing to source and no dotenv dependency. An already-exported
`FLEXPRICE_API_KEY` still wins, which is what CI wants.

**Use a key scoped to an environment with real variety.** The key carries its
own environment, so that choice decides fixture quality: an environment where
every invoice is `FINALIZED/PENDING` yields five near-identical rows and
defeats the purpose.

It writes every file to the right place in the right shape. If this works,
stop here, commit the fixtures, and skip the rest.

Optional flags:

```bash
node scripts/capture.mjs --only=customers,invoices   # a subset
node scripts/capture.mjs --raw                        # skip scrubbing: NEVER commit
```

## If capturing by hand instead, this is the contract

### Where the files go

**Exactly this folder. Do not create another.**

```
packages/query/src/__fixtures__/
```

One file per entity, named exactly:

```
customers.json      plans.json         features.json      prices.json
invoices.json       subscriptions.json entitlements.json  wallets.json
coupons.json        addons.json        payments.json      taxrates.json
```

That is 12 files. `creditnotes.json` and `creditgrants.json` are deliberately
absent: see below.

### How to call the API

Every one is a `POST` to a `/search` endpoint. **Do not use the `GET` list
endpoints**: they are undocumented, absent from the SDK, and not what V2
calls.

```
POST https://api-dev.cloud.flexprice.io/v1/<path>
Headers:  x-api-key: <dev API key>
          Content-Type: application/json
Body:     { "limit": 5 }
```

The method differs by entity and is **not** guessable. Do not assume
`POST /<entity>/search` everywhere: four of these have no `/search` route, and
guessing produced 404s that looked like missing annotations but were wrong paths.

**`POST /<entity>/search`, body `{ "limit": 5 }`:**

| File | Path |
|---|---|
| `customers.json` | `/customers/search` |
| `plans.json` | `/plans/search` |
| `features.json` | `/features/search` |
| `prices.json` | `/prices/search` |
| `invoices.json` | `/invoices/search` |
| `subscriptions.json` | `/subscriptions/search` |
| `entitlements.json` | `/entitlements/search` |
| `wallets.json` | `/wallets/search` |
| `coupons.json` | `/coupons/search` |
| `addons.json` | `/addons/search` |

**`GET` with `?limit=5`: these have no `/search` route:**

| File | Path |
|---|---|
| `payments.json` | `/payments` |
| `taxrates.json` | `/taxes/rates` |

**Not capturable at all**: `creditnotes` and `creditgrants` document only
`POST /<entity>` (create) and `GET /<entity>/{id}`. Their `List*` handlers are
live routes carrying no annotation, so there is no documented way to enumerate
them. The script reports them as skipped. **Do not hand-write these files.**

That is **12 fixtures**, not 14.

For `invoices.json` send `{ "limit": 5, "skip_line_items": false }`: the line
items are needed.

An API key carries its own environment, so **no `X-Environment-ID` header and
no login call are required.**

### What each file must contain

**The API's response envelope, verbatim.** Do not unwrap it, rename keys,
convert to camelCase, or "tidy" anything:

```json
{
  "items": [ { ...one record exactly as the API returned it... } ],
  "pagination": { "total": 412, "limit": 5, "offset": 0 }
}
```

Two-space indent, trailing newline.

### How much data

**Five rows per entity is enough.** Do not try to fetch hundreds: larger
volumes will be generated from these seeds.

**Variety matters far more than volume.** If you can influence which rows come
back, prefer a spread over five near-identical ones:

- **invoices**: at least one `DRAFT`, one `FINALIZED` unpaid, one paid, one
  `VOIDED`; ideally one past its `due_date` and one with a large amount
- **features**: one of each `type`: `metered`, `boolean`, `static`, `config`;
  among the metered, at least one `COUNT` and one `SUM`
- **prices**: one of each `billing_model`: `FLAT_FEE`, `PACKAGE`, `TIERED`
- **customers**: one with a full address, one with almost nothing filled in
- **subscriptions**: one active, one cancelled

A record with most optional fields **missing** is more valuable than a complete
one. Those are the cases that break mappers.

### Scrubbing: required before committing

**Preserve exactly:**

- every key, and the presence/absence of every optional field: the shape is
  the entire point
- **all amounts, as strings, unmodified.** `"12345678901234567.89"` must stay
  byte-for-byte. Do not round, do not convert to a number.
- enum values (`FINALIZED`, `SUM_WITH_MULTIPLIER`, `USD`, …)
- id values and their prefixes (`cus_`, `inv_`, `feat_`)
- all timestamps and their ordering

**Replace:**

| Field | With |
|---|---|
| `name`, `company`, `legal_name` | a fake company name |
| any `*email*` | `billing@<alias>.example.com` |
| `external_id`, `external_customer_id` | `ext_<hash>` |
| `phone`, `contact` | `+1 555 0100` |
| `address_*` | a generic address |
| `description`, `notes`, `comment` | generic text of similar length |

Be **consistent**: the same customer must get the same alias everywhere it
appears: in `customers.json`, on its invoice, on its subscription.

`scripts/scrub.mjs` already implements all of this. Prefer reusing it.

### Never do these

- Do not commit the API key. `packages/query/.env.local` is gitignored; use it,
  or an exported shell variable.
- Do not put the key in any `VITE_*` variable: those are compiled into the
  browser bundle and served to every visitor.
- Do not use a production key or a production URL. Dev only.
- Do not commit `--raw` output.
- Do not reshape, flatten, or camelCase the JSON.

### Verify before committing

```bash
# no key anywhere in the staged diff
git diff --cached | grep -i "api[_-]\?key" && echo "STOP: key in diff"

# every fixture is valid JSON with the right envelope
for f in packages/query/src/__fixtures__/*.json; do
  node -e "const d=require('./$f'); if(!Array.isArray(d.items)) throw new Error('$f: missing items[]'); console.log('$f', d.items.length, 'rows')"
done
```

Then commit and push to `feat/v2-foundation`:

```bash
git add packages/query/src/__fixtures__
git commit -m "chore(fixtures): capture scrubbed dev-environment API responses"
git push origin feat/v2-foundation
```

### If something fails

Report the entity name and the HTTP status rather than working around it.

- **404** usually means the endpoint is undocumented: expected for some, and
  it is fine to skip.
- **403** means the key lacks access to that environment or entity.
- **401** means the key is wrong or expired.

Do not substitute a `GET` list endpoint, invent data, or hand-write a fixture
to fill a gap. An honest missing file is more useful than a fabricated one.

---

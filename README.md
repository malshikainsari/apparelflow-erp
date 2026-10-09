# ApparelFlow ERP: Cutting Verification and Sewing Queue Gate

A full-stack implementation of the Cutting Operations & Gatekeeper Verification Terminal for the Webtezza (Pvt) Ltd Software Engineering Intern practical challenge.

A cutting batch can only reach the Sewing Queue after a Cutting Verifier has counted every component and signed it off. Any shortage blocks approval on the server, not just in the UI.

- **Live app:** https://apparelflow-erp-phi.vercel.app/
- **Repository:** https://github.com/malshikainsari/apparelflow-erp
- **AI report:** [AI_OPTIMIZATION_REPORT.md](./AI_OPTIMIZATION_REPORT.md)

## Demo credentials

All three accounts use the password `Demo@1234`. They are also listed on the login page, and a role switcher in the header signs you in as another demo role.

| Role | Email | What they can do |
|---|---|---|
| Cutting Supervisor | supervisor@apparelflow.test | Create cutting orders, track progress, re-submit rejected batches |
| Cutting Verifier | verifier@apparelflow.test | Count components, approve or reject batches |
| Sewing Supervisor | sewing@apparelflow.test | See verified batches only, start sewing assembly |

## Quick walkthrough (about 3 minutes)

1. Sign in as the **Supervisor**. Create an order: Casual Blouse, quantity 50, roll `FAB-ROLL-882`, 92.5 yards. The form previews the expected counts (for example 2 cuffs x 50 = 100).
2. Switch to the **Verifier**. Open the order and enter a shortage (for example 99 cuffs). The row turns red and **Approve batch** is disabled. Only **Reject batch** with a reason works.
3. Fix the counts so every row is green or yellow, then approve. The batch becomes `VERIFIED`, and the verifier, timestamp and wastage are stored.
4. Switch to the **Sewing Supervisor**. The batch appears in the queue with the verifier attribution. Click **Start Sewing Assembly**.
5. Refresh any page. Everything persists in the database.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) with TypeScript, API route handlers |
| UI | Tailwind CSS |
| Database | PostgreSQL on Neon |
| ORM | Prisma 6 |
| Auth | bcrypt password hashes, JWT (`jose`) in an httpOnly cookie |
| Validation | zod (server) plus matching client-side checks |
| Tests | Vitest |
| Hosting | Vercel |

## Architecture

```
src/
  app/
    login/                      public login page with demo credential panel
    (app)/                      pages that need a session (layout redirects to /login)
      supervisor/               order form, order table, re-submit
      verifier/                 QC queue and /verifier/[id] terminal
      sewing/                   verified-only sewing queue
    api/
      auth/{login,logout,me}
      orders/                   list, create
      orders/[id]/              detail, counts, approve, reject, resubmit, start-sewing
      sewing/queue/             the only endpoint that feeds the sewing floor
  lib/
    auth.ts                     JWT creation, session reading, requireRole()
    domain.ts                   pure business rules (multiplier, traffic light, wastage, gate)
    schemas.ts                  zod schemas for every write endpoint
    sewing.ts                   sewing queue queries (status fixed to VERIFIED)
prisma/
  schema.prisma, migrations/, seed.ts
tests/
  domain.test.ts, gatekeeper.test.ts
```

Business rules live in `src/lib/domain.ts` as pure functions. The API routes and the tests call the same functions, and the UI uses them only for live feedback.

## State machine

```
PENDING_VERIFICATION --approve--> VERIFIED --start sewing--> SEWING_STARTED
        |   ^
     reject  re-submit (supervisor)
        v   |
        REJECTED
```

| Transition | Who | Rule |
|---|---|---|
| (new) to PENDING_VERIFICATION | Supervisor | Order created together with one verification item per recipe component |
| PENDING_VERIFICATION to VERIFIED | Verifier | Every component counted and none below expected |
| PENDING_VERIFICATION to REJECTED | Verifier | Reason of at least 5 characters |
| REJECTED to PENDING_VERIFICATION | Supervisor | Counts are cleared so the re-cut batch is counted again |
| VERIFIED to SEWING_STARTED | Sewing Supervisor | Only from VERIFIED |

Each transition is a conditional update (`updateMany ... where status = <expected>`) inside a transaction. If two requests race, only one can move the order.

## Traffic-light rules

| Flag | Condition | Effect |
|---|---|---|
| GREEN | actual == expected | Counts as verified |
| YELLOW | actual > expected | Surplus recorded, batch may proceed |
| RED | actual < expected | Approval blocked (UI disabled, API returns 422) |

An uncounted component also blocks approval.

Fabric wastage is `((actual yards - expected yards) / expected yards) x 100`, where expected yards is `target quantity x std yards per piece`. Example: 50 blouses expect 90 yds; 92.5 yds used gives 2.78%. A negative value means less fabric was used than the standard.

## Database schema

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Accounts | id, email (unique), password_hash, role, full_name, created_at |
| `recipes` | Bill of materials header | id, recipe_code (unique), name, category, std_fabric_yards, wastage_cap |
| `recipe_components` | Cut parts per recipe | id, recipe_id, component_name, pieces_per_garment, image_url |
| `cutting_orders` | Production batches | id, order_no (unique), recipe_id, target_qty, fabric_roll_id, actual_fabric_yds, status, created_by, created_at, updated_at |
| `verification_items` | One row per component per order | id, order_id, component_id, expected_qty, actual_qty (nullable), status (nullable) |
| `verification_logs` | Audit trail of decisions | id, order_id, verifier_id, decision, rejection_note, wastage_pct, timestamp |

Relations: a recipe has many components and orders; an order belongs to a recipe and a creating user, and has many items and logs; a log belongs to an order and a verifier. `cutting_orders.status` is indexed because the sewing queue filters on it.

`actual_qty` and `status` are nullable on purpose, so "not counted yet" is a real state that the gatekeeper can detect.

## API reference

Checks run in this order: 401 (no session), 403 (wrong role), 400 (invalid input), 404 (not found), 409 (wrong state), 422 (gatekeeper rule).

| Method and path | Role | Notes |
|---|---|---|
| POST `/api/auth/login` | public | Sets the session cookie |
| POST `/api/auth/logout` | any | Clears the cookie |
| GET `/api/auth/me` | signed in | Returns the session |
| GET `/api/orders` | supervisor, verifier | List orders |
| POST `/api/orders` | supervisor | Creates an order and its verification items |
| GET `/api/orders/:id` | supervisor, verifier | Order with items and logs |
| PUT `/api/orders/:id/counts` | verifier | Saves counts; the server computes each traffic-light status |
| POST `/api/orders/:id/approve` | verifier | 422 if any component is RED or uncounted |
| POST `/api/orders/:id/reject` | verifier | 400 without a reason note |
| POST `/api/orders/:id/resubmit` | supervisor | REJECTED orders only |
| GET `/api/sewing/queue` | sewing supervisor | Always `WHERE status = 'VERIFIED'` |
| POST `/api/orders/:id/start-sewing` | sewing supervisor | 404 for anything that is not VERIFIED |

## Security notes

- Every protected route calls `requireRole(...)` first. Hidden buttons and page redirects are only a convenience.
- The verifier ID and timestamp come from the signed JWT and the database clock. Request bodies are never trusted for them.
- Request bodies are parsed with zod, which drops unknown fields, so a client cannot send its own `status` or `createdBy`.
- The approve endpoint recomputes the decision from the raw counts. It does not trust the stored status flag.
- The sewing queue query has a fixed `status = 'VERIFIED'` filter and reads no query parameters.
- The start-sewing endpoint answers 404 for orders that are not verified, so a sewing supervisor cannot confirm that a pending order exists.
- Decisions are written to `verification_logs`. No endpoint updates or deletes log rows, and counts are locked once an order leaves `PENDING_VERIFICATION`.

## Input validation

- Batch quantity: whole numbers greater than 0. Decimals, negatives, letters and empty values are rejected.
- Counted pieces: whole numbers, 0 or more.
- Fabric yards: positive, up to 2 decimal places (see design decisions).
- Fabric roll ID: letters, numbers and hyphens, up to 40 characters.
- Rejection reason: 5 to 500 characters.

Number inputs are plain text fields with `inputMode` set, so invalid input shows an inline error instead of being silently blocked by the browser.

## Run locally

```bash
git clone https://github.com/malshikainsari/apparelflow-erp.git
cd apparelflow-erp
npm install
cp .env.example .env        # then fill in DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Use a direct Neon connection locally and the pooled (`-pooler`) one on Vercel |
| `JWT_SECRET` | At least 32 characters, used to sign session tokens |

## Tests

```bash
npm test
```

13 tests in two files. `domain.test.ts` covers the pure rules. `gatekeeper.test.ts` calls the real route handlers with signed session cookies against the database.

| Required test | Covered by |
|---|---|
| 1. All-GREEN order can be approved by a verifier | approve returns 200, status becomes VERIFIED, the log stores the verifier ID from the session and the wastage |
| 2. A RED component blocks approval | approve returns 422 for a shortage and for uncounted components; order stays pending and no log is written |
| 3. Reject without a note is refused | empty, whitespace-only, missing and absent bodies all return 400 |
| 4. Non-verifier roles get 403 | supervisor and sewing roles get 403 on approve and reject; verifier gets 403 on order creation; no session gets 401 |
| 5. Unapproved orders never reach the sewing queue | pending and rejected orders are absent from `getSewingQueue()` while a verified one is present |

The tests create their own orders and delete them afterwards. They run against the configured database and take about 90 seconds against a remote Neon instance.

## Design decisions

- **Fabric yards accept 2 decimals.** The brief says inputs must reject decimals. I applied that strictly to quantities and piece counts. Fabric is measured in fractional yards in practice (for example 92.5), so yards accept up to 2 decimal places. If strict whole numbers are wanted, change the regex in `OrderForm.tsx` and the `refine` in `schemas.ts`.
- **Wastage above the recipe cap does not block approval.** The brief only blocks on shortages. A warning is shown and the value is stored in the audit log.
- **Re-submit keeps history.** Re-submitting a rejected order clears its counts but keeps the rejection log. The counts from the rejected attempt are not kept, only the reason and wastage.
- **Role switcher is for the demo.** It signs in with the public demo credentials through the normal login endpoint. It is not a server-side shortcut and would be removed in a real deployment.

## Known limitations

- The audit trail is immutable by application design (no update or delete paths). It is not enforced with database triggers or permissions.
- There is no rate limiting on login.
- The first request after the database has been idle can take a few seconds, because the serverless Neon database scales to zero.
- Tests share the application database instead of using a separate branch.
- Recipe management is seed-only. There is no UI for editing recipes.
# AI Optimization Report

Project: ApparelFlow ERP, Cutting Verification and Sewing Queue Gate
Author: Malshika


## 1. Tools and prompting

I used Claude (claude.ai chat) as the main assistant. VS Code showed a Copilot chat panel, but I did not use it.

What I used it for:

- **Planning:** splitting the brief into build steps (setup, schema, auth, supervisor, verifier, sewing, tests, deploy).
- **Schema design:** the six required tables as Prisma models, plus enums for roles and statuses.
- **Scaffolding:** auth helpers, API routes, zod schemas, page components, seed script.
- **Styling:** Tailwind layouts. I asked for a minimal black, white and grey look after the first version was too colourful.
- **Test generation:** the Vitest suites for the five required cases.
- **Debugging:** I pasted terminal errors and screenshots and asked for causes.

How I prompted: one step at a time, running each step before asking for the next. I tested the main API guards (403, 400 and 422 responses) from the browser console with `fetch` before relying on the UI built on top of them, and the Vitest suite covers the rest.

## 2. Flawed or sub-optimal AI output

### 2.1 Low-contrast text caused by the scaffolded dark mode (UI)

The first login page set dark text colours on headings and labels but no page background. `create-next-app` ships a `prefers-color-scheme: dark` block in `globals.css`. On my machine that gave a black page, so the heading and the Email and Password labels were dark text on a black background and almost invisible. I caught it from a screenshot.

This is the exact defect the brief calls zero tolerance, and it only appears for evaluators whose operating system uses dark mode.

Fix: I removed the dark-mode block, set `color-scheme: light`, and gave every page wrapper an explicit background and text colour. Inputs, selects and `<option>` elements have explicit white backgrounds and dark text.

### 2.2 Test alias configuration that did not work (tests)

The first `vitest.config.ts` mapped `@` with an object alias. With Vitest 5 every import such as `@/lib/domain` failed with `Cannot find package '@/lib/domain'`, so no tests ran. It also used ESM syntax in a file loaded as CommonJS, which printed a warning.

Fix: I replaced it with a regex alias (`/^@\//`) that resolves to `src/`, and renamed the file to `vitest.config.mts`. All 13 tests then ran.

### 2.3 Extra export in a layout file (framework misuse)

The first draft of the protected layout exported a `ROLE_LABELS` constant from `layout.tsx`. Next.js only expects specific exports from layout files, and extra exports can break the build. I moved the constants to `src/lib/roles.ts` and imported them from there.

## 3. Human refactoring and hardening

Most of the hardening below was suggested by Claude as part of the generated code. My part was choosing the direction (a minimal, high-contrast design), running each piece and testing it directly instead of trusting it, and reporting the failures above so they could be fixed.

- **One home for business rules.** The multiplier, traffic light, wastage formula and approval gate are pure functions in `src/lib/domain.ts`. Routes and tests call the same code, so the rules cannot drift between the API and the UI.
- **The gate does not trust stored flags.** `checkApproval` works from expected and actual counts. If someone edited a stored status in the database, approval would still be blocked by the numbers.
- **Server computes statuses.** The counts endpoint accepts only item IDs and counts. The traffic-light status is calculated on the server and never read from the client.
- **Inputs as text fields.** Number inputs hide invalid values in some browsers. Text fields with `inputMode` and regex checks let me show inline errors for negatives, decimals, letters and empty values. The server repeats the same checks with zod.
- **Atomic state changes.** Approve, reject, re-submit and start-sewing use `updateMany` with the expected current status in the `where` clause, so double clicks and parallel requests cannot apply a transition twice.
- **Narrow error leakage.** Start-sewing returns 404 for anything not in the queue, so a sewing supervisor cannot learn whether a pending order exists.
- **Tests that bypass the UI.** The suite calls the route handlers directly with signed session cookies, which matches how an evaluator would test with Postman or cURL.
- **Design simplified on purpose.** I moved from a colourful layout to black, white and grey with high contrast, and checked the layout at phone width.

## 4. Defensive architecture

**State machine.** Statuses are a Prisma enum. Allowed moves are listed in the README. There is no generic "set status" endpoint. Each move has its own route, its own role check, and a conditional update that only succeeds from the correct previous state.

**Order of checks.** Every write route runs the same sequence: session (401), role (403), input validation (400), existence (404), current state (409), gatekeeper rule (422). A request cannot reach a later check without passing the earlier ones.

**Identity.** The verifier ID and the audit timestamp come from the verified JWT and the database. Zod strips unknown fields, so `status`, `createdBy` or `verifierId` in a request body are ignored.

**Hard stop.** The approve route reads the order's items inside a transaction and runs `checkApproval`. A shortage or an uncounted component returns 422 and writes nothing. The UI also disables the Approve button, but the server does not depend on it.

**Query isolation.** `getSewingQueue()` is the only code that feeds the sewing floor, and its `where: { status: "VERIFIED" }` is fixed in code. The endpoint takes no request object, so query parameters cannot widen it. A test confirms that pending and rejected orders never appear.

**Audit trail.** Approvals and rejections are inserted into `verification_logs` with the verifier ID, timestamp, wastage and rejection note. No route updates or deletes log rows, and counts are locked once an order leaves `PENDING_VERIFICATION`. Immutability is enforced in the application layer. I did not add database triggers or revoke privileges, which would be the next hardening step.

## Other problems that were not AI code

- A peer dependency conflict between `vitest` and `@types/node` 20 during install, fixed by upgrading `@types/node` to 22.
- A corrupted Turbopack cache in `.next` that produced repeated checksum errors, fixed by deleting `.next`.
- A component file created in `src/app/components` instead of `src/components`, which broke the import until I moved it.
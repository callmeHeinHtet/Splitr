# Splitr

> Snap a receipt. Tap who had what. Send everyone a personalized pay link in under a minute.

A mobile-first restaurant bill splitter built around one constraint: **no signup, ever**. You snap a receipt, the app uses Gemini Vision to parse it into typed line items, you tap-assign each item to a person, and the app generates per-friend personalized URLs they can open to see exactly what they owe and pay you via Venmo / PayPal / Cash App.

Live: _[your-vercel-url]_ · Created with Next.js 16 + Postgres + Vercel AI SDK.

---

## What makes it interesting

A bill-split app is a tired prompt. The interesting bits here are the constraints I picked:

**1. No auth, by design.** Friction is the enemy of a 60-second tool. Instead of accounts, the app uses two complementary mechanisms:
   - **localStorage ownership** — when you create a bill, its ID is stored in your browser. That's how the app knows you can edit it (vs. a friend who only has the share link). Not a security boundary, just a UX one — anyone with the bill ID could write it by hand. That's intentional: the share link _is_ the access token.
   - **Per-participant URLs** — every friend gets a unique URL like `/b/{billId}/p/{participantId}`. They land on a read-only page showing only their share, breakdown, and a one-tap pay button. They can't accidentally edit the bill, and they don't need to know anyone else's amounts.

**2. Multi-model AI fallback chain.** Receipt parsing uses Gemini through Vercel AI SDK's `generateObject` with a Zod schema for typed output. The chain falls back through `gemini-2.5-flash → gemini-2.0-flash → gemini-2.5-flash-lite → gemini-2.0-flash-lite` so a single deprecated model name doesn't break parsing in production.

**3. Optimistic UI with save serialization.** Every keystroke updates local state and queues a debounced 350ms PATCH. An in-flight save can't race with the next one — the editor uses an `inFlight` ref and a `pendingDirty` flag so the latest state always wins, and temp IDs (`tmp_*`) for new items get translated to real DB IDs in the response without losing user edits made during the round trip.

**4. Tap-to-assign instead of drag-drop.** Drag-drop on phones is awful. Selecting a person turns every item row into one big tap target with a checkbox indicator on the right — inputs become read-only in assign mode so the entire row is hittable.

**5. Currency-aware formatting.** `formatMoney()` and `formatAmount()` use `Intl.NumberFormat` with `currencyDisplay: "code"`. JPY shows no decimals, MMK shows no decimals, USD/EUR show two — automatically, for any ISO currency code the receipt declares.

---

## How it works (user flow)

1. **`/`** — Snap a receipt (camera or upload). Image hits `/api/parse` → Gemini extracts items, tax, tip, currency. New `Bill` row is created and the browser's localStorage marks you as owner.
2. **`/b/{id}`** — Editor: edit items, add participants, tap a person then tap items to assign. Autosaves silently.
3. **`/b/{id}/summary`** — Per-person cards with itemized breakdown. Set who paid the bill (you) and your Venmo/PayPal handle. Bulk-share group message with all personalized links, or send individually with personalized message templates.
4. **`/b/{id}/p/{pid}`** — Friend-facing page. Big "Hi {name}", "you owe $X to {payer}", itemized breakdown, one-tap pay button that deep-links to Venmo/PayPal with amount pre-filled.
5. **`/history`** — Bills you created on this device, with paid-progress bars and per-bill delete.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Server components for data fetching, client components for interaction |
| Language | TypeScript (strict) | |
| Styling | Tailwind v4 | Custom theme tokens via CSS vars, light/dark mode |
| Database | Postgres | Neon in production, local Postgres in dev |
| ORM | Prisma 7 with `@prisma/adapter-pg` | Adapter mode keeps connections lightweight |
| AI | Vercel AI SDK v6 + Gemini | `generateObject` with Zod schemas for structured output |
| Sharing | Web Share API + clipboard fallback | Native share sheet on mobile, copy on desktop |
| Toasts | react-hot-toast | |
| Fonts | Fraunces (display) + Geist Sans/Mono | Receipt-paper feel |

---

## Architecture decisions

- **Bill-payer model, not splitwise-style settle-up.** One person paid the whole bill; others reimburse them. The app never tracks ledgers between N people. This matches how most restaurant splits actually work and avoids the complexity of multi-creditor reconciliation.

- **Tax/tip distributed proportionally.** Each person's share = `personSubtotal / totalAssignedSubtotal × (tax + tip)`. Floating-point drift is reconciled at the end against the bill's stored total — the last participant absorbs the rounding remainder.

- **Image storage skipped.** The receipt photo is parsed once and discarded. No need for Vercel Blob, no GDPR exposure on uploaded images. If we add re-parse later, the original could be stored.

- **Cascade deletes in schema.** `Bill → BillItem → ItemAssignment` and `Bill → Participant → ItemAssignment` all cascade, so a single `prisma.bill.delete()` cleans up everything. The DELETE endpoint also returns success on `P2025` (row already gone) — idempotent from the client's POV.

- **In-memory rate limit.** `/api/parse` is gated at 10 requests per IP per minute. Lives in-process — fine for a portfolio app, but in serverless each instance has its own counter so a determined abuser hitting cold starts can briefly exceed it. Swap for Vercel KV or `@upstash/ratelimit` for stronger guarantees.

- **Read-only mode via redirect.** Non-owners visiting `/b/{id}` (the editor) are redirected client-side to `/summary`. Non-owners on `/summary` see hidden Edit/PayerSetup/SendToEveryone/MarkPaid controls and a "Shared with you" banner instead.

---

## Local setup

```bash
git clone <this repo>
cd splitr
npm install
cp .env.example .env.local   # fill in values below
npx prisma migrate deploy    # creates tables
npm run dev
```

Required env vars:

```bash
# Local Postgres for dev (recommended)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/splitr"

# Or Neon / Supabase / Vercel Postgres for prod
# DATABASE_URL="postgresql://...neon.tech/splitr?sslmode=require"

# Get one free at https://aistudio.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

For local Postgres on Windows: `winget install PostgreSQL.PostgreSQL.17`, then `createdb splitr`.

---

## Production deploy

Splitr is built to deploy to Vercel:

1. Push to GitHub, import on Vercel.
2. Provision Neon (or any Postgres) via Vercel Marketplace — `DATABASE_URL` auto-injected.
3. Add `GOOGLE_GENERATIVE_AI_API_KEY` in project settings.
4. First deploy runs `prisma generate` automatically (via `postinstall`); after that, `prisma migrate deploy` runs in the build step (configure in `package.json` if not already).

---

## File map

```
src/
├── app/
│   ├── page.tsx                       # landing + upload
│   ├── history/
│   │   ├── page.tsx                   # thin server wrapper
│   │   └── HistoryView.tsx            # client: lists owned bills, delete
│   ├── b/[id]/
│   │   ├── page.tsx                   # server: fetch bill
│   │   ├── BillEditor.tsx             # client: items + participants + assignment
│   │   ├── summary/
│   │   │   ├── page.tsx               # server
│   │   │   └── SummaryView.tsx        # client: per-person cards, payer setup, send links
│   │   └── p/[pid]/
│   │       ├── page.tsx               # server
│   │       └── ParticipantView.tsx    # friend-facing read-only page
│   └── api/
│       ├── parse/route.ts             # POST image → ParsedReceipt (rate-limited)
│       ├── bills/route.ts             # POST create
│       ├── bills/[id]/route.ts        # GET, PATCH, DELETE
│       └── bills/by-ids/route.ts      # POST: batch fetch for ownership-filtered history
├── components/
│   ├── ReceiptUpload.tsx
│   └── DeleteBillButton.tsx
├── lib/
│   ├── prisma.ts                      # Pg adapter, dev-vs-prod SSL switch
│   ├── ai.ts                          # Gemini parse with multi-model fallback
│   ├── split.ts                       # pure split math (deterministic, testable)
│   ├── pay-links.ts                   # provider URL builders + format hints
│   ├── money.ts                       # Intl currency formatters (cached)
│   ├── ownership.ts                   # localStorage owned-bills tracking
│   └── rate-limit.ts                  # in-memory sliding-window limiter
└── types/
    ├── receipt.ts                     # Zod schema for parsed receipt
    └── bill.ts                        # Prisma payload type alias
```

---

## Constraints I'm explicit about

- **localStorage is not portable.** Switching browsers, clearing cookies, or using incognito loses access to your edit list. The bills still exist on the server — anyone with the URL can still view/share them — but the device that "owned" them no longer recognizes them. A real auth layer would fix this. Deferred on purpose.
- **Pay handles aren't validated at input time.** A typo in your Venmo @username makes the link 404. The PayerSetup form shows format hints per provider, but doesn't ping Venmo/PayPal to confirm the handle exists.
- **No payment confirmation.** The app generates pay links and lets you manually mark people paid. There's no Venmo/PayPal webhook integration — that would require platform partnerships.
- **No multi-currency conversion.** Each bill is single-currency, set from the receipt at parse time.

---

## Roadmap (if I keep going)

- Auth + cross-device bill access
- Receipt image storage (Vercel Blob) so you can re-parse if Gemini gets it wrong
- PromptPay support (Thailand) and other regional rails
- Custom split percentages (currently always equal among assignees)
- Push notifications when a friend marks themselves paid
- "Verify handle" preview button on PayerSetup

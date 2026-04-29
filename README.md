# Splitr

Snap a bill. Tag who had what. Send pay links in 30 seconds.

A mobile-first restaurant bill splitter that uses AI vision to parse a receipt photo into line items, lets you tap-assign each item to a person, and generates Venmo / PayPal / Cash App payment links per person.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Prisma 7** with the Neon serverless adapter
- **Postgres** (Neon)
- **Vercel AI SDK** + **Gemini 2.0 Flash** for receipt OCR
- **react-hot-toast** for feedback

## How it works

1. **`/`** — Snap a receipt. The image is sent to `/api/parse`, which calls Gemini Flash with a Zod-typed schema to extract structured line items, tax, tip, and total.
2. **`/api/bills`** — A `Bill` row is created with its items.
3. **`/b/[id]`** — Editable item list, plus a participants tab and a tap-to-assign UI. Selecting a person and tapping items toggles assignment. State autosaves via debounced `PATCH`.
4. **`/b/[id]/summary`** — Per-person total card, with each person's items, proportional tax/tip share, and a generated payment link they can open or copy.

## Setup

```bash
git clone <this repo>
cd splitr
npm install
cp .env.local.example .env.local   # then fill in
npx prisma migrate deploy            # applies migrations to your Postgres
npm run dev
```

### Required env vars (`.env.local`)

```bash
# Postgres connection string
DATABASE_URL="postgresql://..."

# https://aistudio.google.com/app/apikey  (free tier covers dev easily)
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

## Architecture decisions

- **No auth in v1.** A bill's URL is the access token. Anyone with the link can edit. This is intentional — the goal is "send a link to your friends in 5 seconds." Auth becomes useful later (history of bills you've created).
- **Tap-to-assign over drag-drop.** Drag-drop on phones is awful. Selecting a person, then tapping items to toggle, is faster and more accessible.
- **Debounced autosave.** Each local edit updates state immediately and queues a single `PATCH` 350ms later. The server replaces items/participants by ID — temp IDs (prefix `tmp_`) get created server-side, then their real IDs come back in the response.
- **Tax/tip distributed proportionally.** Each person's share = `personSubtotal / totalAssignedSubtotal × (tax + tip)`. Floating-point drift is reconciled at the end against the bill's total.
- **Image storage skipped in v1.** The image is only used at parse time.
- **Prisma 7 + Neon adapter.** Direct (non-pooled) connection through `@prisma/adapter-neon`, which keeps the connection lightweight under serverless.

## File map

```
src/
├── app/
│   ├── page.tsx                       # landing, upload
│   ├── b/[id]/
│   │   ├── page.tsx                   # server: fetch bill
│   │   ├── BillEditor.tsx             # client: items + participants + assignment
│   │   └── summary/
│   │       ├── page.tsx               # server
│   │       └── SummaryView.tsx        # client: per-person totals + pay links
│   └── api/
│       ├── parse/route.ts             # POST image → ParsedReceipt
│       ├── bills/route.ts             # POST create bill
│       └── bills/[id]/route.ts        # GET, PATCH
├── components/
│   └── ReceiptUpload.tsx
├── lib/
│   ├── prisma.ts                      # Prisma client (Neon adapter)
│   ├── ai.ts                          # Gemini receipt parser
│   ├── split.ts                       # pure split math
│   └── pay-links.ts                   # Venmo/PayPal/Cash App URL builders
└── types/
    ├── receipt.ts                     # Zod schema for parsed receipt
    └── bill.ts                        # Prisma payload type alias
```

## Deferred to v2

- Auth + per-user bill history
- Editable shared-percentage splits (currently always equal)
- Multi-currency conversion
- PWA / offline mode
- Receipt image storage (Vercel Blob)
- Push notifications for "X paid you back"

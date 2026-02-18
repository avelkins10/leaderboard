# Connections & Environment

## Environment Variables (Vercel)

All env vars are set in Vercel project settings. Local dev uses `.env.local`.

| Variable | Description |
|----------|-------------|
| `REPCARD_API_KEY` | RepCard API authentication key |
| `QB_API_TOKEN` | QuickBase API user token |
| `QB_REALM` | `kin.quickbase.com` |
| `QB_PROJECTS_TABLE` | `br9kwm8na` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side writes) |
| `SUPABASE_SERVICE_KEY` | Alias for service role key (legacy) |
| `SUPABASE_URL` | Alias for Supabase URL (legacy) |

## Service Details

### RepCard
- **Base URL**: `https://app.repcard.com/api`
- **Auth**: `x-api-key` header with `REPCARD_API_KEY`
- **Rate limits**: Unknown / undocumented — be respectful
- **Pagination**: `per_page` + `page` params, response includes `totalPages`

### QuickBase
- **Realm**: `kin.quickbase.com`
- **Auth**: `QB-USER-TOKEN` header with `QB_API_TOKEN`
- **Projects table**: `br9kwm8na` (2,134 fields)
- **Query endpoint**: `POST https://api.quickbase.com/v1/records/query`
- **Rate limits**: Standard QB limits apply

### Supabase
- **Project URL**: `https://yijofudhciynjzsmpsqp.supabase.co`
- **Client**: Lazy-loaded via `supabase.ts` (proxy pattern for backward compat)
- **Admin client**: Uses `SUPABASE_SERVICE_ROLE_KEY` for writes
- **Anon client**: Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for reads

### Vercel
- **Project**: `kin-sales-intel`
- **Production URL**: `https://kin-sales-intel.vercel.app`
- **Deployment Protection**: OFF (public access)
- **GitHub repo**: `https://github.com/avelkins10/leaderboard` (main branch)
- **Deploy token**: Set in CI / local env

## Webhook URLs

All 7 RepCard webhooks point to our Vercel deployment:

| Event | URL |
|-------|-----|
| Appointment Set | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/appointment-set` |
| Appointment Update | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/appointment-update` |
| Appointment Outcome | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/appointment-outcome` |
| Closer Update | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/closer-update` |
| Door Knocked | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/door-knocked` |
| Status Changed | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/status-changed` |
| Contact Type Changed | `https://kin-sales-intel.vercel.app/api/webhooks/repcard/contact-type-changed` |

**Authentication**: None currently (deprioritized). Webhooks are unauthenticated POST requests.

## Backfill Endpoint

`POST https://kin-sales-intel.vercel.app/api/backfill?key=backfill2026`

Used for one-time historical data imports. Protected by query param key.

## Local Development

```bash
cp .env.local.example .env.local  # Fill in values from Vercel
npm install
npm run dev
# → http://localhost:3000
```

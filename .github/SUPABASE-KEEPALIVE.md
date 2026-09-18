# Supabase keep-alive (GitHub Actions)

Three redundant workflows ping the Supabase project twice a day so free-tier
projects are less likely to pause from inactivity.

| Workflow | When it runs | Retries |
|----------|--------------|---------|
| **A** `supabase-keepalive-a.yml` | 06:00 & 18:00 UTC (primary, twice daily) | 3 attempts |
| **B** `supabase-keepalive-b.yml` | If **A fails**, plus 06:20 & 18:20 UTC backup | 3 attempts |
| **C** `supabase-keepalive-c.yml` | **Only if B fails** (A+B already failed) | 4 attempts |

Each attempt hits:
1. `GET /auth/v1/health`
2. `GET /rest/v1/` (API/DB activity)

## Required repository secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|--------|
| `SUPABASE_URL` | `https://kamwbhwioivuosumzrkv.supabase.co` |
| `SUPABASE_ANON_KEY` | Project anon/public key from Supabase → Settings → API |

## Manual test

Actions → pick **Supabase Keepalive A** (or B/C) → **Run workflow**.

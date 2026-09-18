# Supabase keep-alive (GitHub Actions)

| Workflow | When it runs | Retries |
|----------|--------------|---------|
| **A** | Every day at **06:00 IST** (00:30 UTC) | 3 attempts |
| **B** | Every day at **18:00 IST** (12:30 UTC) | 3 attempts |
| **C** | **Only if A or B fails** (no schedule) | 4 attempts |

Each attempt hits:
1. `GET /auth/v1/health`
2. `GET /rest/v1/` (API/DB activity)

## Required repository secrets

| Secret | Value |
|--------|--------|
| `SUPABASE_URL` | `https://….supabase.co` |
| `SUPABASE_ANON_KEY` | Project anon/public key |

## Manual test

Actions → **Supabase Keepalive A** / **B** / **C** → **Run workflow**.

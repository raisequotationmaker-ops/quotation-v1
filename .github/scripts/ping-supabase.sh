#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "::error::SUPABASE_URL and SUPABASE_ANON_KEY are required"
  exit 1
fi

URL="${SUPABASE_URL%/}"
ATTEMPTS="${ATTEMPTS:-3}"
DELAY_SECONDS="${DELAY_SECONDS:-20}"
LABEL="${LABEL:-keepalive}"

auth_url="${URL}/auth/v1/health"
rest_url="${URL}/rest/v1/"

ping_once() {
  local attempt="$1"
  echo "[${LABEL}] attempt ${attempt}/${ATTEMPTS} → Auth health"
  local auth_code
  auth_code="$(curl -sS -o /tmp/sb-auth-body.txt -w "%{http_code}" \
    --connect-timeout 20 --max-time 45 \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    "${auth_url}" || true)"

  echo "[${LABEL}] Auth HTTP ${auth_code}"
  head -c 200 /tmp/sb-auth-body.txt || true
  echo

  # Auth health should be 200 when the API is up.
  if [[ "${auth_code}" != "200" ]]; then
    echo "[${LABEL}] Auth ping failed"
    return 1
  fi

  echo "[${LABEL}] attempt ${attempt}/${ATTEMPTS} → REST root (DB/API activity)"
  local rest_code
  rest_code="$(curl -sS -o /tmp/sb-rest-body.txt -w "%{http_code}" \
    --connect-timeout 20 --max-time 45 \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    "${rest_url}" || true)"

  echo "[${LABEL}] REST HTTP ${rest_code}"
  head -c 120 /tmp/sb-rest-body.txt || true
  echo

  # PostgREST root normally returns 200; treat 2xx/401/404 as "reachable".
  # 5xx / 000 / empty means the project is still down.
  if [[ "${rest_code}" =~ ^(200|401|404)$ ]]; then
    echo "[${LABEL}] ping OK"
    return 0
  fi

  echo "[${LABEL}] REST ping failed"
  return 1
}

for i in $(seq 1 "${ATTEMPTS}"); do
  if ping_once "${i}"; then
    echo "[${LABEL}] success on attempt ${i}"
    exit 0
  fi
  if [[ "${i}" -lt "${ATTEMPTS}" ]]; then
    echo "[${LABEL}] waiting ${DELAY_SECONDS}s before retry…"
    sleep "${DELAY_SECONDS}"
  fi
done

echo "::error::[${LABEL}] all ${ATTEMPTS} ping attempts failed"
exit 1

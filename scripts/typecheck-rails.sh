#!/usr/bin/env bash
# Type-check src/lib/rails only.
#
# tsc follows imports, so once the adapters import $lib/walletService the
# program also contains pre-existing errors from files we are not changing
# (EsploraClient.ts, secureStorage.ts — part of the ~185 repo-wide errors).
# Report only diagnostics whose file lives under src/lib/rails.
set -uo pipefail

TSC=./node_modules/.bin/tsc
CONFIG=tsconfig.rails.json

if [ ! -x "$TSC" ]; then
  echo "typecheck-rails: $TSC not found or not executable" >&2
  exit 2
fi

if [ ! -f "$CONFIG" ]; then
  echo "typecheck-rails: $CONFIG not found" >&2
  exit 2
fi

# tsconfig.rails.json extends .svelte-kit/tsconfig.json, which is gitignored
# and generated. Without it tsc silently ignores the extends target and
# reports dozens of phantom errors that look exactly like real ones.
if [ ! -f .svelte-kit/tsconfig.json ]; then
  echo "typecheck-rails: .svelte-kit/tsconfig.json missing — run 'bunx svelte-kit sync' first" >&2
  exit 2
fi

out=$("$TSC" -p "$CONFIG" --pretty false 2>&1)
status=$?

# A config-level failure produces no per-file diagnostics, so filtering for
# rails paths would find nothing and this would report success. Treat those
# as a hard failure rather than a pass.
if printf '%s\n' "$out" | grep -qE 'error TS(5[0-9]{3}|18[0-9]{3})'; then
  echo "typecheck-rails: tsc configuration error, not a clean run:" >&2
  printf '%s\n' "$out" >&2
  exit 2
fi

# Exit 0 with no output is a genuinely clean run. Any other non-zero exit
# that produced no diagnostics at all means tsc failed to run properly.
if [ "$status" -ne 0 ] && [ -z "$(printf '%s\n' "$out" | grep -E 'error TS')" ]; then
  echo "typecheck-rails: tsc exited $status without diagnostics:" >&2
  printf '%s\n' "$out" >&2
  exit 2
fi

ours=$(printf '%s\n' "$out" | grep -E '^src/lib/rails/' || true)

if [ -n "$ours" ]; then
  echo "Type errors in src/lib/rails:"
  printf '%s\n' "$ours"
  exit 1
fi

echo "src/lib/rails: no type errors"
exit 0

#!/usr/bin/env sh
set -eu

if command -v pnpm >/dev/null 2>&1; then
  run_pnpm() { pnpm "$@"; }
else
  run_pnpm() { npx -y pnpm@11.22.0 "$@"; }
fi

run_pnpm install
run_pnpm db:migrate
run_pnpm seed
run_pnpm dev

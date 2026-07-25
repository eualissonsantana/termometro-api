#!/usr/bin/env bash

set -euo pipefail

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(cd "$API_DIR/../termometro-web" && pwd)"

if [[ ! -d "$WEB_DIR" ]]; then
  echo "[dev-all] frontend nao encontrado em $WEB_DIR"
  exit 1
fi

API_PID=""
WEB_PID=""

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "[dev-all] iniciando API em $API_DIR"
(cd "$API_DIR" && npm run dev) &
API_PID=$!

echo "[dev-all] iniciando WEB em $WEB_DIR"
(cd "$WEB_DIR" && npm run dev) &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID"

#!/bin/bash
# Expose AcadTrack locally via Cloudflare quick tunnel.
# Requires: backend (5002), frontend (3000), python_service (5001) running.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Cloudflare tunnel to http://localhost:3000 ..."
echo "API requests are proxied via /api -> localhost:5002"
echo ""

cloudflared tunnel --url http://localhost:3000 2>&1 | tee "$ROOT/tunnel.log"

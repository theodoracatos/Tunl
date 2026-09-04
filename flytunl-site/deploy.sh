#!/usr/bin/env bash
# ============================================================
#  deploy.sh - publish the flytunl.ch static site (FTP)
# ============================================================
#  Requires: lftp  ->  brew install lftp
#
#  Credentials come from .env (never commit it!):
#    FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
    # shellcheck disable=SC1091
    set -a; source .env; set +a
fi

FTP_HOST="${FTP_HOST:-flytunl.ch}"
FTP_USER="${FTP_USER:-}"
FTP_PASSWORD="${FTP_PASSWORD:-}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-/httpdocs}"

if [ -z "$FTP_USER" ] || [ -z "$FTP_PASSWORD" ]; then
    echo "FTP_USER or FTP_PASSWORD not set."
    echo "Copy .env.example to .env and fill in the password."
    exit 1
fi

if ! command -v lftp &>/dev/null; then
    echo "lftp not found. Install with: brew install lftp"
    exit 1
fi

# Assemble site/play/ (the web build) from the repo root game files. Regenerated
# on every deploy so it can never drift from src/. See build-play.mjs.
echo "Building site/play/ ..."
(
    cd ..
    [ -d node_modules/terser ] || npm install --no-audit --no-fund --silent
    npm run --silent build:play
)

echo "Uploading site/ to $FTP_HOST$FTP_REMOTE_DIR ..."
lftp -u "$FTP_USER,$FTP_PASSWORD" "ftp://$FTP_HOST" <<LFTP_UPLOAD
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 3
set ftp:use-site-chmod false
mirror --reverse --verbose --parallel=4 --no-perms \
  site/ $FTP_REMOTE_DIR/
bye
LFTP_UPLOAD

echo ""
echo "Done -> https://flytunl.ch"

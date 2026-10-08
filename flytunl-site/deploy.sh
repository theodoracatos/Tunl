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

# Generate the localized homepage (site/index.html + site/<lang>/) from
# home.src.html + i18n/home.json. Pure Node stdlib, no deps. See build-site.mjs.
echo "Building localized homepage ..."
node build-site.mjs

# Localized guide pages (site/<lang>/<page>/). MUST run after build-site.mjs,
# which rewrites site/<lang>/ and would otherwise leave only the homepage there.
echo "Building localized guide pages ..."
node build-pages.mjs

echo "Uploading site/ to $FTP_HOST$FTP_REMOTE_DIR ..."
# The login goes through stdin and the environment, never the command line: an argument
# shows in every process listing while the upload runs (2026-10-08, the new password
# surfaced in a session's pgrep). LFTP_PASSWORD is set for this one lftp process only.
LFTP_PASSWORD="$FTP_PASSWORD" lftp <<LFTP_UPLOAD
open --env-password -u "$FTP_USER" "ftp://$FTP_HOST"
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate no
set net:timeout 30
set net:max-retries 3
set ftp:use-site-chmod false
# Hostfactory (2026-10-06): the FIRST TLS data connection of a session fails (SSL_connect error,
# reported as 550) and the mirror aborts on it. Burn it on a throwaway listing, then drop the
# cached failure before mirroring. One connection only: every extra --parallel session hits
# the same first-connection failure and loses the directory it was given.
cls -1 $FTP_REMOTE_DIR/ > /dev/null
cache flush
mirror --reverse --verbose --no-perms \
  site/ $FTP_REMOTE_DIR/
# A second pass picks up the odd file a single 550 dropped mid-run (2026-10-06: one Greek
# page); everything the first pass uploaded is already newer remotely and is skipped.
mirror --reverse --verbose --no-perms \
  site/ $FTP_REMOTE_DIR/
bye
LFTP_UPLOAD

echo ""
echo "Done -> https://flytunl.ch"

#!/bin/bash
# Archive the iOS app and upload it to App Store Connect from the command line
# (the "xcodebuild" route of developer.apple.com/help/app-store-connect/manage-builds/upload-builds).
#
#   Tunl/upload-ios.sh            archive + upload
#   Tunl/upload-ios.sh --dry-run  archive + sign + export an .ipa locally, no upload
#
# Authentication, first match wins:
#   1. App Store Connect API key: ~/.appstoreconnect/tunl.env with
#        ASC_KEY_ID=XXXXXXXXXX
#        ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#      and the key file at ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8.
#      Never put the .p8 inside the repo.
#   2. Otherwise the Apple ID signed in under Xcode > Settings > Accounts.
#
# The build number is not bumped here: /release does that (CURRENT_PROJECT_VERSION).
# ASC refuses a build number it has seen before, so bump first.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
PROJECT="Tunl/Tunl.xcodeproj"
SCHEME="Tunl"
EXPORT_PLIST="Tunl/ExportOptions-upload.plist"

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

pbx() { grep -m1 "$1 = " "$PROJECT/project.pbxproj" | sed -E "s/.*$1 = ([^;]+);.*/\1/"; }
VERSION="$(pbx MARKETING_VERSION)"
BUILD="$(pbx CURRENT_PROJECT_VERSION)"
JS_VERSION="$(sed -nE "s/.*TUNL_VERSION *= *['\"]([^'\"]+)['\"].*/\1/p" src/constants.js | head -1)"

echo "TUNL iOS $VERSION ($BUILD)"
if [[ -n "$JS_VERSION" && "$JS_VERSION" != "$VERSION" ]]; then
  echo "error: TUNL_VERSION in src/constants.js is $JS_VERSION, Xcode says $VERSION. Run /release first." >&2
  exit 1
fi
if grep -qE '^\s*(const|var|let)\s+DEV_[A-Z_]+\s*=\s*true' src/constants.js; then
  echo "error: a DEV_* flag is true in src/constants.js - it would ship in the app." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain -- src tunl.html Tunl/Tunl)" ]]; then
  echo "warning: uncommitted changes in src/, tunl.html or Tunl/Tunl - they go into this build:"
  git status --short -- src tunl.html Tunl/Tunl
  read -r -p "Continue anyway? [y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

AUTH=()
ENV_FILE="$HOME/.appstoreconnect/tunl.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
  if [[ ! -f "$KEY_PATH" ]]; then
    echo "error: $ENV_FILE names key $ASC_KEY_ID but $KEY_PATH is missing." >&2
    exit 1
  fi
  AUTH=(-authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  echo "auth: App Store Connect API key $ASC_KEY_ID"
else
  echo "auth: Apple ID from Xcode > Settings > Accounts (no $ENV_FILE)"
fi

OUT="$ROOT/build/ios-$VERSION-$BUILD"
ARCHIVE="$OUT/TUNL.xcarchive"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "==> archive"
xcodebuild archive \
  -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} \
  -quiet

PLIST="$EXPORT_PLIST"
if (( DRY_RUN )); then
  PLIST="$OUT/ExportOptions-dryrun.plist"
  cp "$EXPORT_PLIST" "$PLIST"
  /usr/libexec/PlistBuddy -c "Set :destination export" "$PLIST"
fi

echo "==> export$( (( DRY_RUN )) || echo " + upload" )"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$PLIST" \
  -exportPath "$OUT/export" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}

if (( DRY_RUN )); then
  echo "dry run done: $(ls "$OUT"/export/*.ipa). Nothing was uploaded."
else
  echo "uploaded $VERSION ($BUILD). App Store Connect shows it under TestFlight once processing finishes (usually 5-30 min)."
fi

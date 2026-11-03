#!/usr/bin/env bash
# Archive the Release build and upload it to App Store Connect / TestFlight.
#
# Needs: Xcode, xcodegen, the "Apple Distribution" identity for team S768Y6EZW8 in the
# login keychain, the "Artemis CRM App Store" provisioning profile installed, and the
# App Store Connect API key at ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8.
#
# Usage: ASC_KEY_ID=Z2V9ZWZNCA ASC_ISSUER_ID=<issuer> ios/scripts/testflight.sh [build-number]
set -euo pipefail

cd "$(dirname "$0")/.."
: "${ASC_KEY_ID:?set ASC_KEY_ID}"
: "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
WORK="${TMPDIR:-/tmp}/artemis-testflight"
BUILD_NUMBER="${1:-$(date +%Y%m%d%H%M)}"

# Homebrew rsync breaks Xcode's IPA packaging ("Copy failed"); use the system tools first.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

rm -rf "$WORK" && mkdir -p "$WORK"
xcodegen generate -q

xcodebuild archive \
  -project ArtemisCRM.xcodeproj -scheme ArtemisCRM -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$WORK/ArtemisCRM.xcarchive" -derivedDataPath "$WORK/dd" \
  DEVELOPMENT_TEAM=S768Y6EZW8 CURRENT_PROJECT_VERSION="$BUILD_NUMBER"

xcodebuild -exportArchive \
  -archivePath "$WORK/ArtemisCRM.xcarchive" \
  -exportOptionsPlist scripts/ExportOptions.plist -exportPath "$WORK/export" \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo "Uploaded build $BUILD_NUMBER. It appears in TestFlight after Apple finishes processing."

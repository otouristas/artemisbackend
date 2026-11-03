#!/bin/zsh
# Build, install and launch Artemis CRM in the simulator.
# Usage: scripts/run-demo.sh [extra launch args...]   e.g. scripts/run-demo.sh -DemoMode -DemoRoute requests/detail
set -e
cd "$(dirname "$0")/.."
DEVICE="${SIM_DEVICE:-iPhone 18 Pro Max}"
xcodegen generate >/dev/null
xcodebuild -project ArtemisCRM.xcodeproj -scheme ArtemisCRM -configuration Debug \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath build/DerivedData -clonedSourcePackagesDirPath build/SourcePackages build -quiet
APP=build/DerivedData/Build/Products/Debug-iphonesimulator/ArtemisCRM.app
xcrun simctl boot "$DEVICE" 2>/dev/null || true
open -a Simulator
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl terminate "$DEVICE" gr.artemisrental.crm 2>/dev/null || true
xcrun simctl launch "$DEVICE" gr.artemisrental.crm "$@"

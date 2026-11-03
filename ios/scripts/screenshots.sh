#!/bin/zsh
# Capture every main screen in demo mode, light and dark, into ios/screenshots/.
# Requires a booted simulator with the app installed (scripts/run-demo.sh) and notifications allowed once.
cd "$(dirname "$0")/.."
OUT=screenshots
mkdir -p $OUT
xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
shot() { # name route appearance [extra args]
  local name=$1 route=$2 mode=$3; shift 3
  xcrun simctl ui booted appearance $mode
  xcrun simctl launch --terminate-running-process booted gr.artemisrental.crm -DemoMode -DemoRoute "$route" "$@" >/dev/null
  sleep ${SHOT_DELAY:-10}
  xcrun simctl io booted screenshot "$OUT/$name-$mode.png" >/dev/null 2>&1
  echo "$OUT/$name-$mode.png"
}
# Warm-up launch (the first launch after install is slow).
xcrun simctl launch --terminate-running-process booted gr.artemisrental.crm -DemoMode >/dev/null; sleep 12
for mode in ${=MODES:-light dark}; do
  for spec in ${=SCREENS:-"01-today:today" "02-bookings:bookings" "03-booking-detail:bookings/detail" "04-requests:requests" "05-request-detail:requests/detail" "06-fleet:fleet" "07-vehicle-detail:fleet/detail" "08-more:more" "09-clients:more/clients" "10-client-detail:more/client" "11-money:more/money" "12-settings:more/settings" "13-new-booking:today/new" "14-accept-request:requests/accept"}; do
    shot ${spec%%:*} ${spec#*:} $mode
  done
done
xcrun simctl ui booted appearance light

#!/bin/zsh
# Capture the screens in demo mode, light and dark, into ios/screenshots/ as JPEG, 660 px wide.
# Requires a booted simulator with the app installed (scripts/run-demo.sh) and notifications allowed once.
#   SCREENS="16-booking-checklist:bookings/checklist" MODES=dark scripts/screenshots.sh
# A spec is name:route[:extra launch args separated by commas]. Route "-" = no -DemoRoute.
cd "$(dirname "$0")/.."
OUT=screenshots
mkdir -p $OUT
xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
shot() { # name route appearance extra
  local name=$1 route=$2 mode=$3 extra=$4
  local -a args; args=(-DemoMode -DemoAppearance $mode)
  [[ $route != "-" ]] && args+=(-DemoRoute $route)
  [[ -n $extra ]] && args+=(${(s:,:)extra})
  xcrun simctl ui booted appearance $mode
  xcrun simctl launch --terminate-running-process booted gr.artemisrental.crm $args >/dev/null
  sleep ${SHOT_DELAY:-10}
  xcrun simctl io booted screenshot "$OUT/$name-$mode.png" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 72 --resampleWidth 660 "$OUT/$name-$mode.png" --out "$OUT/$name-$mode.jpg" >/dev/null && rm "$OUT/$name-$mode.png"
  echo "$OUT/$name-$mode.jpg"
}
DEFAULT=(
  "01-today:today" "02-bookings:bookings" "03-booking-detail:bookings/detail" "04-requests:requests"
  "05-request-detail:requests/detail" "06-fleet:fleet" "07-vehicle-detail:fleet/detail" "08-more:more"
  "09-clients:more/clients" "10-client-detail:more/client" "11-money:more/money" "12-settings:more/settings"
  "13-new-booking:today/new" "14-accept-request:requests/accept"
  "16-booking-checklist:bookings/checklist" "17-new-checklist:bookings/checklist/new" "18-booking-fees:bookings/edit"
  "19-delete-booking:bookings/delete" "20-client-merge:more/client" "21-client-merge-confirm:more/client/merge"
  "22-fleet-maintenance:fleet/maintenance" "23-new-block:fleet/block" "24-vehicle-edit:fleet/edit"
  "25-new-vehicle:fleet/new" "26-add-units:fleet/units"
  "28-splash:-:-DemoHoldSplash"
  "29-onboarding-1:-:-ResetOnboarding,-OnboardingPage,0" "30-onboarding-2:-:-ResetOnboarding,-OnboardingPage,1"
  "31-onboarding-3:-:-ResetOnboarding,-OnboardingPage,2" "32-onboarding-4:-:-ResetOnboarding,-OnboardingPage,3,-DemoNotificationsUnasked"
)
# Warm-up launch (the first launch after install is slow).
xcrun simctl launch --terminate-running-process booted gr.artemisrental.crm -DemoMode >/dev/null; sleep 12
specs=(${=SCREENS})
(( ${#specs} )) || specs=($DEFAULT)
for mode in ${=MODES:-light dark}; do
  for spec in $specs; do
    name=${spec%%:*}; rest=${spec#*:}
    route=${rest%%:*}; extra=""
    [[ $rest == *:* ]] && extra=${rest#*:}
    shot $name $route $mode "$extra"
  done
done
xcrun simctl ui booted appearance light

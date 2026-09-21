#!/usr/bin/env bash
# Builds a Release app and installs it on a connected iPhone.
#
# Free Apple teams sign builds that expire after 7 days; run this again to renew.
# `expo run:ios` cannot be used here: it omits -allowProvisioningUpdates, so Xcode is not
# allowed to create the provisioning profiles a new team or bundle ID needs.
#
# Usage: pnpm ios:device [device-udid]
set -euo pipefail

cd "$(dirname "$0")/../ios"

DEVICE="${1:-$(xcrun xctrace list devices 2>/dev/null \
  | sed -n '/== Devices ==/,/== Simulators ==/p' \
  | grep -i iphone | head -1 | sed -E 's/.*\(([0-9A-F-]+)\)$/\1/')}"

if [ -z "$DEVICE" ]; then
  echo "No iPhone found. Connect and unlock it, then try again." >&2
  exit 1
fi

echo "Building Release for $DEVICE ..."
xcodebuild -workspace RemindMe.xcworkspace -scheme RemindMe -configuration Release \
  -destination "id=$DEVICE" -derivedDataPath build/device -allowProvisioningUpdates \
  -quiet build

echo "Installing ..."
xcrun devicectl device install app --device "$DEVICE" \
  build/device/Build/Products/Release-iphoneos/RemindMe.app

echo "Done. Open RemindMe on the phone."

#!/bin/zsh
# The app on the iPhone simulator, live: every save in VS Code shows in the app at once (like localhost).
#   npm run app:dev            the clean app (TestFlight's look)
#   APP_FULL=1 npm run app:dev the regular app
# It starts its own dev server (port 5180) in app mode, points the simulator's app at it, builds the native shell
# once, installs it and opens it. Ctrl+C stops the server. (Xcode 27 has no Simulator.app: DeviceHub shows the phone.)
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
PORT=5180
DEVICE="${SIM:-iPhone 17}"

# the phone: booted, or boot it
ID=$(xcrun simctl list devices available | grep -m1 "$DEVICE (" | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
[ -z "$ID" ] && { echo "No simulator called '$DEVICE'. Run: xcodebuild -downloadPlatform iOS"; exit 1; }
xcrun simctl boot "$ID" 2>/dev/null || true
open /Applications/Xcode.app/Contents/Applications/DeviceHub.app 2>/dev/null || open -a Simulator 2>/dev/null || true

# the dev server, in app mode (clean unless APP_FULL=1)
if [ -z "$APP_FULL" ]; then export VITE_CLEAN=1; fi
npx vite --mode app --port $PORT --strictPort --host 127.0.0.1 &
VITE=$!
trap 'kill $VITE 2>/dev/null' EXIT INT TERM
for i in {1..60}; do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done

# the native shell, pointed at the dev server (the copied config is generated and gitignored; a real build resets it)
mkdir -p dist; [ -f dist/index.html ] || echo '<!doctype html>' > dist/index.html
npx cap copy ios >/dev/null
node -e "
const f='ios/App/App/capacitor.config.json', c=JSON.parse(require('fs').readFileSync(f,'utf8'));
c.server={...(c.server||{}), url:'http://localhost:$PORT', cleartext:true};
require('fs').writeFileSync(f, JSON.stringify(c, null, 2))"
echo "Building the app shell (the first time takes a minute)..."
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination "id=$ID" \
  -derivedDataPath /tmp/bap-ios-dev -quiet build
xcrun simctl install "$ID" /tmp/bap-ios-dev/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$ID" com.buildaplayer.app >/dev/null
echo ""
echo "Live on the $DEVICE simulator. Save in VS Code and it updates. Ctrl+C to stop."
wait $VITE

#!/bin/sh
# Renders og.png and apple-touch-icon.png from tools/*.html with headless Chrome.
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --virtual-time-budget=5000 --window-size="$2" --screenshot="$PWD/$3" "file://$PWD/tools/$1" 2>/dev/null; }
shot og.html 1200,630 og.png
shot icon.html 180,180 apple-touch-icon.png
ls -la og.png apple-touch-icon.png

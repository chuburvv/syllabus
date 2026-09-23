#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
prepare_xcode
mkdir -p "$BOOK_ROOT/build/checks"
/usr/bin/xcodebuild -project "$BOOK_ROOT/InteractiveBook.xcodeproj" -scheme InteractiveBook \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$BOOK_ROOT/build/simulator" CODE_SIGNING_ALLOWED=NO build
/usr/bin/xcrun swiftc "$BOOK_ROOT/Tests/WebKitSmoke.swift" -o "$BOOK_ROOT/build/checks/webkit-smoke" -framework Cocoa -framework WebKit
"$BOOK_ROOT/build/checks/webkit-smoke" "$BOOK_ROOT/InteractiveBook/WebContent" "$BOOK_ROOT/Tests" 390 760
"$BOOK_ROOT/build/checks/webkit-smoke" "$BOOK_ROOT/InteractiveBook/WebContent" "$BOOK_ROOT/Tests" 320 568

#!/bin/bash
# Sourced by the entry points. Compatible with the Bash shipped with macOS.
set -euo pipefail
BOOK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail() { printf '\nОшибка: %s\n' "$*" >&2; exit 1; }
prepare_xcode() {
  [[ "$(uname -s)" == Darwin ]] || fail 'Для установки на iPhone нужен Mac с Xcode.'
  local candidate="${DEVELOPER_DIR:-}"
  if [[ -n "$candidate" ]]; then
    [[ -x "$candidate/usr/bin/xcodebuild" ]] || fail 'DEVELOPER_DIR не указывает на полный Xcode (Contents/Developer).'
  else
    candidate="$(/usr/bin/xcode-select -p 2>/dev/null || true)"
    if [[ ! -x "$candidate/usr/bin/xcodebuild" ]]; then candidate='/Applications/Xcode.app/Contents/Developer'; fi
    [[ -x "$candidate/usr/bin/xcodebuild" ]] || fail 'Установите Xcode, запустите его и завершите первоначальную настройку.'
  fi
  export DEVELOPER_DIR="$candidate"
  /usr/bin/xcodebuild -version || fail 'Откройте Xcode и завершите настройку, включая лицензию.'
  /usr/bin/xcodebuild -checkFirstLaunchStatus || fail 'Откройте Xcode: примите лицензию и установите запрошенные компоненты.'
  /usr/bin/xcrun --sdk iphoneos --show-sdk-path >/dev/null || fail 'В Xcode отсутствует iOS SDK. Завершите установку компонентов.'
}

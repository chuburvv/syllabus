#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
device=''
mode=install
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || fail 'После --device укажите идентификатор из --list.'; device="$2"; shift 2 ;;
    --list) mode=list; shift ;;
    --dry-run) mode=dry; shift ;;
    --help|-h) printf '%s\n' 'Первая установка: сначала настройте Team и запустите приложение на iPhone через Xcode.' 'Повторная установка: bash scripts/install-device.sh --device DEVICE_ID' 'Список устройств: bash scripts/install-device.sh --list' 'Проверка без сборки и установки: bash scripts/install-device.sh --device DEVICE_ID --dry-run'; exit 0 ;;
    *) fail "Неизвестный аргумент: $1" ;;
  esac
done
prepare_xcode
if [[ "$mode" == list ]]; then exec /usr/bin/xcrun devicectl list devices; fi
[[ -n "$device" ]] || fail 'Укажите --device DEVICE_ID. Для списка устройств используйте --list.'
settings="$(/usr/bin/xcodebuild -project "$BOOK_ROOT/InteractiveBook.xcodeproj" -scheme InteractiveBook -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' -showBuildSettings)"
team="$(printf '%s\n' "$settings" | /usr/bin/awk '$1=="DEVELOPMENT_TEAM" && $2=="=" {print $3; exit}')"
bundle="$(printf '%s\n' "$settings" | /usr/bin/awk '$1=="PRODUCT_BUNDLE_IDENTIFIER" && $2=="=" {print $3; exit}')"
[[ -n "$team" ]] || fail 'Сначала выберите Team в Xcode и выполните первую установку через Run. См. docs/INSTALL-IOS.md.'
[[ -n "$bundle" && "$bundle" != com.example.interactivebook ]] || fail 'Подготовьте личный Bundle ID: bash scripts/setup.sh'
printf '\nУстройство: %s\nBundle ID: %s\n' "$device" "$bundle"
if [[ "$mode" == dry ]]; then printf 'Проверка завершена. Подпись, доступность телефона и установка ещё не проверены.\n'; exit 0; fi
printf 'Разблокируйте iPhone. Сборка и подпись используют ваш аккаунт из Xcode.\n'
/usr/bin/xcodebuild -project "$BOOK_ROOT/InteractiveBook.xcodeproj" -scheme InteractiveBook \
  -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath "$BOOK_ROOT/build/device" -allowProvisioningUpdates build || fail 'Сборка не удалась. Откройте проект в Xcode и проверьте Signing & Capabilities.'
app="$BOOK_ROOT/build/device/Build/Products/Debug-iphoneos/InteractiveBook.app"
[[ -d "$app" ]] || fail 'Сборка не создала InteractiveBook.app.'
actual_bundle="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")"
/usr/bin/xcrun devicectl device install app --device "$device" "$app" || fail 'Установка не удалась. Проверьте доверие, Developer Mode, подключение и разблокировку iPhone.'
/usr/bin/xcrun devicectl device process launch --device "$device" "$actual_bundle" || fail 'Приложение установлено, но не запущено. Разблокируйте iPhone и откройте его иконку; при запросе подтвердите доверие разработчику.'
printf '\nГотово: приложение установлено и запущено.\n'

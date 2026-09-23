#!/bin/bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
mode=open
case "${1:-}" in
  '') ;;
  --check) mode=check ;;
  --no-open) mode=prepare ;;
  --help|-h) printf '%s\n' 'Использование: bash scripts/setup.sh [--check | --no-open]' 'Без аргументов: проверить Xcode, создать личный Bundle ID и открыть проект.' '--check: только проверка, без изменения файлов.' '--no-open: подготовить настройки без открытия Xcode.'; exit 0 ;;
  *) fail 'Неизвестный аргумент. Используйте --help.' ;;
esac
[[ $# -le 1 ]] || fail 'Слишком много аргументов.'
prepare_xcode
[[ "$mode" != check ]] || { printf '\nXcode готов.\n'; exit 0; }
config="$BOOK_ROOT/Config/Local.xcconfig"
if [[ ! -e "$config" ]]; then
  suffix="$(/usr/bin/uuidgen | /usr/bin/tr '[:upper:]' '[:lower:]' | /usr/bin/tr -d '-')"
  # noclobber also protects against two setup processes racing.
  (set -o noclobber; printf '%s\n' '// Personal settings; do not commit this file.' "PRODUCT_BUNDLE_IDENTIFIER = com.personal.interactivebook.u$suffix" > "$config")
  printf '\nСоздан личный Bundle Identifier. Сохраните Config/Local.xcconfig для будущих обновлений.\n'
else
  printf '\nСуществующий Bundle Identifier сохранён.\n'
fi
printf '%s\n' 'Далее в Xcode:' '1. Settings → Accounts: добавьте свой Apple Account.' '2. TARGETS → InteractiveBook → Signing & Capabilities: выберите свою Team.' '3. Подключите разблокированный iPhone, подтвердите доверие и включите Developer Mode.' '4. Выберите свой iPhone вверху окна и нажмите Run (⌘R).'
if [[ "$mode" == open ]]; then
  /usr/bin/open -a "${DEVELOPER_DIR%/Contents/Developer}" "$BOOK_ROOT/InteractiveBook.xcodeproj"
fi

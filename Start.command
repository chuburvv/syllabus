#!/bin/bash
cd "$(dirname "$0")" || exit 1
/bin/bash scripts/setup.sh
result=$?
printf '\nНажмите Enter, чтобы закрыть окно…'
read -r answer
exit "$result"

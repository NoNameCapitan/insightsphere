#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Для этой версии нужен Python 3.10 или новее."
  echo "После установки Python с python.org запустите этот файл снова."
  read -r -p "Нажмите Enter, чтобы закрыть окно. " _answer
  exit 1
fi
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then
  echo "Установленная версия Python слишком старая. Нужен Python 3.10 или новее."
  read -r -p "Нажмите Enter, чтобы закрыть окно. " _answer
  exit 1
fi
python3 app.py --open

#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'; then
  echo "Нужен Python 3.10 или новее. Установщик: https://www.python.org/downloads/macos/"
  read -r -p "Нажмите Enter, чтобы закрыть окно. " _answer
  exit 1
fi
python3 - <<'PY'
import json
from pathlib import Path
from providers import discover
from core import VERSION, now
report = discover()
report.update(app_version=VERSION, checked_at=now(), model_requests_made=0)
path = Path('mac-diagnostics.json')
path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print('Проверка завершена. Запросы к моделям не выполнялись.')
print('Результат: '+str(path.resolve()))
print('Этот файл можно передать в текущий чат для следующего шага.')
PY
read -r -p "Нажмите Enter, чтобы закрыть окно. " _answer

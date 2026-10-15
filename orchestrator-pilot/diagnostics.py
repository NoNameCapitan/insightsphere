"""Generate a local connection report without model inference."""
import json
from pathlib import Path
from providers import discover
from core import VERSION, now

if __name__ == '__main__':
    report = discover()
    report.update(app_version=VERSION, checked_at=now(), model_requests_made=0)
    path = Path(__file__).resolve().parent / 'windows-diagnostics.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Проверка завершена. Запросы к моделям не выполнялись.')
    print('Результат: '+str(path))

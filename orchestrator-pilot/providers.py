"""Bounded adapters: existing Ollama models and a subscription-authenticated Claude CLI.

No installation, credential copying, shell execution, or implicit paid fallback.
macOS/Linux use process groups. Windows supports only our childless Ollama worker.
"""
from __future__ import annotations

import json
import re
import os
import platform
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler, HTTPRedirectHandler

MAX_OUTPUT = 2_000_000
OLLAMA_URL = "http://127.0.0.1:11434"


class ProviderError(ValueError):
    def __init__(self, message, usage=None):
        super().__init__(message)
        self.usage = usage


def strict_json(value):
    return json.loads(value, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Invalid number")))


def bounded_process(argv, input_text="", *, timeout=120, cancel=None, cwd=None, env=None):
    """Cap combined output, wall time, and the entire subprocess group; never use a shell."""
    if cancel and cancel.is_set():
        raise ProviderError("Вызов остановлен")
    if sys.platform == 'win32':
        from platform_support import single_worker
        if argv != [sys.executable, str(Path(__file__).resolve()), '--ollama-worker']:
            raise ProviderError('В Windows пока поддерживается только локальный Ollama worker; CLI отключён')
        try:
            return single_worker(argv, input_text, timeout=timeout, cancel=cancel, cwd=cwd, env=env, max_output=MAX_OUTPUT)
        except (ValueError, OSError) as e:
            raise ProviderError(str(e)) from None
    try:
        proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, cwd=cwd, env=env,
                                start_new_session=True)
    except OSError:
        raise ProviderError("Не удалось запустить исполнитель") from None
    selector = selectors.DefaultSelector()
    output = {"out": bytearray(), "err": bytearray()}
    pending = memoryview(input_text.encode("utf-8"))
    deadline = time.monotonic() + timeout
    try:
        for pipe, name in ((proc.stdout, "out"), (proc.stderr, "err")):
            os.set_blocking(pipe.fileno(), False)
            selector.register(pipe, selectors.EVENT_READ, name)
        if pending:
            os.set_blocking(proc.stdin.fileno(), False)
            selector.register(proc.stdin, selectors.EVENT_WRITE, "in")
        else:
            proc.stdin.close()
        while selector.get_map() or proc.poll() is None:
            if cancel and cancel.is_set():
                raise ProviderError("Вызов остановлен")
            if time.monotonic() >= deadline:
                raise ProviderError("Истёк лимит времени исполнителя")
            for key, _ in selector.select(min(.1, max(0, deadline-time.monotonic()))):
                if key.data == "in":
                    try:
                        written = os.write(key.fd, pending[:4096])
                        pending = pending[written:]
                    except BrokenPipeError:
                        pending = pending[:0]
                    if not pending:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                else:
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                    else:
                        output[key.data].extend(chunk)
                        if sum(map(len, output.values())) > MAX_OUTPUT:
                            raise ProviderError("Ответ превысил лимит 2 МБ")
        return proc.wait(), output["out"].decode("utf-8", "replace"), output["err"].decode("utf-8", "replace")
    finally:
        selector.close()
        # Also terminate any descendants left behind by an exited parent.
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=.5)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()
        for pipe in (proc.stdin, proc.stdout, proc.stderr):
            if not pipe.closed:
                pipe.close()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise ProviderError("Перенаправление локального API запрещено")


def ollama_request(path, body=None, timeout=3):
    # No configurable hostname and no proxy environment: evidence cannot select a destination.
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    req = Request(OLLAMA_URL + path, data=data, headers={"Content-Type": "application/json"})
    try:
        with build_opener(ProxyHandler({}), NoRedirect()).open(req, timeout=timeout) as response:
            raw = response.read(MAX_OUTPUT + 1)
        if len(raw) > MAX_OUTPUT:
            raise ProviderError("Ответ локального API слишком велик")
        result = strict_json(raw)
        if not isinstance(result, dict) or result.get("error"):
            raise ProviderError("Локальный API вернул ошибку")
        return result
    except ProviderError:
        raise
    except Exception:
        raise ProviderError("Ollama не отвечает. Запустите Ollama на этом компьютере") from None


def local_model(name):
    if not isinstance(name, str) or not name or len(name) > 200 or "cloud" in name.lower():
        raise ProviderError("Нужна установленная локальная модель")
    tags = ollama_request("/api/tags").get("models", [])
    row = next((m for m in tags if isinstance(m, dict) and m.get("name") == name), None)
    if not row or row.get("remote_host") or row.get("remote_model") or row.get("size", 0) < 1_000_000:
        raise ProviderError("Модель не подтверждена как установленная локально")
    info = ollama_request("/api/show", {"model": name})
    if not is_local_chat(info):
        raise ProviderError("Локальная разговорная модель не подтверждена; вызов не выполнен")
    return row


def is_local_chat(info):
    return not (info.get("remote_host") or info.get("remote_model")
            or not isinstance(info.get("model_info"), dict)
            or not info["model_info"].get("general.architecture")
            or "completion" not in info.get("capabilities", []))


def executable(name):
    found = shutil.which(name)
    paths = [found, str(Path.home()/".local/bin"/name), "/opt/homebrew/bin/"+name, "/usr/local/bin/"+name]
    return next((p for p in paths if p and Path(p).is_file() and os.access(p, os.X_OK)), None)


def claude_environment():
    # Preserve the normal HOME for existing keychain/OAuth login; do not read or copy credentials.
    keep = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "LC_CTYPE", "TZ", "TMPDIR"}
    return {k: v for k, v in os.environ.items() if k in keep}


def claude_info(cancel=None):
    if sys.platform == 'win32':
        return {'id': 'claude_code', 'name': 'Claude Code', 'status': 'incompatible', 'version': '',
                'note': 'CLI Claude в Windows пока отключён. Используйте Ollama или передачу в ChatGPT.'}
    binary = executable("claude")
    base = {"id": "claude_code", "name": "Claude Code", "status": "unavailable",
            "note": "Claude Code не найден", "version": ""}
    if not binary:
        return base
    with tempfile.TemporaryDirectory(prefix="orchestrator-probe-") as directory:
        try:
            code, version, _ = bounded_process([binary, "--version"], timeout=8, cancel=cancel, cwd=directory, env=claude_environment())
            if code:
                raise ProviderError("Не удалось определить версию Claude Code")
            base["version"] = version.strip()[:100]
            code, help_text, _ = bounded_process([binary, "--help"], timeout=8, cancel=cancel, cwd=directory, env=claude_environment())
            required = ("--safe-mode", "--tools", "--strict-mcp-config", "--setting-sources", "--no-session-persistence")
            if code or not all(flag in help_text for flag in required):
                base.update(status="incompatible", note="Нужна версия Claude Code с --safe-mode и ограничением инструментов. Автообновление не выполнялось")
                return base
            code, raw, _ = bounded_process([binary, "auth", "status"], timeout=8, cancel=cancel, cwd=directory, env=claude_environment())
            auth = strict_json(raw)
            if code or not isinstance(auth, dict) or not auth.get("loggedIn"):
                base.update(status="sign_in_required", note="Войдите в Claude Code обычным способом")
            elif auth.get("authMethod") != "claude.ai" or auth.get("apiProvider") != "firstParty":
                base.update(status="billing_unknown", note="Вход по подписке Claude не подтверждён. API-вызов не выполнялся")
            else:
                base.update(status="ready", note="Вход по подписке обнаружен; запросы используют её лимиты. Дополнительные списания зависят от настроек аккаунта")
        except (ValueError, OSError):
            base.update(status="unknown", note="Не удалось проверить готовность Claude Code; запрос к модели не выполнялся")
    return base


def hardware():
    result = {"os": platform.system(), "architecture": platform.machine(), "memory_gb": None,
              "is_apple_silicon": platform.system() == "Darwin" and platform.machine() == "arm64"}
    if platform.system() == "Darwin":
        try:
            code, value, _ = bounded_process(["/usr/sbin/sysctl", "-n", "hw.memsize"], timeout=3)
            if code == 0:
                result["memory_gb"] = round(int(value.strip()) / 1024**3)
            result["macos"] = platform.mac_ver()[0]
            code, chip, _ = bounded_process(["/usr/sbin/sysctl", "-n", "machdep.cpu.brand_string"], timeout=3)
            if code == 0:
                result["chip"] = chip.strip()[:100]
                result["is_apple_silicon"] = result["is_apple_silicon"] or chip.startswith("Apple M")
        except (ValueError, OSError):
            pass
    return result


def discover():
    device = hardware()
    local = {"id": "ollama", "name": "Локальная модель · Ollama", "status": "unavailable",
             "models": [], "note": "Ollama не отвечает на локальном адресе"}
    try:
        tags = ollama_request("/api/tags").get("models", [])
        candidates = []
        for row in tags[:100]:
            if not isinstance(row, dict):
                continue
            name, size = row.get("name", ""), row.get("size", 0)
            if (isinstance(name, str) and type(size) is int and size >= 1_000_000
                    and "cloud" not in name.lower() and not row.get("remote_host") and not row.get("remote_model")):
                candidates.append({"name": name, "size_gb": round(size/1024**3, 2), "size_bytes": size})
        candidates.sort(key=lambda row: row["size_bytes"])
        deadline = time.monotonic()+10
        for row in candidates[:12]:
            if time.monotonic() >= deadline:
                break
            try:
                info = ollama_request("/api/show", {"model": row["name"]}, timeout=2)
                if is_local_chat(info):
                    local["models"].append(row)
            except ProviderError:
                continue
        local.update(status="ready" if local["models"] else "no_models",
                     note="Проверяется до 12 наименьших моделей и поддержка текста. Перед вызовом локальный тип проверяется повторно. Размер файла не равен потреблению памяти")
    except (ValueError, TypeError):
        pass
    return {"hardware": device, "providers": [local, claude_info(),
            {"id": "chatgpt", "name": "ChatGPT по запросу", "status": "manual",
             "note": "Скачайте запрос и передайте его в чат. Ответ можно вернуть в задачу файлом JSON"}]}


def run_ollama(model, prompt, system, schema, cancel=None):
    payload = {"model": model, "prompt": prompt, "system": system, "schema": schema}
    code, output, _ = bounded_process([sys.executable, str(Path(__file__).resolve()), "--ollama-worker"],
                                      json.dumps(payload, ensure_ascii=False), timeout=120, cancel=cancel)
    if code:
        # Worker emits a small, non-sensitive error, never provider response bodies.
        try:
            reason = strict_json(output).get("adapter_error", "Локальный вызов не выполнен")
        except (ValueError, AttributeError):
            reason = "Локальный вызов не выполнен"
        raise ProviderError(reason)
    reply = strict_json(output)
    usage = {"input_tokens": reply.get("prompt_eval_count"), "output_tokens": reply.get("eval_count"),
             "api_cost_usd": 0, "billing": "local_computation",
             "model_identity": reply.get("_orchestrator_model_digest")}
    try:
        result = strict_json(reply.get("message", {}).get("content", ""))
    except (ValueError, TypeError, AttributeError):
        raise ProviderError("Локальная модель не вернула ожидаемый JSON", usage) from None
    return result, usage


def model_json(value):
    """Accept a JSON object or one unambiguous fenced object; never guess among blocks."""
    if not isinstance(value, str):
        raise ValueError("Нужен текст JSON")
    value = value.strip()
    try:
        return strict_json(value)
    except ValueError:
        blocks = re.findall(r"```(?:json)?\s*\n(.*?)\n```", value, flags=re.DOTALL | re.IGNORECASE)
        if len(blocks) != 1 or value.count("```") != 2:
            raise ValueError("Нужен один однозначный JSON-блок") from None
        return strict_json(blocks[0])


def run_claude(prompt, system, cancel=None):
    deadline = time.monotonic() + 120
    if claude_info(cancel)["status"] != "ready":
        raise ProviderError("Claude Code не готов к вызову через подписку")
    argv = [executable("claude"), "--safe-mode", "--setting-sources", "",
            "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
            "--tools", "", "--disallowedTools", "mcp__*", "--permission-mode", "dontAsk",
            "--settings", '{"disableAllHooks":true}', "--no-session-persistence", "--no-chrome",
            "--max-turns", "1", "--output-format", "json", "--system-prompt", system, "-p"]
    with tempfile.TemporaryDirectory(prefix="orchestrator-call-") as directory:
        code, output, _ = bounded_process(argv, prompt, timeout=max(.1, deadline-time.monotonic()), cancel=cancel,
                                          cwd=directory, env=claude_environment())
    try:
        envelope = strict_json(output)
    except ValueError:
        raise ProviderError("Claude Code не вернул ожидаемый JSON; исходные материалы сохранены") from None
    if not isinstance(envelope, dict):
        raise ProviderError("Claude Code вернул неожиданный формат ответа")
    usage = {"billing": "subscription_actual_charge_unknown", "api_cost_usd": None,
             "reported_cost_estimate_usd": envelope.get("total_cost_usd"),
             "input_tokens": envelope.get("usage", {}).get("input_tokens"),
             "output_tokens": envelope.get("usage", {}).get("output_tokens"),
             "model_identity": ",".join(sorted(envelope.get("modelUsage", {}))) or None}
    if code or envelope.get("is_error"):
        raise ProviderError("Claude Code завершил запрос с ошибкой; проверьте вход, лимит подписки и версию CLI", usage)
    result = envelope.get("structured_output")
    if result is None:
        try:
            value = envelope.get("result", "")
            result = model_json(value)
        except (ValueError, AttributeError, TypeError):
            raise ProviderError("Claude Code не вернул ответ по схеме", usage) from None
    return result, usage


if __name__ == "__main__":
    if "--ollama-worker" in sys.argv:
        try:
            p = strict_json(sys.stdin.read(100_000))
            row = local_model(p["model"])
            reply = ollama_request("/api/chat", {"model": p["model"], "stream": False,
                                   "format": p["schema"], "messages": [
                                       {"role": "system", "content": p["system"]},
                                       {"role": "user", "content": p["prompt"]}],
                                   "options": {"temperature": .1, "num_ctx": 16384, "num_predict": 1800},
                                   "keep_alive": "5m"}, timeout=115)
            reply["_orchestrator_model_digest"] = row.get("digest")
            print(json.dumps(reply, ensure_ascii=False))
        except ProviderError as e:
            print(json.dumps({"adapter_error": str(e)}, ensure_ascii=False))
            raise SystemExit(1)
        except Exception:
            print('{"adapter_error":"Некорректный ответ локального исполнителя"}')
            raise SystemExit(1)
    else:
        print(json.dumps(discover(), ensure_ascii=False, indent=2))

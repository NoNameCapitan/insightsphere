#!/usr/bin/env python3
"""
desktop_app.py — Music DNA Copilot as a desktop app
===================================================

The same local app, packaged to feel like a normal program:

* starts the local server on 127.0.0.1 (port 8765 when free, so a registered
  Spotify redirect URI keeps working; otherwise the next free port);
* opens the app in its **own window** using Chrome/Edge/Chromium/Brave "app
  mode" (no tabs or address bar, separate profile, nothing shared with your
  normal browser). Microsoft Edge ships with every Windows 10/11 install;
* when no such browser exists, it opens your default browser and shows a
  small control window (tkinter) with "Open" and "Quit";
* stops the server when you close the app window;
* single instance: starting it twice just brings up another window on the
  running app;
* stores your data in the per-user application-data folder when installed as
  a program (the program folder may be read-only):
      Windows  %APPDATA%\\Music DNA Copilot
      macOS    ~/Library/Application Support/Music DNA Copilot
      Linux    $XDG_DATA_HOME/music-dna-copilot (default ~/.local/share/...)
  Running from the source folder keeps using ./outputs, exactly as before.

Standard library only. The packaged builds (PyInstaller) bundle Python, so
end users don't need to install anything; see packaging/README.md.

Usage:
    python desktop_app.py [--browser-window | --default-browser] [--data-dir DIR] [--port N]
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

APP_NAME = "Music DNA Copilot"
FROZEN = getattr(sys, "frozen", False)
# PyInstaller puts bundled data under sys._MEIPASS; from source it's this folder.
ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
SCRIPTS = ROOT / "scripts"
DEFAULT_PORT = 8765


# ---------------------------------------------------------------------------
# Where data lives
# ---------------------------------------------------------------------------

def user_data_dir() -> Path:
    system = platform.system()
    if system == "Windows":
        base = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
        return base / APP_NAME
    if system == "Darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME
    base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return base / "music-dna-copilot"


def _writable(folder: Path) -> bool:
    try:
        folder.mkdir(parents=True, exist_ok=True)
        probe = folder / ".write_test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def choose_data_dir(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    if os.environ.get("MTR_OUTPUTS_DIR"):
        return Path(os.environ["MTR_OUTPUTS_DIR"]).expanduser()
    source_outputs = ROOT / "outputs"
    if not FROZEN and _writable(source_outputs):
        return source_outputs
    return user_data_dir() / "outputs"


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

def health(port, timeout=1.0):
    """Our app's /health answer on this port, or None."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data if data.get("ok") else None
    except Exception:
        return None


def start_server(port_hint: int):
    """Start the local server in a background thread. Returns (server, port)."""
    sys.path.insert(0, str(SCRIPTS))
    import local_interface as li  # noqa: WPS433 - imported after MTR_OUTPUTS_DIR is set
    from http.server import HTTPServer

    li.OUTPUTS.mkdir(parents=True, exist_ok=True)
    port = li.find_free_port(port_hint)
    li.CURRENT_PORT[0] = port
    server = HTTPServer(("127.0.0.1", port), li.Handler)
    threading.Thread(target=server.serve_forever, name="music-dna-server", daemon=True).start()
    deadline = time.time() + 15
    while time.time() < deadline and not health(port, 0.5):
        time.sleep(0.1)
    return server, port


# ---------------------------------------------------------------------------
# Window
# ---------------------------------------------------------------------------

def _candidates():
    system = platform.system()
    if system == "Windows":
        roots = [os.environ.get(k) for k in ("PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA")]
        rel = [r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe",
               r"BraveSoftware\Brave-Browser\Application\brave.exe", r"Chromium\Application\chrome.exe"]
        return [str(Path(r) / x) for r in roots if r for x in rel]
    if system == "Darwin":
        apps = ["Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium", "Vivaldi"]
        return [f"/Applications/{a}.app/Contents/MacOS/{a}" for a in apps] + \
               [str(Path.home() / f"Applications/{a}.app/Contents/MacOS/{a}") for a in apps]
    names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
             "microsoft-edge", "microsoft-edge-stable", "brave-browser", "vivaldi"]
    return [p for p in (shutil.which(n) for n in names) if p]


def find_app_browser():
    override = os.environ.get("MTR_APP_BROWSER")
    if override:
        return override if Path(override).exists() or shutil.which(override) else None
    for path in _candidates():
        if Path(path).exists():
            return path
    return None


def open_app_window(browser: str, url: str, profile: Path):
    """Launch a chromeless app window with its own profile. Returns the process."""
    profile.mkdir(parents=True, exist_ok=True)
    args = [browser, f"--app={url}", f"--user-data-dir={profile}", "--no-first-run",
            "--no-default-browser-check", "--disable-sync", "--window-size=1280,860",
            # Local-first: no background calls from the browser shell itself.
            "--disable-background-networking", "--disable-component-update", "--disable-domain-reliability",
            "--no-pings", "--metrics-recording-only",
            f"--class={APP_NAME}"]
    kwargs = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if platform.system() == "Windows":
        kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW
    return subprocess.Popen(args, **kwargs)


def control_window(url: str, data_dir: Path):
    """Fallback when there is no app-mode browser: a tiny Open / Quit window."""
    import webbrowser
    webbrowser.open(url)
    try:
        import tkinter as tk
    except Exception:
        print(f"{APP_NAME} is running at {url}. Press Ctrl+C to quit.")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return
    root = tk.Tk()
    root.title(APP_NAME)
    root.resizable(False, False)
    frame = tk.Frame(root, padx=18, pady=14)
    frame.pack()
    tk.Label(frame, text=f"{APP_NAME} is running", font=("TkDefaultFont", 12, "bold")).pack(anchor="w")
    tk.Label(frame, text=url, fg="#555").pack(anchor="w", pady=(2, 8))
    tk.Label(frame, text=f"Your data: {data_dir}", fg="#555", wraplength=380, justify="left").pack(anchor="w")
    row = tk.Frame(frame, pady=12)
    row.pack(anchor="w")
    tk.Button(row, text="Open in browser", command=lambda: webbrowser.open(url)).pack(side="left")
    tk.Button(row, text="Quit", command=root.destroy).pack(side="left", padx=8)
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    root.mainloop()


def attach_log(data_dir: Path):
    """Windowed builds (no console) have sys.stdout/stderr set to None; the HTTP
    server logs every request to stderr, which would then fail. Send both to a
    small log file next to the data instead (useful when reporting problems)."""
    if sys.stdout is not None and sys.stderr is not None:
        return
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        log_path = data_dir / "app.log"
        if log_path.exists() and log_path.stat().st_size > 2_000_000:
            log_path.replace(log_path.with_suffix(".log.1"))
        stream = open(log_path, "a", encoding="utf-8", buffering=1)
    except OSError:
        stream = open(os.devnull, "w", encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = stream
    if sys.stderr is None:
        sys.stderr = stream


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description=f"{APP_NAME} desktop app")
    ap.add_argument("--data-dir", help="Folder for your data (default: see module docstring)")
    ap.add_argument("--port", type=int, default=int(os.environ.get("MTR_PORT", DEFAULT_PORT)))
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--default-browser", action="store_true", help="Use your normal browser + control window")
    mode.add_argument("--headless", action="store_true", help="Only run the server (for tests)")
    args = ap.parse_args(argv)

    data_dir = choose_data_dir(args.data_dir)
    os.environ["MTR_OUTPUTS_DIR"] = str(data_dir)
    attach_log(data_dir)
    # Keep connector tokens next to the data of an installed app.
    if FROZEN and not os.environ.get("MTR_CONFIG_DIR"):
        os.environ["MTR_CONFIG_DIR"] = str(user_data_dir() / "config")

    running = health(args.port)
    if running and not args.headless:
        # Single instance: show another window on the app that is already running.
        url = f"http://127.0.0.1:{args.port}/"
        browser = None if args.default_browser else find_app_browser()
        if browser:
            open_app_window(browser, url, user_data_dir() / "window-profile")
        else:
            import webbrowser
            webbrowser.open(url)
        return 0

    server, port = start_server(args.port)
    url = f"http://127.0.0.1:{port}/"
    print(f"{APP_NAME} running at {url}  ·  data: {data_dir}", flush=True)
    try:
        if args.headless:
            while True:
                time.sleep(3600)
        browser = None if args.default_browser else find_app_browser()
        if browser:
            proc = open_app_window(browser, url, user_data_dir() / "window-profile")
            started = time.time()
            proc.wait()
            if time.time() - started < 3:
                # Some browsers hand the window to an existing process and exit
                # at once; fall back to the control window so the app stays up.
                control_window(url, data_dir)
        else:
            control_window(url, data_dir)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

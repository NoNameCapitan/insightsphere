#!/usr/bin/env python3
"""Build the Music DNA Copilot desktop app with PyInstaller.

    pip install pyinstaller pillow        # build-time only; the app itself stays stdlib-only
    python packaging/build_desktop.py     # -> dist/desktop/<platform zip or tar.gz>

What it does
------------
* Bundles Python + the app into a folder ("onedir": fast start, fewer
  antivirus false positives than one-file builds) and zips it:
    Windows  Music DNA Copilot/Music DNA Copilot.exe      (no console window)
    macOS    Music DNA Copilot.app                        (unsigned, see README)
    Linux    music-dna-copilot/music-dna-copilot          (+ .desktop file)
* The engine in scripts/ is shipped as source data and imported at run time,
  so every standard-library module those scripts use is scanned and added as
  a hidden import (PyInstaller can't see imports behind sys.path tricks).
* Never ships outputs/, .env, tokens or caches (same rules as the release zip).
"""
from __future__ import annotations

import ast
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DIST = ROOT / "dist" / "desktop"
BUILD = ROOT / "build" / "desktop"
NAME = "Music DNA Copilot"
LINUX_NAME = "music-dna-copilot"
DATA_DIRS = ["scripts", "web", "examples", "data", "schemas"]
DATA_FILES = ["VERSION", "index.html", ".env.example"]
SKIP_DIRS = {"__pycache__", "outputs", ".pytest_cache"}


def version():
    return (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def stdlib_imports():
    """Every top-level stdlib module imported anywhere in scripts/ (+ tkinter)."""
    names = set()
    for path in (ROOT / "scripts").rglob("*.py"):
        if SKIP_DIRS & set(path.parts):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names.update(a.name for a in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                names.add(node.module)
    std = set(sys.stdlib_module_names)
    keep = sorted(n for n in names if n.split(".")[0] in std)
    try:
        import tkinter  # noqa: F401 - the fallback control window
        keep.append("tkinter")
    except Exception:
        print("note: tkinter not available in this Python; the fallback control window will be absent")
    return keep


def stage_data():
    """Copy runtime data into build/desktop/stage without personal files."""
    stage = BUILD / "stage"
    shutil.rmtree(stage, ignore_errors=True)
    stage.mkdir(parents=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", "outputs", ".env", "*token*", "*.log", "test_*.py",
                                    "smoke_test.py", "make_release_zip.py", "release_check.py")
    for d in DATA_DIRS:
        shutil.copytree(ROOT / d, stage / d, ignore=ignore)
    for f in DATA_FILES:
        if (ROOT / f).exists():
            shutil.copy2(ROOT / f, stage / f)
    return stage


def run_pyinstaller(stage):
    system = platform.system()
    sep = ";" if system == "Windows" else ":"
    args = [sys.executable, "-m", "PyInstaller", str(ROOT / "desktop_app.py"),
            "--noconfirm", "--clean", "--onedir",
            "--name", NAME if system != "Linux" else LINUX_NAME,
            "--distpath", str(BUILD / "dist"), "--workpath", str(BUILD / "work"), "--specpath", str(BUILD),
            "--icon", str(HERE / "icon.png")]
    if system in ("Windows", "Darwin"):
        args.append("--windowed")
    if system == "Darwin":
        args += ["--osx-bundle-identifier", "app.musicdna.copilot"]
    for item in sorted(stage.iterdir()):
        dest = item.name if item.is_dir() else "."
        args += ["--add-data", f"{item}{sep}{dest}"]
    for mod in stdlib_imports():
        args += ["--hidden-import", mod]
    print("running PyInstaller with", len(args), "arguments")
    subprocess.run(args, check=True, cwd=ROOT)


def package():
    system = platform.system()
    arch = platform.machine().lower().replace("amd64", "x64").replace("x86_64", "x64")
    DIST.mkdir(parents=True, exist_ok=True)
    out = BUILD / "dist"
    tag = f"{LINUX_NAME}-{version()}"
    if system == "Darwin":
        app = out / f"{NAME}.app"
        target = DIST / f"{tag}-macos-{arch}.zip"
        # ditto keeps the bundle's symlinks and metadata intact.
        subprocess.run(["ditto", "-c", "-k", "--keepParent", str(app), str(target)], check=True)
    elif system == "Windows":
        folder = out / NAME
        target = DIST / f"{tag}-windows-{arch}.zip"
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
            for p in folder.rglob("*"):
                z.write(p, Path(NAME) / p.relative_to(folder))
    else:
        folder = out / LINUX_NAME
        (folder / f"{LINUX_NAME}.desktop").write_text(
            "[Desktop Entry]\nType=Application\nName=Music DNA Copilot\n"
            f"Exec={LINUX_NAME}\nIcon=music-dna-copilot\nCategories=AudioVideo;Audio;\n"
            "Comment=Your private, cross-service Music DNA\nStartupWMClass=Music DNA Copilot\n", encoding="utf-8")
        shutil.copy2(HERE / "icon.png", folder / "music-dna-copilot.png")
        target = DIST / f"{tag}-linux-{arch}.tar.gz"
        with tarfile.open(target, "w:gz") as t:
            t.add(folder, arcname=LINUX_NAME)
    print(f"built {target} ({target.stat().st_size / 1e6:.1f} MB)")
    return target


def main():
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        sys.exit("PyInstaller is not installed: pip install pyinstaller pillow")
    stage = stage_data()
    run_pyinstaller(stage)
    package()
    return 0


if __name__ == "__main__":
    sys.exit(main())

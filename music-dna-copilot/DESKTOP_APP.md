# Music DNA Copilot — desktop app

The same private, local app, as a normal program with its own window and icon.
No Python to install, no terminal.

## Download

Builds for **Windows**, **macOS (Apple Silicon)** and **Linux** are produced by GitHub
Actions (`.github/workflows/desktop-app.yml`):

- every pull request that touches the app: open the workflow run → **Artifacts**;
- every tag named `music-dna-v…` (for example `music-dna-v3.2.0`): the files are attached
  to that GitHub **Release**.

| System | File | Start |
|---|---|---|
| Windows 10/11 | `music-dna-copilot-<ver>-windows-x64.zip` | unzip → `Music DNA Copilot\Music DNA Copilot.exe` |
| macOS (M1 and newer) | `music-dna-copilot-<ver>-macos-arm64.zip` | unzip → drag **Music DNA Copilot.app** to Applications |
| Linux x64 | `music-dna-copilot-<ver>-linux-x64.tar.gz` | extract → `music-dna-copilot/music-dna-copilot` |

### First start warnings (the builds are not code-signed)
- **Windows SmartScreen:** "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS Gatekeeper:** "cannot be opened because the developer cannot be verified" →
  right-click the app → **Open** → **Open** (once). Or: System Settings → Privacy & Security → **Open Anyway**.
- Signing needs paid certificates (Apple Developer ID, a Windows code-signing certificate);
  the workflow can sign once those exist.

## How it behaves
- Opens in its **own window** (app mode of Microsoft Edge, Chrome, Chromium or Brave, with a
  separate profile, no tabs, no address bar, no sync). Edge is built into Windows 10/11.
  Without any of those browsers it opens your default browser plus a small window with
  **Open in browser** / **Quit**.
- Closing the window stops the app. Starting it again while it runs opens another window
  on the same app (single instance).
- Uses port **8765** when free, so a Spotify redirect URI registered for
  `http://127.0.0.1:8765/spotify/callback` keeps working; otherwise the next free port
  (the Sources page always shows the exact address to register).

## Where your data is
| System | Folder |
|---|---|
| Windows | `%APPDATA%\Music DNA Copilot\` |
| macOS | `~/Library/Application Support/Music DNA Copilot/` |
| Linux | `~/.local/share/music-dna-copilot/` (or `$XDG_DATA_HOME`) |

`outputs/` holds your DNA, capsules, imports and syncs; `config/connectors.json` (0600)
holds the connector credentials and remembered tokens; `app.log` is a small log for
troubleshooting. Uninstalling = deleting the app, then this folder if you want your data
gone too. Nothing is uploaded anywhere.

Options: `--data-dir <folder>` to choose another data folder, `--port <n>`,
`--default-browser` to use your normal browser instead of an app window.

## Build it yourself
```bash
pip install pyinstaller pillow          # build-time only
python packaging/build_desktop.py       # -> dist/desktop/<file for your OS>
python packaging/ci_check_binary.py     # starts the build headless and checks it
```
PyInstaller builds for the system it runs on (build Windows on Windows, and so on).

## Limitations
- macOS build is Apple Silicon only (GitHub's standard macOS runners); Intel Macs can run
  the app from source (`python desktop_app.py`) or build locally.
- Not code-signed / notarized (see warnings above).
- No auto-update yet: download the new version and replace the old app; your data folder
  stays as it is.

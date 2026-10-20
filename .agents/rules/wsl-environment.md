---
description: Enforce that all application previews, browser windows, and tools open inside WSL and never spawn Windows host windows
---

# WSL Window & Browser Policy

- **All Windows Inside WSL:** When opening new windows, previews, or browser sessions, always execute them within the Linux WSL / WSLg environment or inside the IDE's internal webview.
- **Never Delegate to Windows Host:** Do not use `wslview`, `powershell.exe Start-Process`, `explorer.exe`, or `cmd.exe /c start` to launch Windows-side desktop applications.
- **In-App Navigation:** Web applications should prioritize in-app modals, embedded previews, or same-window navigation (`target="_self"`) instead of forcing `target="_blank"` popups that escape WSL into the Windows desktop.

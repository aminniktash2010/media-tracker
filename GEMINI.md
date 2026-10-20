# Workspace Policy: Always Open Windows Inside WSL

- **WSL Window Containment:** All browser previews, application windows, and tools opened from this project must remain strictly inside the WSL (Linux) environment or the IDE's built-in webview.
- **No Windows Host Spawning:** Never delegate window launches to Windows host processes (e.g. `wslview`, `powershell.exe Start-Process`, `explorer.exe`).
- **In-App Navigation:** All media details, external links, and IMDb references inside the web application must open via in-app modal dialogs or same-window navigation (`target="_self"`), preventing any external Windows browser popups.

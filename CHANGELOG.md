# Changelog

## 0.1.0 - 2026-03-25

- initial standalone `pi-extension-mermaid` package scaffold
- detect Mermaid fenced blocks in Pi chat
- add Mermaid viewer via `Ctrl+Shift+M` and `/mermaid`
- add extraction and render validation tests
- normalize Mermaid SVG before PNG rasterization so `@resvg/resvg-js` renders correct colors
- render inline previews only when diagrams fit well in the terminal
- open a browser-based SVG viewer first for large diagrams, with terminal fallback

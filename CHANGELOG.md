# Changelog

## 0.1.0 - 2026-03-25

### Added
- standalone `pi-extension-mermaid` repository and Pi package scaffold
- inline Mermaid rendering for fenced `mermaid` blocks in Pi chat
- `/mermaid` viewer and `Ctrl+Shift+M` shortcut
- `/mermaid-open` to open the latest Mermaid diagram directly in the browser
- extraction and renderer validation tests

### Changed
- Mermaid previews are always shown inline when the terminal supports images
- the large-view flow is browser-first, with terminal fallback when needed

### Fixed
- Mermaid SVG is normalized before rasterization so `@resvg/resvg-js` renders the expected colors
- assistant previews are appended after `agent_end` to avoid ordering and duplication glitches
- inline previews expose a persisted SVG link for opening the same diagram outside the terminal
- Ghostty/Kitty image placement is stabilized by reusing image IDs

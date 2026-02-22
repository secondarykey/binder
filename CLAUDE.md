# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Binder is an experimental desktop Markdown editor for technical writing. It uses **Wails v2** (Go + React) to create a frameless desktop application. Content is stored as files in a local git repository, with metadata tracked in CSV-based SQL tables (csvq).

## Build & Development Commands

### Prerequisites
- Go 1.22+
- Node.js with npm
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Development
```bash
# Run in dev mode (from _cmd/binder/)
cd _cmd/binder && wails dev
```

### Build
```bash
# Production build (from _cmd/binder/)
cd _cmd/binder && wails build
```

### Testing
```bash
# Run all Go tests
go test ./...

# Run tests for a specific package
go test ./fs/...
go test ./db/...

# Run a single test
go test ./fs/ -run TestAssetRead
```

### Frontend only
```bash
# From _cmd/binder/frontend/
npm install
npm run dev      # Vite dev server
npm run build    # Production build
```

## Architecture

### Layer Structure

```
React Frontend (JSX, MUI, Vite)
    ↓ Wails IPC bindings
api/ — Go API layer (App struct bound to Wails, exposes methods to JS)
    ↓
Root package (binder.go, note.go, diagram.go, etc.) — Core business logic (Binder struct)
    ↓
db/  — CSV-based SQL database (csvq-driver), DAOs
fs/  — Git-backed filesystem (go-git), file I/O, commit management
```

### Key Types

- **`Binder`** (binder.go) — Central orchestrator holding references to FileSystem, DB, and HTTP server. Lifecycle: `Load()` → use → `Close()`.
- **`api.App`** (api/api.go) — Wails-bound struct. Frontend calls methods on this. Delegates to `Binder`.
- **`fs.FileSystem`** (fs/fs.go) — Wraps a go-git repository. All content changes go through here and are git-committed.
- **`db.Instance`** (db/db.go) — SQL interface over CSV files using csvq. Tables: notes, diagrams, assets, templates, config.

### Data Flow

Every mutation (create/edit/delete note, diagram, asset) follows this pattern:
1. Frontend calls an `api.App` method via Wails binding
2. `api.App` delegates to `Binder` business logic
3. `Binder` writes to filesystem via `fs` and updates metadata via `db`
4. `fs` commits the change to git
5. JSON response returned to frontend

### Frontend Structure (_cmd/binder/frontend/src/)

- **App.jsx** — Root layout: left Menu + right Content
- **Menu.jsx** — Sidebar navigation
- **Content.jsx** — Route-based content switching (react-router)
- **Event.jsx** — Custom event bus for cross-component communication
- **contents/Editor/** — Split-pane markdown editor (edit left, preview right) with marked.js and Mermaid.js
- **contents/LeftMenu/** — Tree views for notes/diagrams using @mui/x-tree-view
- **wailsjs/go/** — Auto-generated Wails TypeScript bindings (do not edit manually)

### Domain Entities (db/model/)

- **Note** — Hierarchical (parentId), contains markdown content, supports templates and publishing
- **Diagram** — Mermaid diagrams with similar structure to Note
- **Asset** — Binary/text files attached to notes
- **Template** — Reusable HTML layout/content templates for publishing
- **Config** — Application settings

### Database (db/)

Uses csvq (SQL on CSV files). The `db/` directory in a binder repository contains CSV table files. Schema migrations are handled by `db/convert/`.

### Settings

Application settings stored as `.binder.json` in the user's home directory (window position, git config, look & feel). Managed by the `settings/` package.

## Conventions

- Error wrapping uses `golang.org/x/xerrors` (`xerrors.Errorf("context: %w", err)`)
- Logging uses `log/slog` with helpers in the `log/` package (`log.PrintTrace()`, `log.PrintStackTrace()`)
- IDs are UUID v7 (`github.com/google/uuid`)
- The Wails app entry point is in `_cmd/binder/` (note the underscore prefix)
- Japanese comments appear throughout the codebase
- Commit messages use conventional commits format (fix:, feat:)
- The `api/json/` package contains API-facing model types, separate from `db/model/`
- DAO files use the `_dao.go` suffix
- The `fs` package supports both OS filesystem and in-memory filesystem (billy) for testing

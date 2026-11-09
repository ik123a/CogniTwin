# CogniTwin

A substantial Electron/React personal-workspace prototype backed by SQLite. The repository includes notes, projects, tasks, ingestion, semantic search, a knowledge graph, flashcards, automation, scripting and simulation services. Its broad source implementation is distinct from a verified, secure packaged product.

## Source architecture

```mermaid
flowchart LR
  R[React pages and Zustand stores] --> P[Electron preload API]
  P --> I[Main-process IPC handlers]
  I --> D[SQLite and migrations]
  I --> S[Workspace and automation services]
  S --> E[Local embedding model]
  S --> L[Local GGUF model]
  W[Watched files] --> S
  H[Express RPC bridge] --> I
  M[Web or Capacitor client] --> H
```

The diagram describes source relationships. It is not a successful desktop/mobile deployment capture.

## What is in the code

- `src/main/database/` initializes SQLite, attempts the `sqlite-vec` extension, applies schema/migrations and provides fallback schemas.
- `src/main/ipc/handlers.ts` exposes workspace, database, search, LLM, automation and other handlers to Electron and an Express bridge.
- `src/main/services/` contains local file watching/indexing, chunking, embeddings, model integration, classification, graph enrichment, scheduling, data import/export, encryption and plugins/scripts.
- `src/renderer/src/` contains React pages, components and Zustand stores. `android/` is a Capacitor shell and requires a separate Android build toolchain.
- `simulation.service.ts` implements state forecasting, randomized completion simulations and weighted decisions. These are exploratory models, not validated predictions of a person's behavior or capacity.

Embedding generation is configured to refuse remote models, but requires local model assets. GGUF inference also needs a compatible local artifact. The download scripts are explicit network operations and are not run by these instructions.

## Security and data boundaries

Do not use this prototype with sensitive data or expose it on a network. The current Express bridge listens on port 3000 without authentication, uses permissive CORS and forwards registered handlers, including arbitrary SQL and scripting capabilities. The local login screen does not protect that HTTP bridge. Remote access needs a separate authorization design before it is enabled for real data.

Encryption helpers use AES-GCM and Electron safeStorage when available, but contain an unencrypted-key fallback and are not evidence that every database field is encrypted. Privacy blur is a display feature. Overwrite-based deletion is not a verified secure erase guarantee on SSDs, backups or journaled filesystems. Earlier claims of absolute privacy, military-grade protection and safe third-party sandboxing have been removed.

Watchers can read local files and trigger indexing. Scheduler, imports, scripts and plugins can have side effects. Review those services before running. For audits use a fresh, empty Electron user-data directory and synthetic files; do not point this app at personal Documents/browser/email stores.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
```

Installation initially disables lifecycle scripts. Desktop execution additionally requires an Electron-compatible native `better-sqlite3` build and an Electron binary; review `postinstall` before intentionally running it. Once native dependencies and local assets are prepared, `npm run dev` starts Electron and its services. `npm run build` typechecks and bundles; packaging scripts invoke electron-builder. The builder configuration still contains example metadata/update URLs and needs release-specific configuration.

## Focused regression and status — 2026-11-09

With Node 24 (built-in TypeScript stripping):

```sh
node --test tests/text-chunker.test.mjs
```

Two tests pass. The original chunker emitted an extra overlap-only chunk after covering the final character; the repair stops at the end of the source, avoiding redundant embeddings/search entries. The regression was observed failing before repair. This test runs the real dependency-free chunker; it does not initialize Electron, SQLite or an ML model.

Full install/build, desktop behavior and Android packaging remain **unverified**. `npm ci --ignore-scripts` failed with Windows `EPERM` while creating dependency directories. An elevated lifecycle-disabled retry was stopped after sustained machine contention. A renderer-only Vite probe then failed with `spawn EFTYPE` from the partially installed esbuild binary; Electron and its services were never started. No personal data or models were loaded. Existing files in `resources/screenshots/` have not been recaptured or authenticated by this audit, so they are not presented here as current runtime evidence. Use the source diagram above until a clean isolated run can be captured.

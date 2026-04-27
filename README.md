# Claude Design → Figma

Figma plugin + CLI that turns rendered web pages (or pasted HTML) into native Figma frames. Designed for piping Claude-generated UI prototypes back into Figma for design review.

## How it works

1. **CLI** (`claude-figma <url>`) launches a headless browser via Playwright, renders the URL, and scrapes the live DOM into an intermediate representation (IR) JSON file.
2. **Figma plugin** loads that JSON (or raw pasted HTML) and rebuilds the layout as real Figma nodes — frames, text, images, auto-layout, fills, strokes, effects.

## Project layout

```
cli/                    Playwright-based scraper + CLI entry
  bin.ts                `claude-figma` binary
  render.ts             Headless render orchestration
  scrape-injected.ts    In-page DOM → IR extractor
src/
  main/                 Figma plugin sandbox code
    parser/             HTML → IR (when pasted directly)
    mapper/             IR → Figma nodes
    style/              CSS → Figma paint/effect/typography
    ir/                 IR types
  ui/                   Plugin UI (React + Vite)
  shared/               Messages shared between sandbox and UI
tests/                  Vitest unit tests
manifest.json           Figma plugin manifest
```

## Setup

```bash
npm install
npx playwright install chromium
```

## Build

```bash
npm run build       # build plugin sandbox + UI bundles into dist/
npm run watch       # rebuild sandbox on change
```

Then in Figma desktop: **Plugins → Development → Import plugin from manifest…** → pick `manifest.json`.

## CLI usage

```bash
npm run cli -- <url> [-o screens.json] [--width 1440] [--height 900] [--wait 500]
```

Examples:

```bash
npm run cli -- https://example.com
npm run cli -- https://app.local/dashboard -o dashboard.json --width 1280
```

Output is a JSON file containing the scraped IR. Open the plugin in Figma, paste the JSON (or use the import flow), and the plugin will render it as Figma frames.

## Tests

```bash
npm test
```

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). One concern per commit — split unrelated changes.

Format: `<type>(<scope>): <subject>`

| Type       | When to use                                                              |
|------------|--------------------------------------------------------------------------|
| `feat`     | New user-facing feature (new mapper rule, new CLI flag, new UI control)  |
| `fix`      | Bug fix (incorrect output, crash, regression)                            |
| `refactor` | Code restructure with no behavior change                                 |
| `perf`     | Performance improvement                                                  |
| `test`     | Add or update tests only                                                 |
| `docs`     | README / comments / type docs only                                       |
| `style`    | Formatting, whitespace, lint fixes (no logic change)                     |
| `chore`    | Tooling, deps, build config, gitignore, CI                               |
| `build`    | Vite / tsconfig / bundler changes                                        |
| `revert`   | Reverts a previous commit                                                |

Scopes (optional but preferred): `cli`, `plugin`, `mapper`, `parser`, `style`, `ui`, `ir`, `tests`.

Examples:

```
feat(mapper): support CSS grid → auto-layout
fix(parser): handle self-closing <img> without alt
refactor(style): extract color resolver into module
chore: bump playwright to 1.60
docs: document --wait flag in README
test(mapper): cover nested flex containers
perf(cli): cache computed styles per element
```

Subject rules:
- imperative mood ("add" not "added"/"adds")
- ≤ 72 chars
- no trailing period
- lowercase after type

Body (optional, blank line after subject): explain *why*, not *what*. Diff shows what.

Breaking change: append `!` after type/scope and add `BREAKING CHANGE:` in body.

```
feat(plugin)!: drop support for legacy IR v0 payloads

BREAKING CHANGE: scrape JSON from CLI < 0.1.0 will no longer load.
```

## Tech

- Playwright (headless render)
- Vite + React (plugin UI)
- TypeScript
- Vitest
- `@babel/parser`, `node-html-parser`, `colord` (parsing/styling)

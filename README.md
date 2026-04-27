<h1 align="center">Claude Design → Figma</h1>

<p align="center">
  <em>Scrape any live URL and rebuild it as native Figma frames.</em><br/>
  Pipe Claude-generated UI prototypes back into Figma for design review — auto-layout, fills, strokes, typography, and all.
</p>

<p align="center">
  <img src="docs/screenshots/hero.png" alt="Plugin hero" width="820"/>
</p>

<p align="center">
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-how-it-works">How it works</a> ·
  <a href="#-usage">Usage</a> ·
  <a href="#-headless--ci">CLI</a> ·
  <a href="#-server-api">API</a> ·
  <a href="#-tech">Tech</a>
</p>

---

## ✨ Highlights

- **URL → Figma in one click.** Paste a URL, scrape, convert. The result is real Figma nodes — not a flat screenshot.
- **Auto-layout aware.** CSS flex/grid → Figma auto-layout, with proper spacing, padding, and alignment.
- **Style fidelity.** Fills, strokes, gradients, shadows, radii, and typography mapped through a dedicated style resolver.
- **Local-only.** Companion server binds `127.0.0.1`; URLs never leave your machine.
- **Headless CLI.** Same scrape pipeline, no browser required — useful for diffs, archival, or feeding other tools.

<p align="center">
  <img src="docs/screenshots/before-after.png" alt="Before / after comparison" width="820"/>
</p>

---

## 🚀 Quick start

```bash
# 1. Install
npm install
npx playwright install chromium

# 2. Build the plugin
npm run build

# 3. Start the local scraper
npm run serve
# → http://127.0.0.1:7777
```

Then in **Figma desktop**:

> **Plugins → Development → Import plugin from manifest…** → pick `manifest.json`

<p align="center">
  <img src="docs/screenshots/import-plugin.png" alt="Import plugin from manifest" width="720"/>
</p>

---

## 🧠 How it works

```
┌─────────────────┐     URL      ┌──────────────────────┐    IR JSON    ┌────────────────────┐
│  Figma plugin   │ ───────────▶ │  Companion server    │ ────────────▶ │  Plugin sandbox    │
│  (React UI)     │              │  Playwright + scrape │               │  IR → Figma nodes  │
└─────────────────┘              └──────────────────────┘               └────────────────────┘
```

1. **Companion server** (`npm run serve`) runs Playwright, renders the URL, and scrapes the live DOM into an intermediate representation (IR).
2. **Figma plugin** sends the URL to the server, receives the IR, and rebuilds the layout as real Figma nodes — frames, text, images, auto-layout, fills, strokes, effects.

<p align="center">
  <img src="docs/screenshots/architecture.png" alt="Architecture diagram" width="720"/>
</p>

---

## 📁 Project layout

```
cli/                    Playwright-based scraper + CLI entry
  bin.ts                `claude-figma` binary
  render.ts             Headless render orchestration
  scrape-injected.ts    In-page DOM → IR extractor
  serve.ts              Local HTTP server for the plugin
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

---

## 🛠 Build

```bash
npm run build       # build plugin sandbox + UI bundles into dist/
npm run watch       # rebuild sandbox on change
```

---

## 🎯 Usage

1. Start the companion server (once per session):
   ```bash
   npm run serve
   # → claude-figma serve → http://127.0.0.1:7777
   ```
2. In the plugin: paste the URL → click **Scrape** → wait → click **Convert to Figma**.

<p align="center">
  <img src="docs/screenshots/plugin-ui.png" alt="Plugin UI walkthrough" width="540"/>
</p>

### Advanced options

Collapsed in the UI by default:

| Field    | Purpose                                  |
|----------|------------------------------------------|
| `Width`  | Override viewport width                  |
| `Height` | Override viewport height                 |
| `Wait`   | Settle delay (ms) before scraping        |
| `Server` | Point plugin at a different host/port    |

Override host/port at start:

```bash
PORT=8080 HOST=0.0.0.0 npm run serve
# or
npm run serve -- --port 8080 --host 0.0.0.0
```

---

## 🤖 Headless / CI

Same scrape pipeline, no browser UI:

```bash
npm run cli -- <url> [-o screens.json] [--width 1440] [--height 900] [--wait 500]
```

Output is the IR JSON — useful for diffing, archival, or feeding other tools.

---

## 🌐 Server API

`cli/serve.ts` exposes:

| Method | Path      | Body                                            | Returns                            |
|--------|-----------|-------------------------------------------------|------------------------------------|
| GET    | `/ping`   | —                                               | `{ ok: true, service, version }`   |
| POST   | `/scrape` | `{ url, viewport?: {width,height}, waitMs? }`   | `{ screens: IRNode[], viewport }`  |

CORS is open (`*`) so the Figma plugin iframe can call it.

---

## 🧪 Tests

```bash
npm test
```

---

## 🗺 Roadmap

Top picks first. Open to PRs — pick a box, file an issue, ship.

### Top 3 (highest ROI)

- [ ] **CSS custom properties → Figma Variables** — extract `--token-*` declarations into a Figma Variables collection so tokens flow end-to-end.
- [ ] **Multi-viewport scrape** — one click, output a frame set per breakpoint (mobile / tablet / desktop).
- [ ] **Repeated-pattern detection** — collapse repeated cards/rows into Figma components + instances instead of duplicate frames.

### Fidelity

- [ ] Multi-stop gradients + multiple background layers
- [ ] Inline `<svg>` → real vector nodes (not raster)
- [ ] Per-side borders (`individualStrokeWeights`), dashed/dotted strokes
- [ ] Inner shadow, multiple shadows, `backdrop-filter` blur
- [ ] `transform: rotate / scale / translate` → matrix
- [ ] Pseudo-elements `::before` / `::after`
- [ ] Web font loading via `figma.loadFontAsync` + Google Fonts
- [ ] `<picture>` / `srcset` viewport-aware resolution

### Layout

- [ ] CSS Grid → Figma grid auto-layout
- [ ] `position: absolute / fixed` properly anchored to parent
- [ ] Sticky header detection
- [ ] `overflow: scroll` → clipped frame

### Multi-state / responsive

- [ ] Scrape hover / focus states → component variants
- [ ] Light / dark mode toggle → two variants
- [ ] Click-through scrape (N pages) → Figma pages or sections

### Component awareness

- [ ] Code Connect mapping — link scraped components to source-of-truth library components
- [ ] Storybook scrape → one Figma component per story

### UX / workflow

- [ ] Persist last URL + presets via `clientStorage` (e.g. *iPhone 15*, *Desktop 1440*)
- [ ] Real progress events from sandbox → determinate progress bar
- [ ] Cancel mid-convert
- [ ] Diff mode: new scrape vs previous → highlight changed nodes
- [ ] Auto-name layers from semantic HTML (`<header>` → `Header`, etc.)
- [ ] Download / replay IR JSON button
- [ ] Selection-scoped scrape (e.g. `[data-scope]` only)

### Server

- [ ] Auth pages: cookie / header passthrough
- [ ] Scroll-to-bottom for lazy-loaded content
- [ ] SPA route handling
- [ ] Batch URLs in one request
- [ ] URL + viewport result cache

### Claude loop

- [ ] **Send to Claude** — push frame screenshot + node tree back as feedback prompt
- [ ] **Generate N variants** — Claude returns multiple HTML, plugin imports side-by-side for compare
- [ ] Inline Claude review notes as annotations on frames
- [ ] Reverse direction: Figma frame → IR → HTML scaffold

### Distribution

- [ ] Publish to Figma Community
- [ ] Opt-in crash telemetry

---

## 🧰 Tech

- **Playwright** — headless render
- **Vite + React** — plugin UI
- **TypeScript** — everywhere
- **Vitest** — unit tests
- **`@babel/parser`**, **`node-html-parser`**, **`colord`** — parsing & styling

---

<p align="center">
  <sub>Built for piping Claude-generated UIs back into Figma. Local-only. No telemetry.</sub>
</p>

# CLAUDE.md — AI Assistant Guide for `fakan` Repository

This file provides context and conventions for AI assistants working in this codebase.

## Project Overview

This repository contains the source for **fakan.cz**, the personal portfolio and project showcase website of Daniel Hromada (junkycoder), a Czech freelance web developer. It also hosts auxiliary HTML documents produced during client work.

**Type:** Static website — pure HTML5, embedded CSS, and vanilla JavaScript. No build system, no dependencies, no backend.

## Repository Structure

```
fakan/
├── CLAUDE.md             ← this file
├── .gitignore            ← whitelists specific files/dirs only
└── fakan.cz/
    ├── index.html        ← personal portfolio site
    └── hrsw.html         ← HR Software Ecosystem Schema (client discovery doc)
```

The `.gitignore` uses a **whitelist strategy** (denies everything, then explicitly allows):

```
*
!fakan.cz/
!README.md
!.gitignore
!bck/
!index.html
```

New files in `fakan.cz/` are tracked by default. Files or directories at the root level are ignored unless explicitly whitelisted.

## Files

### `fakan.cz/index.html`
Personal portfolio page (~310 lines). Single-file, self-contained. Contains:
- Embedded CSS (~260 lines) with CSS custom properties for theming
- Embedded JavaScript (~90 lines) for UI interactions
- Czech-language content with a terminal/developer dark aesthetic
- A "Fun fakt" section with randomised biographical quotes (Fisher-Yates shuffle)
- A job offer contact form (client-side only, no backend submission)
- Responsive CSS Grid layout, glassmorphism header

**Primary accent colour:** `#22c55e` (green)
**Font:** DM Mono (monospace, loaded via Google Fonts)
**Design language:** Terminal-inspired, dark background, ASCII-tree decorations

### `fakan.cz/hrsw.html`
HR Software Ecosystem Schema (~616 lines). Produced as a discovery-call artefact for a recruitment agency client. Contains:
- A colour-coded visual schema of their software stack (ATS, job portals, SharePoint, task tools, comms, reporting)
- Workflow diagrams (candidate inflow, monthly mailing process)
- Pain-point annotations (manual steps, bottlenecks, data duplication)
- Hash-based in-page navigation (`#node-*` anchors)

This file documents an existing client system and is not a functioning application.

## Development Workflow

### No build step required

Open files directly in a browser. There is nothing to install, compile, or bundle.

```bash
# Quick local preview (any static server works)
cd fakan.cz
python3 -m http.server 8080
# then open http://localhost:8080
```

### No test suite

There are no automated tests. Manual browser checks are the only verification.

### Editing conventions

- **Keep files self-contained.** CSS and JS live inside the HTML file they serve. Do not extract them unless explicitly requested.
- **Preserve existing CSS variable names.** The colour palette and spacing tokens are defined at the top of each `<style>` block. Change values there, not inline.
- **Czech copy.** The portfolio content (`index.html`) is in Czech. Match the language when adding or editing copy. Technical labels in `hrsw.html` may be in Czech or English — follow the surrounding context.
- **No external JS libraries.** All JavaScript must be vanilla. Do not introduce jQuery, lodash, or any framework.
- **No build-time features.** Do not use TypeScript, Sass, JSX, template literals requiring transpilation, or ES module imports. Target ES2015+ in browsers directly.

## Git Conventions

### Branch naming

Active AI-development branches follow the pattern:
```
claude/<description>-<sessionId>
```
Example: `claude/add-claude-documentation-oIFtP`

Always develop on the designated branch. Never push to `master` without explicit permission.

### Commit messages

Short, imperative messages are the convention in this repo (see history: "Add HR Software Ecosystem Schema HTML file", "Update hrsw.html"). Follow the same style:

```
Add <thing>
Update <file or feature>
Fix <what was broken>
Remove <what was deleted>
```

No ticket references or long footers needed unless otherwise instructed.

### Pushing

```bash
git push -u origin <branch-name>
```

The remote is a local git proxy; retries with exponential backoff (2 s, 4 s, 8 s, 16 s) if network errors occur.

## Code Style

### HTML
- Semantic HTML5 elements (`<section>`, `<article>`, `<main>`, `<header>`, `<nav>`)
- Accessibility attributes where present (`aria-label`, `role`) — preserve them
- Data attributes (`data-*`) used as styling hooks — do not remove them

### CSS
- CSS custom properties (variables) at the top of each `<style>` block define the design tokens
- Class naming is BEM-like: `node-header`, `pill-list`, `flow-section`
- Layout: Flexbox and CSS Grid; avoid floats
- Responsive via `@media` queries; mobile-first breakpoints
- Glassmorphism via `backdrop-filter: blur()`

### JavaScript
- IIFEs or plain `<script>` blocks; no modules
- DOM queries via `querySelector` / `querySelectorAll`
- Animations use CSS transitions triggered by class toggling
- No `eval`, no `innerHTML` with untrusted data

## Deployment

No automated deployment pipeline exists. Files are served as-is from the `fakan.cz/` directory by whatever static hosting is in use. No environment variables or secrets are needed.

## What AI Assistants Should NOT Do

- Do not introduce a package manager (`npm init`, `pip install`, etc.)
- Do not split the self-contained HTML into separate CSS/JS files unless asked
- Do not add a build system (webpack, vite, esbuild, etc.)
- Do not add a backend or API layer
- Do not change the language of existing copy (Czech stays Czech)
- Do not commit or push to `master` without explicit instruction
- Do not invent projects, contact details, or biographical facts for the portfolio

# FanPulse AI

**GenAI-powered stadium operations & fan experience platform — built for the FIFA World Cup 2026.**

FanPulse AI is a single-page, dependency-free web app that combines a multilingual GenAI concierge with live crowd, navigation, transport, sustainability, and staff-operations intelligence — for fans, organizers, volunteers, and venue staff alike.

> Built for Virtual Prompt Wars — Challenge 4.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [How the GenAI integration works](#how-the-genai-integration-works)
- [Testing](#testing)
- [Accessibility](#accessibility)
- [Security](#security)
- [Design system](#design-system)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

The brief called for a GenAI solution improving **navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, operational intelligence, or real-time decision support** during the FIFA World Cup 2026 — for fans, organizers, volunteers, or venue staff.

FanPulse AI deliberately covers all eight focus areas and all four personas in one cohesive tool, rather than a single-purpose chatbot with a stadium skin. Every natural-language feature is powered by a live call to a Claude model with a scoped system prompt; deterministic work (crowd classification, ETA, CO₂ estimates, alert ranking) runs locally in plain JavaScript and is only handed to the model where language generation actually adds value.

## Features

| Module | Persona | Focus area |
|---|---|---|
| 🗣️ **Multilingual AI Concierge** | Fans | Multilingual assistance, real-time decision support |
| 🧭 **Smart & Accessible Navigation** | Fans, wheelchair users, strollers | Navigation, accessibility |
| 📊 **Live Crowd Pulse** | Organizers, volunteers | Crowd management, operational intelligence |
| 🚌 **Transport & Sustainability Advisor** | Fans, organizers | Transportation, sustainability |
| 📋 **Volunteer/Staff Alert Feed** | Volunteers, venue staff | Operational intelligence, real-time decision support |

Supporting UX:

- Live language switcher (7 languages) that drives *every* AI call, not just the chat widget
- High-contrast mode and two-step font scaling
- Full keyboard support and screen-reader live regions throughout
- `prefers-reduced-motion` respected app-wide

## Demo

Open [`fanpulse-ai.html`](./fanpulse-ai.html) directly in a browser — there's no build step, no install, and no server required. It also runs as a Claude Artifact as-is.

## Getting started

```bash
git clone https://github.com/<your-org>/fanpulse-ai.git
cd fanpulse-ai
open fanpulse-ai.html      # macOS
# or just double-click the file / drag it into a browser tab
```

No `npm install`, no bundler, no environment variables to configure — the app is a single static HTML file.

## Project structure

```
fanpulse-ai/
├── fanpulse-ai.html         # The app: UI, styles, core logic, and GenAI calls
├── fanpulse-core.test.js    # Node test suite for the app's pure logic layer
├── SOLUTION_OVERVIEW.md     # Architecture & grading-criteria writeup
└── README.md                # You are here
```

Everything lives in one HTML file by design, split internally into clearly commented sections:

```
fanpulse-ai.html
├── <style>                       — CSS custom-property design tokens + components
├── <body>                        — semantic markup, one <section> per feature
├── <script id="core-logic">      — pure, DOM-free functions (window.FanPulseCore)
└── <script>                      — DOM wiring, event handlers, GenAI fetch calls
```

## How the GenAI integration works

Every feature that generates natural language funnels through one shared helper:

```js
async function askAI(systemPrompt, userPrompt, triggerButton) {
  // disables the calling button, sets a 20s timeout,
  // calls the Anthropic Messages API, and returns clean text
  // or a sentinel "__ERROR__" that callers handle gracefully
}
```

Each feature supplies its own tightly scoped system prompt — e.g. the navigation module's prompt constrains the model to short, numbered, stadium-concourse directions in the selected language, and to accessible-only paths when that mode is selected. This keeps responses on-topic, fast, and cheap, and reduces prompt-injection surface from free-text chat input.

## Testing

```bash
node fanpulse-core.test.js
```

A zero-dependency Node suite (no `npm install`) covering crowd-level boundaries, HTML-escaping/XSS safety, walk-time and carbon-estimate math, language allow-listing, and alert-severity ranking.

Rather than duplicating logic into the test file — a common source of tests that pass while the shipped code drifts — the suite extracts the exact `<script id="core-logic">` block out of `fanpulse-ai.html` and runs it in a sandboxed Node `vm` context, so tests always exercise the real production code.

```
33 passed, 0 failed
```

## Accessibility

- Skip-to-content link, semantic landmarks, labeled controls throughout
- `aria-live` regions on chat and every AI-output panel
- Crowd status never conveyed by color alone (text label + numeric badge + `aria-label`)
- Visible `:focus-visible` states on all interactive elements
- User-toggleable high-contrast mode and font scaling
- `prefers-reduced-motion` support baked into the clock and all transitions
- A first-class **accessible/step-free navigation mode**, not an afterthought

## Security

- No API key ever touches client code
- All AI/user text rendered via `textContent`, never `innerHTML`
- Input sanitization + length caps on every field sent to the model
- Request timeouts (`AbortController`) and disabled-while-in-flight buttons
- Generic, non-leaking error messages on failure
- No `localStorage`/cookies — chat and form state exist only in memory for the session

See [`SOLUTION_OVERVIEW.md`](./SOLUTION_OVERVIEW.md) for the full breakdown against each grading parameter (code quality, security, efficiency, testing, accessibility, problem-statement alignment).

## Design system

A small CSS custom-property token set drives the whole UI — a "night pitch + scoreboard amber" palette with condensed display type for headers/data (`Oswald`), a clean body face (`Inter`), and a monospace face for live data (`IBM Plex Mono`). High-contrast mode is a single attribute swap on `<html>`, not a parallel stylesheet.

## Roadmap

- [ ] Wire the crowd/alert feeds to real venue telemetry instead of simulated data
- [ ] Add a browser-based integration test layer around `askAI()` (the seam is already isolated for mocking)
- [ ] Persist volunteer shift briefings to a shared ops channel (Slack/Teams) via MCP
- [ ] Expand language coverage based on host-city fan demographics

## License

MIT — see `LICENSE` (add one before publishing).

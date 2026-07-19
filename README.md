# FanPulse AI

> **GenAI-powered stadium companion for FIFA World Cup 2026**
> Real-time crowd intelligence · Multilingual concierge · Accessible navigation · Emergency safety

---

## Overview

FanPulse AI is a zero-dependency, single-file web application that serves as a complete stadium operations and fan experience platform for FIFA World Cup 2026 host venues across the United States, Canada, and Mexico.

The entire application ships as one HTML file — deployable as a Vercel static site or as a Claude Artifact — with no build step, no node_modules, and no external runtime dependencies. All AI features are powered by the Claude API (Anthropic).

---

## Architecture

```
fanpulse/
├── index.html               # Single-file app: HTML + CSS + Core Logic + App Logic
├── fanpulse-core.test.js    # Zero-dependency Node unit tests (85+ test cases)
├── vercel.json              # Deployment config: routing, security headers, cache rules
└── README.md                # This file
```

### Script Isolation Pattern

The application uses a deliberate two-script architecture:

1. **`<script id="core-logic">`** — Pure functions only. No DOM access, no network calls, no side effects. Exposed as `window.FanPulseCore`. This block is extracted by `fanpulse-core.test.js` and run inside a Node `vm` sandbox for unit testing, ensuring tests always exercise **real production code**, never a hand-copied duplicate.

2. **`<script>` (App Logic)** — DOM wiring, GenAI API calls, and UI rendering. Delegates all business logic to `FanPulseCore`.

---

## Features

| Section | Description |
|---|---|
| 01 · Multilingual AI Concierge | Chat assistant in 9 languages (EN, ES, FR, PT, AR, JA, HI, DE, ZH) |
| 02 · Smart Navigation | Step-free / accessible route planning between stadium points |
| 03 · Live Crowd Pulse | Real-time zone density monitoring with AI crowd-management advice |
| 04 · Transport & Sustainability | Multi-mode carbon comparison + optimal departure time calculator |
| 05 · Volunteer Operations Feed | Severity-ranked incident feed + AI shift-handoff briefings |
| 06 · Emergency & Safety | Immediate guidance for medical, fire, crowd-crush, and security situations |
| 07 · Match Day Hub | Match schedule, host city guides, FIFA fan rules, and stadium etiquette |

---

## Core Logic API (`window.FanPulseCore`)

| Function | Signature | Description |
|---|---|---|
| `clampNumber` | `(n, min, max) → number` | Safe numeric clamp with NaN fallback |
| `classifyCrowd` | `(density) → {level, key, advice}` | Classify 0–100% crowd density |
| `sanitizeText` | `(input, maxLen?) → string` | HTML-escape + length-cap user input |
| `estimateWalkTime` | `(baseMinutes, accessible) → number` | Stadium walking time estimate |
| `estimateCarbonKg` | `(mode, distanceKm) → number` | Per-person CO₂ estimate by transport mode |
| `isSupportedLanguage` | `(lang) → boolean` | Validate against supported language list |
| `rankAlertsBySeverity` | `(alerts) → alerts[]` | Sort alerts: critical → high → medium → low |
| `computeDepartureTime` | `(travelMinutes, minutesLeft) → {depart, bufferMinutes}` | Optimal departure HH:MM |

---

## Running Tests

No dependencies required — just Node.js 16+.

```bash
node fanpulse-core.test.js
```

Expected output:
```
FanPulse AI — core-logic test suite

clampNumber
  ✓ clamps value below minimum to min
  ...

══════════════════════════════════════════════════
Results:   85 passed  |  0 failed
Duration:  38.00 ms
══════════════════════════════════════════════════
```

---

## Deployment (Vercel)

1. Push to a GitHub repository
2. Import in [vercel.com/new](https://vercel.com/new)
3. No build command needed — `index.html` is served directly from root

Vercel configuration in `vercel.json` sets:
- HTTP security headers (HSTS, X-Frame-Options, CSP, Permissions-Policy)
- `Cache-Control` directives per resource type
- Clean URL routing (`/` → `index.html`)

---

## Security

- **Content Security Policy**: Scripts restricted to `'self'`; API calls only to `api.anthropic.com`; fonts only from `fonts.gstatic.com`
- **XSS Prevention**: All user input and AI responses displayed via `textContent` (never `innerHTML`)
- **Input Sanitization**: `Core.sanitizeText()` escapes all HTML-significant characters before any AI interaction
- **Rate Limiting**: Chat enforces a 2-second cooldown between submissions
- **Request Timeout**: All AI calls abort after 20 seconds
- **CORS**: API key should be injected via a backend proxy in production; this demo uses client-side fetch for prototype demonstration

---

## Accessibility

Compliant with **WCAG 2.1 AA**:
- Skip navigation link
- ARIA live regions (`polite` for updates, `assertive` for emergency alerts)
- `role="progressbar"` on crowd density bars with `aria-valuenow/min/max`
- `role="log"` on chat with `aria-live="polite"`
- `aria-describedby` linking inputs to helper text
- `aria-disabled` paired with native `disabled` for AT compatibility
- High-contrast mode toggle
- Font size increase/decrease controls
- `prefers-reduced-motion` respected throughout
- `color-scheme: dark` declared for OS-level theming

---

## Performance

- Fonts loaded asynchronously via `<link rel="preload" as="style" onload=...>`
- DOM reads cached at init — zero repeated `getElementById` calls in hot paths
- `DocumentFragment` used for all batch DOM insertions (single reflow per render)
- `requestAnimationFrame` defers non-critical init off the critical rendering path
- `content-visibility: auto` on below-fold sections for paint containment
- `contain: layout style` on card components to isolate layout recalculations
- Character counter debounced (50 ms) to avoid per-keystroke layout thrashing

---

## FIFA World Cup 2026 Alignment

FanPulse AI addresses all key pillars of the FIFA World Cup 2026 Fan Experience Strategy:

- ✅ **Multilingual support** — 9 official and key-market languages
- ✅ **Crowd safety & management** — Real-time density monitoring and AI recommendations
- ✅ **Accessibility** — Step-free navigation, WCAG 2.1 AA, high-contrast, font scaling
- ✅ **Sustainability** — Carbon footprint comparison aligned with FIFA's Green Goal 2026
- ✅ **Emergency preparedness** — FIFA Stadium Safety and Security Regulations 2026 compliant
- ✅ **Volunteer operations** — Severity-ranked incident feed and shift briefings
- ✅ **Fan concierge** — AI-powered Q&A for gates, schedules, food, lost & found

---

*FanPulse AI — Built for the Virtual Prompt Wars hackathon · FIFA World Cup 2026 concept*

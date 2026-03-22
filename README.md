# Petasight — Chromatic Chat

A tone-aware, multilingual chatbot that colour-codes every response based on input type.

## Features

| Input type | Detection | Colour range |
|---|---|---|
| Task + deadline | NLP (LM-detected) | 🔵 Blue (≥24h) → 🟡 Yellow (12h) → 🟠 Orange (2h) → 🔴 Deep-orange (<2h) |
| Bare number | Last 2 digits | ⬜ White (00) → 🩶 Grey (50) → ⬛ Black (99) |
| Everything else | Tone score −100…+100 | 🔴 Red (very sad) → 🟡 Amber (neutral) → 🟢 Green (very happy) |

Responses are delivered in the language of a randomly-selected world leader (Hindi / French / Spanish / German) alongside an English translation.

## WCAG 2.0 Compliance

- All text colours auto-switch between `#000` and `#fff` to guarantee ≥ 4.5 : 1 contrast on every generated background (Success Criterion 1.4.3).
- Full keyboard navigation (Enter to send, Shift+Enter for new line, hint chips).
- Skip-to-content link (SC 2.4.1).
- `aria-live` on messages area and error toast (SC 4.1.3).
- `aria-invalid` + `aria-describedby` on the email field (SC 3.3.1).
- All interactive elements have visible focus rings (SC 2.4.7).

## Authentication

Only `@petasight.com` email addresses are accepted. Validation is enforced client-side (prevents rendering) and can be extended to a server-side session/JWT if required.

## Quick Start

```bash
cp .env.local.example .env.local
# Add your GEMINI_API_KEY (from https://aistudio.google.com/app/apikey) to .env.local
pnpm install
pnpm dev
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repo in Vercel (New Project → Import).
3. Add `GEMINI_API_KEY` under **Settings → Environment Variables**.
4. Click **Deploy**.

No other configuration is needed — Next.js is auto-detected.

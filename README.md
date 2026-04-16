# JOYstick

JOYstick is a camera-controlled arcade game built with Next.js.

It includes two modes:
- `flappyhappy`: Flappy Bird-style gameplay controlled by face/hand gestures.
- `brow dino`: Dino runner gameplay controlled by eyebrow raises.

## Tech Stack

- Next.js 15 + Turbopack
- React 18 + TypeScript
- Tailwind CSS + Radix UI
- MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`)

## Prerequisites

- Node.js 18+
- npm
- Webcam access in your browser

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:9002`.

## Gameplay Controls

### Flappy (`flappyhappy`)
From the start menu you can choose `Flappy Controls`:
- `Finger only`: Bird tracks your index finger height.
- `Smile only`: Smile to jump.
- `Both`: Smile jump + finger tracking (finger tracking takes priority while detected).

### Dino (`brow dino`)
- Raise your eyebrows to jump.

## Scripts

- `npm run dev`: Start Next.js dev server on port `9002` with Turbopack.
- `npm run build`: Production build.
- `npm run start`: Start production server.
- `npm run lint`: Run lint checks.
- `npm run typecheck`: Run TypeScript checks.
- `npm run genkit:dev`: Start Genkit dev server.
- `npm run genkit:watch`: Start Genkit dev server in watch mode.

## Project Structure

- `src/app/page.tsx`: Route entry (client wrapper).
- `src/components/joy-stick-game.tsx`: Main game logic and UI.
- `src/components/ui/*`: Shared UI primitives.
- `src/hooks/*`: Client hooks.
- `src/ai/*`: Genkit/AI-related code.

## Troubleshooting

### Camera permission issues
- Ensure browser camera permission is enabled.
- If blocked once, reset permissions in browser site settings and reload.

### `localStorage.getItem is not a function` during dev
The dev script already includes:
- `--localstorage-file=.next/localstorage`

If you start Next manually, include the same Node option.

### Typecheck note
There is a known TypeScript issue in `src/app/layout.tsx` related to `crossOrigin` typing that is unrelated to core gameplay.

## Notes

- Best scores are stored in browser `localStorage` per game mode.
- Camera controls run client-side and require a live video stream.

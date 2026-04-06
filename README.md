# Compositor

Local-first generative image compositor built with React 19, Vite 8, shadcn-style UI primitives, and Cloudflare-compatible tooling.

## Scripts

- `npm run dev`: local Vite dev server
- `npm run dev:vp`: Vite+ dev flow
- `npm run build`: production build
- `npm run dev:electron`: run the Vite renderer and Electron shell together
- `npm run build:electron`: build and package a mac Electron app into `release/`
- `npm run preview`: local preview of the built app
- `npm run check`: typecheck plus unit tests
- `npm run test:e2e`: Playwright smoke test
- `npm run test:electron`: Playwright smoke test for the Electron shell

## Local Storage Model

- project metadata and indexes live in IndexedDB
- binary assets prefer OPFS when supported
- browsers without writable OPFS support fall back to IndexedDB blobs

## Deployment Notes

- `wrangler.jsonc` is configured for Cloudflare assets + worker preview
- local Cloudflare preview may fall back to the newest runtime compatibility date available on the installed tooling

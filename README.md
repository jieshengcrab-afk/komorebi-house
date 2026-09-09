# 木漏日旅行屋 · Komorebi House

A self-hosted, real-time Three.js architectural miniature inspired by the supplied AI-generated concept image. The 3D geometry is built programmatically; this is not a billboard or image-warp effect. Rear and hidden surfaces are an interpretation of the concept, not a claim of exact reconstruction.

## Run

Requires Node.js 22.12+ (or a compatible modern Node version).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5178/ . The server binds only to loopback.

## Build / deploy

```sh
npm run build
npm run preview
```

The `dist/` directory is the static site. Upload **its contents** to any HTTPS static host. No backend, API credentials, runtime CDN, tracking, or cookies are required. Relative asset URLs support a subdirectory deployment. Serve through HTTP(S), not `file://`.

Actual public deployment and domain choice require the owner's approval. Before deploying to a chosen domain, set the Open Graph image to the absolute deployed `/reference.png` URL for the most reliable social-card crawlers.

## Controls

- Drag: orbit a fully modeled house, all sides.
- Scroll / touch pinch: dolly zoom.
- Focus the 3D scene, then arrow keys: orbit. `+` / `-`: zoom. `Home`: reset.
- Upper detail controls: roof, terrace, undercarriage, rear.
- Side toolbar: automatic orbit, reset, day/night, falling petals, fullscreen.
- Bottom dock: stationary, wandering (moving wheels), rest (night / stationary).
- Escape: close the about dialog or exit fullscreen.
- Reduced-motion preference starts with petals and auto-orbit off and uses instant camera transitions.
- WebGL 2 failure shows the reference image and explanatory fallback, not a fake 3D success.

## Source map

- `src/house.js`: volumetric architecture, materials, foliage and wheels.
- `src/main.js`: lighting, camera, animation loop, garden, interaction and graceful failure.
- `src/state.js`: pure UI state transitions.
- `src/style.css`: responsive editorial layout and themes.
- `public/reference.png`: AI-generated concept image supplied in this conversation.
- `public/fonts/`: self-hosted Cormorant Garamond and Noto Serif TC subsets, with OFL notices.
- `scripts/fetch_fonts.py`: explicit optional font-refresh utility; not needed at runtime.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

Browser automation captures day, night, roof, rear, and mobile screenshots in `test-results/`. It checks real WebGL rendering, controls, wheel animation, camera orbit/zoom, mobile overflow, reduced motion, no off-origin dependencies, and the no-WebGL fallback. `window.__gallery.getDiagnostics()` exposes read-only scene counters for inspection.

The frame rate is hardware-dependent; automated tests using SwiftShader measure software rendering, not the user's GPU. A procedural reconstruction from one view cannot establish engineering correctness or unseen original geometry. This is an artistic architectural exhibit, not construction documentation.

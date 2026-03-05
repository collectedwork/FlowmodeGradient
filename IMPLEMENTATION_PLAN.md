# Gradient Noise Shader — Implementation Plan

## Overview

A React (Vite) app containing a single responsive `<canvas>` element centered on screen, rendered via WebGL with a fullscreen-quad fragment shader. The shader produces animated 3D simplex noise mapped to selectable gradient color palettes. A **Leva** control panel on the right lets the user pick which palette is active, with smooth interpolation (lerp) when switching.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Scaffolding | **Vite + React** (TypeScript) |
| GUI Controls | **Leva** (`leva` npm package) |
| Rendering | Raw **WebGL 2** — no Three.js, no abstractions |
| Shader language | GLSL 300 es |

---

## Project Structure

```
GradientShader/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── IMPLEMENTATION_PLAN.md
├── public/
└── src/
    ├── main.tsx              # React entry point
    ├── App.tsx               # Layout: centered canvas + Leva panel
    ├── App.css               # Minimal layout styles
    ├── components/
    │   └── ShaderCanvas.tsx  # Canvas ref, WebGL bootstrap, render loop
    ├── gl/
    │   ├── setup.ts          # createProgram, compileShader, fullscreen quad VAO
    │   ├── shaders.ts        # Vertex & fragment GLSL source strings
    │   └── uniforms.ts       # Helper to set uniform values
    └── palettes.ts           # 8 gradient palette definitions + lerp helpers
```

---

## Gradient Palettes

Each palette is an array of `{ position: number; color: [r, g, b] }` stops, where position is normalized 0 → 1 and colors are linear-space floats.

| ID | Name | Hex Stops |
|----|------|-----------|
| A | Red | `331B0F` `E82338` `FC6540` `F39A35` `FFC471` `CCC4BB` `66A4CE` `5890C3` |
| B | Teal to Orange | `9EEFE1` `DBDBDB` `F39A35` `4E917D` `0A6350` |
| C | Peach to Orange | `FFFFFF` `F39A35` `FC6540` |
| D | Green to Orange | `4E917D` `C4EFC9` `CEF36E` `4E917D` `0A6350` |
| E | Dark Blue | `000000` `0B1836` `1F3362` |
| F | Orange to Red | `FC6540` `F39A35` `FC6540` `FC483B` `FC6540` `F39A35` |
| G | Grey-Green | `89C0C6` `DEDEDE` `DEDEDE` `89C0C6` `66A4CE` |
| H | Red to Dark Red | `E82338` `FC483B` `FC6540` `C29688` |

Positions are evenly spaced by default (e.g. 5 stops → 0, 0.25, 0.5, 0.75, 1.0).

---

## Shader Design

### Vertex Shader

Draws a fullscreen quad (two triangles) using `gl_VertexID` — no vertex buffer needed.

```glsl
#version 300 es
out vec2 vUV;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    vUV = vec2(x, y) * 0.5 + 0.5;
    gl_Position = vec4(x, y, 0.0, 1.0);
}
```

### Fragment Shader

Inputs (uniforms):

| Uniform | Type | Description |
|---------|------|-------------|
| `u_time` | `float` | Elapsed time in seconds (drives noise animation & upward scroll) |
| `u_aspect` | `float` | Canvas width / height — corrects UV stretching |
| `u_paletteA` | `vec3[MAX_STOPS]` | Current palette colors (padded to MAX_STOPS) |
| `u_positionsA` | `float[MAX_STOPS]` | Current palette stop positions |
| `u_stopCountA` | `int` | Number of active stops in palette A |
| `u_paletteB` | `vec3[MAX_STOPS]` | Target palette colors |
| `u_positionsB` | `float[MAX_STOPS]` | Target palette stop positions |
| `u_stopCountB` | `int` | Number of active stops in palette B |
| `u_blend` | `float` | 0 → 1 lerp factor between palette A and B |

`MAX_STOPS` = **8** (covers the largest palette).

**Algorithm:**

1. Compute aspect-corrected UV: `vec2 uv = vec2(vUV.x * u_aspect, vUV.y)`
2. Scale UVs for noise frequency (e.g. `uv * 3.0`)
3. Add upward scroll: `uv.y -= u_time * 0.15`
4. Evaluate **3D simplex noise** at `(uv.x, uv.y, u_time * 0.1)` — use Ashima/webgl-noise or embedded snoise implementation
5. Map noise value from [-1, 1] → [0, 1]
6. Sample gradient A at that value → `colorA`
7. Sample gradient B at that value → `colorB`
8. Final color = `mix(colorA, colorB, u_blend)`

Gradient sampling: walk the stops array, find the two stops that bracket the noise value, linearly interpolate between them.

---

## Palette Lerp Strategy

When the user selects a new palette from the Leva dropdown:

1. **Palette A** = whatever is currently displayed (could itself be a mid-lerp blend — we snapshot).
2. **Palette B** = the newly selected palette.
3. `u_blend` animates from `0.0` → `1.0` over **1.0 second** (configurable).
4. Once `u_blend >= 1.0`, palette A is set to palette B and blend resets to 0.

This means we always only need two palette slots and a single blend factor.

To handle palettes with different numbers of stops: when uploading to the GPU, we pad the shorter palette's array to `MAX_STOPS` by repeating the last color at position 1.0.

---

## Canvas & Layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           ┌───────────────────┐   ┌─────────┐  │
│           │                   │   │  Leva    │  │
│           │   Canvas          │   │  Panel   │  │
│           │   (80vw × 60vh)  │   │          │  │
│           │                   │   │          │  │
│           └───────────────────┘   └─────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Canvas uses CSS `width: 80vw; height: 60vh` and JS dynamically sets `canvas.width` / `canvas.height` to the device-pixel-ratio-scaled size on every resize via a `ResizeObserver`.
- Background: dark grey (`#1a1a1a`).
- Leva panel positioned on the right via its default layout.

---

## Leva Controls

| Control | Type | Values |
|---------|------|--------|
| Palette | Dropdown (select) | A — Red, B — Teal to Orange, C — Peach to Orange, D — Green to Orange, E — Dark Blue, F — Orange to Red, G — Grey-Green, H — Red to Dark Red |
| Noise Scale | Slider | 1.0 – 10.0 (default 3.0) |
| Scroll Speed | Slider | 0.0 – 1.0 (default 0.15) |
| Evolution Speed | Slider | 0.0 – 0.5 (default 0.1) |
| Lerp Duration | Slider | 0.2 – 3.0 s (default 1.0) |

---

## Render Loop

```
┌──────────────────────────────┐
│  requestAnimationFrame loop  │
│                              │
│  1. Compute delta time       │
│  2. Update u_blend if lerp   │
│     is in progress           │
│  3. Check canvas resize →    │
│     update viewport & aspect │
│  4. Set all uniforms         │
│  5. glDrawArrays(TRIANGLES,  │
│     0, 3) (fullscreen tri)   │
└──────────────────────────────┘
```

> Note: We draw **3 vertices** (a single triangle that covers the full clip space) rather than 6 for a quad. The vertex shader uses `gl_VertexID` to produce oversized coordinates that cover the viewport.

---

## Implementation Steps

### Phase 1 — Scaffolding
1. `npm create vite@latest . -- --template react-ts`
2. Install dependencies: `npm i leva`
3. Clean out default Vite boilerplate

### Phase 2 — WebGL Core (`src/gl/`)
4. Write vertex shader string (fullscreen triangle via `gl_VertexID`)
5. Write fragment shader string (simplex noise + dual-palette gradient sampling + blend)
6. `setup.ts` — compile shaders, link program, create empty VAO
7. `uniforms.ts` — helper to cache and set uniform locations

### Phase 3 — Palettes (`src/palettes.ts`)
8. Define all 8 palettes as typed arrays
9. Pad/normalize helper functions
10. Lerp state machine (current, target, blend factor, snapshot on switch)

### Phase 4 — React Components
11. `ShaderCanvas.tsx` — canvas ref, WebGL init, ResizeObserver, rAF loop
12. `App.tsx` — layout wrapper, Leva `useControls` for dropdown + sliders, pass values to ShaderCanvas
13. `App.css` — centering, dark background

### Phase 5 — Polish
14. Ensure smooth lerp transitions
15. Handle edge cases: context loss, resize debounce
16. Test all 8 palette selections

### Future
- **Time-of-day auto-switch**: Map local clock hour to a palette (e.g. dawn → C, midday → A, dusk → F, night → E) and auto-rotate with manual override via Leva.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Raw WebGL, no Three.js | Keeps bundle small, only one quad + one shader — no need for a full 3D engine |
| Simplex noise in GLSL | Avoids texture lookups; runs entirely on GPU; Ashima/webgl-noise is public domain |
| Uniforms for palette data | Palettes are small (≤8 stops × RGB); uniform arrays are the simplest approach — no texture indirection needed |
| Fullscreen triangle (3 verts) | More efficient than a quad (avoids diagonal overdraw); standard technique |
| TypeScript | Type safety for palette definitions and uniform interfaces |

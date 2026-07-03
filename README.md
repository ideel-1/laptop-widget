# laptop-widget

A **procedural 3D MacBook-style laptop** for React — orbitable WebGL built
entirely from three.js geometry (no model files), showing a **live browsable
website** on its screen. Custom body color, draggable lid stickers, and a
laptop-in-laptop easter egg when it shows its own page.

## Installation

Install laptop-widget and its three.js peers via npm:

```bash
npm install laptop-widget three @react-three/fiber@8 @react-three/drei@9
```

Or just tell your agent to set it up:

```
Install laptop-widget (npm install laptop-widget three @react-three/fiber@8
@react-three/drei@9). Render <LaptopCanvas /> from "laptop-widget" inside a
sized container (it fills 100% of its parent).
```

If installing manually, drop the component into any page:

```tsx
import { LaptopCanvas } from "laptop-widget";

export default function LaptopSection() {
  return (
    <div style={{ height: 640 }}>
      <LaptopCanvas />
    </div>
  );
}
```

That's it. By default the screen loads **the page embedding it** (`"self"`),
with a little browser URL bar rendered inside the screen — visitors can type
any URL onto the laptop. Drag to orbit.

## Customize (color, stickers)

Run the **editor** on localhost — it never ships to production:

```tsx
import { LaptopEditor } from "laptop-widget/editor";

export default function EditorPage() {
  return (
    <div style={{ height: "100vh" }}>
      <LaptopEditor />
    </div>
  );
}
```

Pick a body color (every aluminum shade derives from it), add sticker images
(inlined as data-URIs, auto-resized to ≤512px), drag them around the lid,
then **Copy config JSON** and render the result in the page you ship:

```tsx
import { LaptopCanvas } from "laptop-widget";
import config from "./laptop.config.json";

<LaptopCanvas {...config} />
```

Because the editor lives at `laptop-widget/editor`, pages that don't import
it never bundle it.

## Props (`LaptopCanvas`)

| prop | default | |
| --- | --- | --- |
| `color` | `"#c8ccd2"` | base aluminum color — lid, deck, divot all derive from it |
| `stickers` | `[]` | `{ image, x, y, rotation?, scale? }[]` on the lid's outer face |
| `screenUrl` | `"self"` | URL on the screen, `"self"` for the embedding page, `null` for the animated wallpaper |
| `urlBar` | `true` | browser-style URL bar inside the screen |
| `camera` | `[0.55, 0.42, 0.95]` | start camera; `?cam=x,y,z` in the page URL overrides |
| `interactive` | auto | orbit controls (off inside a laptop screen) |
| `background` | `"#0c0d0f"` | canvas background, or `"transparent"` |

`<Laptop />` (same visual props, no stage) is exported for existing
react-three-fiber canvases.

## The recursion

When the laptop shows its own page, the inner page renders a laptop too. The
widget stamps `laptop_embed=<depth>` on the URL it loads: depth 1 renders live
with no URL bar, depth 2 renders a static wallpaper laptop — so the
mise-en-abyme terminates after two levels instead of melting the GPU.

## Caveats

- Sites that send `X-Frame-Options: DENY` / CSP `frame-ancestors` won't load
  in the screen iframe (google.com etc.). Your own pages will (same origin).
- The screen iframe swallows pointer events over it — orbit by dragging
  anywhere else. That's what makes the page actually browsable; keep it.
- three peer is pinned `<0.179` (three-bvh-csg 0.0.17).

---

## Development (this repo)

```bash
npm install
npm run dev        # demo site on http://localhost:5183
npm run build:lib  # package build → dist/
```

Demo routes (hash): `#mac` wallpaper · `#web` live screen (shows this page —
the recursion demo) · `#custom` color + stickers showcase · `#editor` the
editor. URL params: `?embed` hides chrome · `?cam=x,y,z` start camera.

Screenshot (chromium, avoids the Firefox-already-open MCP conflict):

```bash
node scripts/shot.mjs "http://localhost:5183/#mac" /tmp/mb.png [waitMs]
```

## What makes it read as a MacBook (deliberate cues)

- **No Apple logo** anywhere, and no model-name print — clean bezel.
- **Front thumb divot** — the base is ONE slab (a single plane, like the real
  machine); a rounded box tilted 45° is CSG-subtracted (`three-bvh-csg`) so one
  flat face chamfers the top-front lip. The cut faces stay a separate material
  group shaded much darker/rougher — a recess must read shadowed, or it looks
  like a chrome pill glued on (tried, rejected — as were a two-stacked-slabs
  approach and an axis-aligned cutter that shelved deep into the deck).
- **Sleek thin slabs** — large plan-view corner radii via `ExtrudeGeometry`
  (RoundedBoxGeometry can't do plan radius > half the slab height), small
  bevels, no hard edges.
- **All-screen lid** — edge-to-edge glass slab; content runs to a hairline
  black border (~4mm top/sides, slightly larger chin).
- **Screen tucks behind the deck** — the hinge sits low and at the very back,
  so the open lid emerges from behind the base almost level with it, not
  perched on top of the deck.
- **Camera notch** top-center, same glossy glass as the panel (it reflects
  like the screen), floating a hair in front of the screen plane so it
  occludes both the CanvasTexture and the iframe (`occlude="blending"`); the
  camera dot is a separate darker element inside it.
- **Keys sit sunken into the deck**, tops barely proud of the aluminum.
- **Huge trackpad** flush with the deck, hairline seam plate beneath it.
- Mac ANSI keyboard: half-height function row, inverted-T half-height arrows,
  stacked shift-symbol legends, words on modifiers. Legends are one canvas
  texture on a plane floating above the caps (InstancedMesh shares UVs).

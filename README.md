# macbook-3d

A **procedural MacBook** — orbitable WebGL, built entirely from three.js geometry
(no model files), that can display a **live browsable website** on its screen.

Paradigm ported from `~/Documents/Kova/Websites/operator-terminal-3d` (the rugged
field terminal whose `/#web` route iframes a real page onto the screen plane).

**End goal:** the last section of the portfolio site, right before the footer —
a MacBook showing a website, where visitors can click around and load other
sites on the small screen.

## Run

```bash
npm install
npm run dev      # http://localhost:5183
```

Routes (hash): `#mac` (animated wallpaper placeholder) · `#web` (live iframe + URL bar).

URL params: `?embed` hides all chrome (for iframing the scene into another page) ·
`?cam=x,y,z` sets the start camera (e.g. `?cam=0,0.14,0.62`).

## Screenshot (chromium, avoids the Firefox-already-open MCP conflict)

```bash
node scripts/shot.mjs "http://localhost:5183/#mac" /tmp/mb.png
```

## What makes it read as a MacBook (deliberate cues)

- **No Apple logo** anywhere.
- **Front thumb scoop** — real geometry: the base is TWO stacked extruded slabs
  (bottom case + top case, like the real parting line); the crescent notch is
  carved only into the top slab's front edge, so the bottom silhouette stays a
  straight line. Carving it through the full height reads as a bent slab — tried,
  rejected.
- **Sleek thin slabs** — large plan-view corner radii via `ExtrudeGeometry`
  (RoundedBoxGeometry can't do plan radius > half the slab height), small bevels,
  no hard edges.
- **All-screen lid** — edge-to-edge glass slab, hairline uniform bezel,
  "MacBook Air" print on the chin.
- **Camera notch** top-center, a mesh floating just in front of the screen plane
  so it occludes both the CanvasTexture and the iframe (`occlude="blending"`).
- **Huge trackpad** flush with the deck, hairline seam plate beneath it.
- Mac ANSI keyboard: half-height function row, inverted-T half-height arrows,
  stacked shift-symbol legends, words on modifiers. Legends are one canvas
  texture on a plane floating above the caps (InstancedMesh shares UVs).

## Caveats

- Sites that send `X-Frame-Options: DENY` / CSP `frame-ancestors` won't load in
  the screen iframe (google.com etc.). example.com works; the portfolio's own
  pages will too (same origin).
- The screen iframe swallows pointer events over it — orbit by dragging anywhere
  else. That's what makes the page actually browsable, keep it.

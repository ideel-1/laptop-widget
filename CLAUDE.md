# laptop-widget (repo dir: macbook-3d)

Vite + React 18 + TS + three/@react-three/fiber/drei. Procedural MacBook (no model
files) with a live-iframe screen, published as the **`laptop-widget` npm package**
(remote `github-personal:ideel-1/laptop-widget`). Port **5183**. Read `README.md`
first — it carries install/props/editor docs, the design cues, demo routes
(`#mac`/`#web`/`#custom`/`#editor`), URL params (`?embed`, `?cam=x,y,z`) and caveats.

Provenance: paradigm ported from `~/Documents/Kova/Websites/operator-terminal-3d`
(rugged terminal, `/#web`). End goal: bottom-of-portfolio section before the footer,
importable on any site.

## Architecture

- `src/lib/` — the published package. `Laptop.tsx` = the machine (dimensions are
  consts up top; scale: 1 unit ≈ 608 mm; machine 0.5 wide, sits on y=0) + color
  derivation + sticker Decals + in-screen URL bar. `LaptopCanvas.tsx` = the
  batteries-included stage (camera/orbit, Lightformer env, reflective floor,
  contact shadow). `embed.ts` = `laptop_embed` recursion depth (0 bar+live,
  1 live no bar, 2 static wallpaper). `editor/` → `laptop-widget/editor` entry.
- `src/demo/` — the dev/demo site (routes above).
- Builds: `npm run build:lib` → `dist/` (package, vite.lib.config.ts);
  `npm run build` → `site/` (demo). NEVER let both write the same dir.

## Library gotchas

- **Sticker decals**: chirality can't be fixed by the Decal euler (projection is
  line-symmetric — any yaw ≡ an in-plane spin, we proved it by screenshot);
  the pixels themselves are mirrored via canvas in `StickerDecal`.
- **The live screen's `<Html>` iframe floats over the canvas DOM** and swallows
  pointer events even when the screen faces away — the editor renders
  `screenUrl={null}` so the lid stays draggable.
- Editor drag plane needs `side: DoubleSide` or the raycaster backface-culls it
  from the behind-the-lid camera.
- Lid back reads dark for every color at low camera angles (metal reflects the
  dark floor); the editor compensates with a behind-camera directionalLight
  (metal specular is tinted by base color) + a raised default camera.

## Hard-won gotchas

- **Slab shapes**: plan-view corner radius must come from `ExtrudeGeometry` on a
  rounded-rect `THREE.Shape` — RoundedBoxGeometry caps radius at half the smallest
  dimension (useless for thin slabs). `slabGeometry()` handles the rotate/translate
  (shape Y mirrors to −Z; front edge = shape y = −d/2).
- **The front divot is a CSG subtraction** (`three-bvh-csg@0.0.17` — 0.0.18 needs
  three>=0.179): a rounded box tilted 45° so one FLAT face chamfers the top-front
  lip of the SINGLE base slab (reach along deck and front face = SCOOP_BITE·√2
  each — it must hug the edge, never shelve toward the trackpad). Radu-rejected
  alternatives: full-height shape notch (bends the silhouette into a wave), two
  stacked slabs (reads as two horizontal planes), axis-aligned cutter whose flat
  bottom shelves deep into the deck. The cut faces are material group 1 — shade
  them MUCH darker/rougher (`aluScoop`) or the up-tilted facet catches the key
  light + env and reads as a bright convex pill glued onto the edge.
- **Key legends**: InstancedMesh shares UVs → legends are ONE canvas texture on a
  transparent plane floating 0.0003 above the caps, positions computed from the same
  `computeKeys()` data as the instances.
- Screen plane roughness 0.45 — glossier leaves a flashlight-like specular dot from
  the key light mid-screen.
- Hinge is LOW (0.45·BASE_H) and at the very back — the lid must tuck behind the
  deck edge, not perch on top of it. Keys sink into the deck (tops +0.0012 over it).
- Verify by LOOK: `node scripts/shot.mjs <url> <out.png>` (chromium via
  ~/pw-test/node_modules/playwright-core — avoids the Firefox-already-open MCP trap).

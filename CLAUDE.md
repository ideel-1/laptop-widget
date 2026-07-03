# macbook-3d

Vite + React 18 + TS + three/@react-three/fiber/drei. Procedural MacBook (no model
files) with a live-iframe screen. Port **5183**. Read `README.md` first — it carries
the design cues, routes (`#mac`/`#web`), URL params (`?embed`, `?cam=x,y,z`) and caveats.

Provenance: paradigm ported from `~/Documents/Kova/Websites/operator-terminal-3d`
(rugged terminal, `/#web`). End goal: bottom-of-portfolio section before the footer.

## Architecture

- `src/Scene.tsx` — shared shell: camera/orbit, Lightformer env, reflective floor,
  contact shadow, animated wallpaper CanvasTexture. Machine-agnostic.
- `src/Macbook.tsx` — the machine. All dimensions are consts up top
  (scale: 1 unit ≈ 608 mm; machine 0.5 wide, sits on y=0).
- Screen contract: `Macbook({ screenTexture, screenUrl? })` — texture plane by
  default, `<Html transform occlude="blending">` iframe when `screenUrl` is set.

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

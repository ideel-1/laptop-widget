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
- **The scoop must NOT cut the full base height** — that bends the whole silhouette
  into a wave. Two stacked slabs, notch only in the top one; the seam doubles as the
  real machine's parting line.
- **Key legends**: InstancedMesh shares UVs → legends are ONE canvas texture on a
  transparent plane floating 0.0003 above the caps, positions computed from the same
  `computeKeys()` data as the instances.
- Screen plane roughness 0.45 — glossier leaves a flashlight-like specular dot from
  the key light mid-screen.
- Verify by LOOK: `node scripts/shot.mjs <url> <out.png>` (chromium via
  ~/pw-test/node_modules/playwright-core — avoids the Firefox-already-open MCP trap).

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Decal, Html, useTexture } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { laptopEmbedDepth, resolveScreenSrc } from "./embed";
import type { LaptopSticker } from "./types";

/**
 * PROCEDURAL MACBOOK — code-built, no model files.
 *
 * Paradigm ported from operator-terminal-3d's TerminalProcedural: a hinged
 * two-slab machine whose screen is either a live CanvasTexture or (via
 * `screenUrl`) a real browsable iframe CSS3D-mapped onto the screen plane.
 *
 * The MacBook cues that matter (per the reference shots):
 *  - NO logo anywhere
 *  - the thumb scoop (divot) in the front edge of the base, real geometry
 *  - sleek thin slabs, big plan-view corner radii, no rough edges
 *  - all-screen lid: hairline bezel, glass edge-to-edge
 *  - camera notch top-center, hanging into the screen
 *  - huge trackpad
 *
 * Public contract: `<Laptop color? stickers? screenUrl? urlBar? />` —
 * machine sits on y=0, ~0.5 units wide, centered. Must live inside an R3F
 * <Canvas>; `<LaptopCanvas>` provides the batteries-included stage.
 * Scale: 1 world unit ≈ 608mm (Air is 304mm wide → 0.50).
 */

// ---------------- dimensions ----------------
const BASE_W = 0.5;
const BASE_D = 0.353;
const BASE_H = 0.0125;
const PLAN_R = 0.014; // plan-view corner radius of both slabs

const LID_W = 0.5;
const LID_L = 0.345;
const LID_T = 0.0062;
const LID_ANGLE = -(Math.PI / 2 + 0.17); // open ~100°

const FOOT_H = 0.0012;
// hinge sits low and at the very back: the lid tucks BEHIND the deck edge,
// emerging level with the base rather than perched on top of it
const HINGE_Z = -BASE_D / 2 - 0.002;
const HINGE_Y = FOOT_H + BASE_H * 0.45;

// front thumb divot — a 45°-tilted rounded box CSG-subtracted from the
// top-front edge of the ONE base slab: a shallow chamfer hugging the lip
const SCOOP_W = 0.056; // divot length along the edge
const SCOOP_R = 0.005; // end rounding of the cutter = rounded divot ends
const SCOOP_BITE = 0.0016; // perpendicular penetration of the chamfer face

// screen — hairline black border: 4mm-ish top/sides, slightly larger chin
const GLASS_W = 0.488;
const GLASS_L = 0.334;
const SCREEN_W = GLASS_W - 2 * 0.004;
const SCREEN_H = GLASS_L - 0.004 - 0.009;
const SCREEN_Z = LID_L / 2; // center of the glass on the lid
const SCREEN_CZ = SCREEN_Z + (0.009 - 0.004) / 2; // content shifted up: chin > top
const NOTCH_W = 0.052;
const NOTCH_D = 0.0078;

// keyboard
const U = 0.0315; // key pitch
const GAP = 0.004;
const FN_U = 0.58; // function-row depth in U
const KEY_H = 0.0028;
const KEY_R = 0.0016;
const FIELD_W = 14.5 * U;
const FIELD_D = (FN_U + 5) * U;
const KB_BACK_Z = -0.163;
const KB_CENTER_Z = KB_BACK_Z + FIELD_D / 2;

// trackpad
const TP_W = 0.212;
const TP_D = 0.135;
const TP_Z = 0.0865;

// live-webpage screen: iframe CSS3D-transformed onto the screen plane
const WEB_W = 1024;
const WEB_H = Math.round((WEB_W * SCREEN_H) / SCREEN_W);

// ---------------- geometry helpers ----------------

function roundedRectPath(shape: THREE.Shape, w: number, d: number, r: number) {
  const x = -w / 2;
  const y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Flat slab: footprint w×d in XZ (plan corner radius r), thickness t along Y, centered on origin. */
function slabGeometry(w: number, d: number, t: number, r: number, bevel: number) {
  const shape = roundedRectPath(new THREE.Shape(), w, d, r);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: t - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geom.rotateX(-Math.PI / 2); // shape XY → world XZ, extrusion → +Y
  geom.translate(0, -(t / 2 - bevel), 0);
  return geom;
}

/**
 * The base: ONE slab, with the thumb divot boolean-subtracted from the
 * top-front edge. The cutter is a rounded box tilted 45° so one flat face
 * chamfers the lip — a shallow angled facet with rounded ends that stays at
 * the edge instead of reaching into the deck.
 */
function baseGeometry() {
  const slab = slabGeometry(BASE_W, BASE_D, BASE_H, PLAN_R, 0.0014);
  const cutterSize = 0.04;
  const cutter = new RoundedBoxGeometry(SCOOP_W, cutterSize, cutterSize, 5, SCOOP_R);
  const a = new Brush(slab);
  const b = new Brush(cutter);
  // the box is tilted 45° so one flat face slopes across the lip corner,
  // sunk SCOOP_BITE perpendicular to that face — the divot hugs the edge
  // (reach along deck and down the front face = SCOOP_BITE·√2 each) instead
  // of shelving flat into the deck toward the trackpad
  const d = cutterSize / 2 - SCOOP_BITE;
  b.rotation.x = Math.PI / 4;
  b.position.set(0, BASE_H / 2 + d / Math.SQRT2, BASE_D / 2 + d / Math.SQRT2);
  b.updateMatrixWorld();
  // keep the cut faces as material group 1, so the concave scoop can be shaded
  // darker than the slab — a recess must read shadowed, not specular
  return new Evaluator().evaluate(a, b, SUBTRACTION).geometry;
}

// ---------------- key layout ----------------
type KeyDef = { main: string; sub?: string; u: number; word?: boolean };
const k = (main: string, u = 1, sub?: string): KeyDef => ({ main, u, sub });
const w = (main: string, u = 1): KeyDef => ({ main, u, word: true });

const ROWS: KeyDef[][] = [
  [
    w("esc", 1.5), k("F1"), k("F2"), k("F3"), k("F4"), k("F5"), k("F6"),
    k("F7"), k("F8"), k("F9"), k("F10"), k("F11"), k("F12"), k("", 1), // Touch ID: blank
  ],
  [
    k("`", 1, "~"), k("1", 1, "!"), k("2", 1, "@"), k("3", 1, "#"), k("4", 1, "$"),
    k("5", 1, "%"), k("6", 1, "^"), k("7", 1, "&"), k("8", 1, "*"), k("9", 1, "("),
    k("0", 1, ")"), k("-", 1, "_"), k("=", 1, "+"), w("delete", 1.5),
  ],
  [
    w("tab", 1.5), k("Q"), k("W"), k("E"), k("R"), k("T"), k("Y"), k("U"),
    k("I"), k("O"), k("P"), k("[", 1, "{"), k("]", 1, "}"), k("\\", 1, "|"),
  ],
  [
    w("caps lock", 1.75), k("A"), k("S"), k("D"), k("F"), k("G"), k("H"),
    k("J"), k("K"), k("L"), k(";", 1, ":"), k("'", 1, "\""), w("return", 1.75),
  ],
  [
    w("shift", 2.25), k("Z"), k("X"), k("C"), k("V"), k("B"), k("N"), k("M"),
    k(",", 1, "<"), k(".", 1, ">"), k("/", 1, "?"), w("shift", 2.25),
  ],
  [
    w("fn"), w("control"), w("option"), w("command", 1.25), k("", 5),
    w("command", 1.25), w("option"),
    // remaining 3U = arrow cluster, appended in computeKeys
  ],
];

type KeyInfo = {
  x: number;
  z: number;
  w: number;
  d: number;
  main: string;
  sub?: string;
  word?: boolean;
};

function computeKeys(): KeyInfo[] {
  const keys: KeyInfo[] = [];
  const fnD = FN_U * U;
  ROWS.forEach((row, i) => {
    const rowZ = i === 0 ? KB_BACK_Z + fnD / 2 : KB_BACK_Z + fnD + (i - 0.5) * U;
    const rowD = (i === 0 ? fnD : U) - GAP;
    let cursor = -FIELD_W / 2;
    for (const key of row) {
      keys.push({
        x: cursor + (key.u * U) / 2,
        z: rowZ,
        w: key.u * U - GAP,
        d: rowD,
        main: key.main,
        sub: key.sub,
        word: key.word,
      });
      cursor += key.u * U;
    }
    if (i === 5) {
      // arrow cluster: inverted T of half-height keys in the last 3U
      const hd = (U - GAP) / 2 - 0.0008;
      const zTop = rowZ - (U - GAP) / 4 - 0.0004;
      const zBot = rowZ + (U - GAP) / 4 + 0.0004;
      const cell = (n: number) => cursor + (n + 0.5) * U;
      keys.push({ x: cell(0), z: zBot, w: U - GAP, d: hd, main: "◀" });
      keys.push({ x: cell(1), z: zTop, w: U - GAP, d: hd, main: "▲" });
      keys.push({ x: cell(1), z: zBot, w: U - GAP, d: hd, main: "▼" });
      keys.push({ x: cell(2), z: zBot, w: U - GAP, d: hd, main: "▶" });
    }
  });
  return keys;
}

// legends drawn on a transparent plane floating just above the keycap tops —
// InstancedMesh shares UVs, so per-key top textures aren't possible without shaders
function buildLegendTexture(keys: KeyInfo[]) {
  const cw = 2048;
  const ch = Math.round((cw * FIELD_D) / FIELD_W);
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, cw, ch);
  const s = cw / FIELD_W;
  g.textAlign = "center";
  g.fillStyle = "#c9cbce"; // backlit white
  for (const key of keys) {
    if (!key.main) continue;
    const px = (key.x + FIELD_W / 2) * s;
    const py = (key.z - KB_BACK_Z) * s;
    if (key.word) {
      g.textBaseline = "middle";
      g.font = `500 ${key.main.length > 6 ? 20 : 23}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(key.main, px, py + (key.d * s) / 2 - 26);
    } else if (key.sub) {
      g.textBaseline = "middle";
      g.font = `500 27px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(key.sub, px, py - key.d * s * 0.22);
      g.fillText(key.main, px, py + key.d * s * 0.24);
    } else if (key.main.startsWith("F") && key.main.length > 1) {
      g.textBaseline = "middle";
      g.font = `500 22px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(key.main, px, py);
    } else if ("▲▼◀▶".includes(key.main)) {
      g.textBaseline = "middle";
      g.font = `500 18px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(key.main, px, py);
    } else {
      g.textBaseline = "middle";
      g.font = `500 44px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(key.main, px, py + 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// fine sandblasted-anodized grain, shared as roughness+bump map
function buildNoiseTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + Math.random() * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

// ---------------- wallpaper (fallback screen) ----------------
// slow-drifting abstract wallpaper — ribbons of teal/ice light on deep ink,
// in the family of Apple's press-shot swirl
function drawWallpaper(ctx: CanvasRenderingContext2D, t: number) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#07090d");
  bg.addColorStop(0.55, "#0a1218");
  bg.addColorStop(1, "#0b161d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const colors = [
    "rgba(45, 155, 165, 0.34)",
    "rgba(110, 190, 210, 0.26)",
    "rgba(210, 230, 238, 0.20)",
    "rgba(30, 110, 130, 0.30)",
    "rgba(160, 215, 225, 0.16)",
  ];
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < colors.length; i++) {
    const ph = t * 0.12 + i * 1.7;
    const y0 = h * (0.2 + 0.13 * i) + Math.sin(ph) * 40;
    ctx.strokeStyle = colors[i];
    ctx.lineWidth = 70 + 28 * Math.sin(ph * 0.7 + i);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-120, y0 + Math.sin(ph * 1.3) * 60);
    ctx.bezierCurveTo(
      w * 0.3, y0 - 180 + Math.cos(ph) * 70,
      w * 0.62, y0 + 190 + Math.sin(ph * 0.8) * 80,
      w + 120, y0 - 60 + Math.cos(ph * 1.1) * 50
    );
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // subtle vignette so the panel reads as glass, not a sticker
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function useWallpaperTexture(live: boolean) {
  const { ctx, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 666;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { ctx: canvas.getContext("2d")!, tex };
  }, []);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (live) return; // wallpaper hidden behind the iframe — skip the 2D work
    clock.current += dt;
    drawWallpaper(ctx, clock.current);
    tex.needsUpdate = true;
  });
  return tex;
}

// ---------------- stickers ----------------
// a Decal projected onto the lid's outer (+Y local) face; lives as a child of
// the lid shell mesh. Position is mesh-local: the shell is centered at
// z = LID_L/2, so a sticker's hinge-relative y maps to z = y − LID_L/2.
function StickerDecal({ sticker }: { sticker: LaptopSticker }) {
  const raw = useTexture(sticker.image);
  // chirality can't come from the decal's euler (projection is line-symmetric,
  // so any yaw ≡ an in-plane spin) — mirror the pixels themselves
  const tex = useMemo(() => {
    const img = raw.image as HTMLImageElement | HTMLCanvasElement;
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.translate(img.width, 0);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [raw]);
  const s = sticker.scale ?? 0.06;
  const aspect =
    tex.image && tex.image.width ? tex.image.height / tex.image.width : 1;
  return (
    <Decal
      position={[sticker.x, LID_T / 2, sticker.y - LID_L / 2]}
      // π yaw projects from the far side, which mirrors the art so it reads
      // correctly from outside the lid (a texture-matrix flip is ignored here)
      rotation={[-Math.PI / 2, Math.PI, Math.PI + (sticker.rotation ?? 0)]}
      scale={[s, s * aspect, 0.01]}
    >
      <meshStandardMaterial
        map={tex}
        transparent
        polygonOffset
        polygonOffsetFactor={-4}
        roughness={0.6}
        metalness={0}
        // printed-vinyl lift — the lid back sits in the scene's shadow side
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.32}
      />
    </Decal>
  );
}

/**
 * lid frame, exported for the editor: stickers live on the plane
 * y = LID_T/2 of a group at (0, HINGE_Y, HINGE_Z) rotated LID_ANGLE about X,
 * spanning x ∈ ±LID_W/2, z ∈ 0..LID_L (z here = the sticker's `y`).
 */
export const LID_FRAME = {
  hingeY: HINGE_Y,
  hingeZ: HINGE_Z,
  angle: LID_ANGLE,
  width: LID_W,
  length: LID_L,
  thickness: LID_T,
};

// in-screen browser bar height, in iframe CSS px (the screen is WEB_W wide)
const BAR_H = 46;

export type LaptopProps = {
  /** base aluminum color; all alu shades derive from it. Default silver */
  color?: string;
  /** stickers on the lid's outer face */
  stickers?: LaptopSticker[];
  /** URL on the screen, "self" for the embedding page, null for wallpaper */
  screenUrl?: string | null;
  /** browser-style URL bar inside the screen (depth 0 only). Default true */
  urlBar?: boolean;
};

export function Laptop({
  color = "#c8ccd2",
  stickers = [],
  screenUrl = "self",
  urlBar = true,
}: LaptopProps) {
  const keys = useMemo(computeKeys, []);
  const legendTex = useMemo(() => buildLegendTexture(keys), [keys]);
  const noiseTex = useMemo(buildNoiseTexture, []);

  // recursion: depth 0 = normal page, 1 = inside a laptop screen (live, no
  // bar), 2+ = static wallpaper, terminating the laptop-in-laptop nesting
  const depth = useMemo(laptopEmbedDepth, []);
  const live = screenUrl != null && depth < 2;
  const showBar = live && urlBar && depth === 0;
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const src = useMemo(
    () => (live ? resolveScreenSrc(currentUrl ?? screenUrl!, depth) : null),
    [live, currentUrl, screenUrl, depth]
  );
  const [barInput, setBarInput] = useState<string | null>(null);

  const screenTexture = useWallpaperTexture(live);

  const mats = useMemo(() => {
    // every aluminum shade derives from the base color so a pink or black
    // machine keeps the shading relationships (scoop darker than deck, etc.)
    const base = new THREE.Color(color);
    const shade = (k: number) => base.clone().multiplyScalar(k);
    const alu = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.42,
      metalness: 0.85,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.03,
      envMapIntensity: 1.1,
    });
    const aluLid = alu.clone();
    aluLid.color = shade(0.98);
    const aluScoop = alu.clone();
    aluScoop.color = shade(0.545);
    aluScoop.roughness = 0.85;
    aluScoop.envMapIntensity = 0.15;
    const trackpad = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.32,
      metalness: 0.8,
      envMapIntensity: 1.05,
    });
    const tpLine = new THREE.MeshStandardMaterial({
      color: shade(0.565),
      roughness: 0.5,
      metalness: 0.6,
    });
    const key = new THREE.MeshStandardMaterial({
      color: "#1b1c1e",
      roughness: 0.62,
      metalness: 0.05,
    });
    const well = new THREE.MeshStandardMaterial({
      color: "#0e0f11",
      roughness: 0.7,
      metalness: 0.1,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: "#050708",
      roughness: 0.12,
      metalness: 0.3,
      envMapIntensity: 1.2,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: "#101113",
      roughness: 0.6,
      metalness: 0.3,
    });
    const foot = new THREE.MeshStandardMaterial({
      color: "#26272a",
      roughness: 0.85,
      metalness: 0,
    });
    return { alu, aluLid, aluScoop, trackpad, tpLine, key, well, glass, dark, foot };
  }, [noiseTex, color]);

  const geoms = useMemo(
    () => ({
      base: baseGeometry(),
      lid: slabGeometry(LID_W, LID_L, LID_T, PLAN_R, 0.0015),
      glass: slabGeometry(GLASS_W, GLASS_L, 0.0016, 0.01, 0.0004),
      wellPlate: slabGeometry(FIELD_W + 0.007, FIELD_D + 0.006, 0.0008, 0.0035, 0.0002),
      trackpad: slabGeometry(TP_W, TP_D, 0.0012, 0.005, 0.0003),
      tpLine: slabGeometry(TP_W + 0.0016, TP_D + 0.0016, 0.0008, 0.0055, 0.0002),
      notch: slabGeometry(NOTCH_W, NOTCH_D, 0.0008, 0.0028, 0.0002),
      keycap: new RoundedBoxGeometry(U - GAP, KEY_H, U - GAP, 2, KEY_R),
    }),
    []
  );

  const keysRef = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const deckTop = FOOT_H + BASE_H;
    keys.forEach((key, i) => {
      // caps sit sunken into the deck — tops barely proud of the aluminum
      p.set(key.x, deckTop + 0.0012 - KEY_H / 2, key.z);
      s.set(key.w / (U - GAP), 1, key.d / (U - GAP));
      m.compose(p, q, s);
      keysRef.current.setMatrixAt(i, m);
    });
    keysRef.current.instanceMatrix.needsUpdate = true;
  }, [keys]);

  const deckTop = FOOT_H + BASE_H;

  return (
    <group>
      {/* ---------------- base: one slab, divot subtracted ----------------
          group 0 = slab faces, group 1 = the scoop's concave cut surface */}
      <mesh
        position={[0, FOOT_H + BASE_H / 2, 0]}
        geometry={geoms.base}
        material={[mats.alu, mats.aluScoop]}
        castShadow
        receiveShadow
      />

      {/* feet */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz], i) => (
        <mesh
          key={i}
          position={[sx * 0.205, FOOT_H / 2, sz * 0.135]}
          material={mats.foot}
        >
          <cylinderGeometry args={[0.01, 0.01, FOOT_H, 20]} />
        </mesh>
      ))}

      {/* keyboard well */}
      <mesh
        position={[0, deckTop + 0.0002, KB_CENTER_Z]}
        geometry={geoms.wellPlate}
        material={mats.well}
        receiveShadow
      />

      {/* keycaps */}
      <instancedMesh
        ref={keysRef}
        args={[geoms.keycap, mats.key, keys.length]}
        castShadow
        receiveShadow
      />

      {/* legends */}
      <mesh
        position={[0, deckTop + 0.0012 + 0.0003, KB_CENTER_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[FIELD_W, FIELD_D]} />
        <meshStandardMaterial map={legendTex} transparent alphaTest={0.05} roughness={1} />
      </mesh>

      {/* trackpad: hairline seam plate underneath, glass on top */}
      <mesh
        position={[0, deckTop + 0.0002, TP_Z]}
        geometry={geoms.tpLine}
        material={mats.tpLine}
      />
      <mesh
        position={[0, deckTop + 0.0007, TP_Z]}
        geometry={geoms.trackpad}
        material={mats.trackpad}
        receiveShadow
      />

      {/* ports — left: MagSafe + 2× USB-C; right: headphone jack */}
      {[-0.132, -0.104, -0.082].map((z, i) => (
        <mesh key={i} position={[-BASE_W / 2, FOOT_H + BASE_H / 2, z]} material={mats.dark}>
          <primitive
            object={new RoundedBoxGeometry(0.0012, i === 0 ? 0.0026 : 0.0036, i === 0 ? 0.014 : 0.011, 2, 0.0005)}
            attach="geometry"
          />
        </mesh>
      ))}
      <mesh
        position={[BASE_W / 2, FOOT_H + BASE_H / 2, -0.1]}
        rotation={[0, 0, Math.PI / 2]}
        material={mats.dark}
      >
        <cylinderGeometry args={[0.0024, 0.0024, 0.0012, 16]} />
      </mesh>

      {/* hinge shadow-gap barrel, mostly hidden between the slabs */}
      <mesh
        position={[0, HINGE_Y - 0.0012, HINGE_Z]}
        rotation={[0, 0, Math.PI / 2]}
        material={mats.dark}
      >
        <cylinderGeometry args={[0.0035, 0.0035, 0.32, 16]} />
      </mesh>

      {/* ---------------- lid ---------------- */}
      <group position={[0, HINGE_Y, HINGE_Z]} rotation={[LID_ANGLE, 0, 0]}>
        {/* lid shell — stickers project onto its outer (+Y local) face */}
        <mesh
          position={[0, 0, LID_L / 2]}
          geometry={geoms.lid}
          material={mats.aluLid}
          castShadow
          receiveShadow
        >
          <Suspense fallback={null}>
            {stickers.map((s, i) => (
              <StickerDecal key={`${s.image.slice(0, 32)}-${i}`} sticker={s} />
            ))}
          </Suspense>
        </mesh>

        {/* edge-to-edge glass on the inner face */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0008), SCREEN_Z]}
          geometry={geoms.glass}
          material={mats.glass}
        />

        {/* the screen itself */}
        {live && src ? (
          <>
            {/* dead glass behind the live page */}
            <mesh position={[0, -(LID_T / 2 + 0.0018), SCREEN_CZ]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              <meshStandardMaterial color="#0a0d10" roughness={0.4} metalness={0} />
            </mesh>
            <Html
              transform
              occlude="blending"
              distanceFactor={400}
              position={[0, -(LID_T / 2 + 0.0022), SCREEN_CZ]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={SCREEN_W / WEB_W}
              zIndexRange={[5, 0]}
            >
              <div
                style={{
                  width: WEB_W,
                  height: WEB_H,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "18px", // the panel's rounded corners
                  overflow: "hidden",
                  background: "#0e1114",
                }}
              >
                {showBar && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = (barInput ?? "").trim();
                      if (v) setCurrentUrl(v);
                    }}
                    style={{
                      height: BAR_H,
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0 12px",
                      background: "#16191d",
                      borderBottom: "1px solid #000",
                    }}
                  >
                    <span
                      style={{
                        width: 9, height: 9, borderRadius: "50%",
                        background: "#3a3f45", flex: "none",
                      }}
                    />
                    <input
                      value={barInput ?? src}
                      onChange={(e) => setBarInput(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      spellCheck={false}
                      style={{
                        flex: 1,
                        height: 28,
                        border: "1px solid #23272c",
                        borderRadius: 14,
                        background: "#0c0e11",
                        color: "#aeb6bf",
                        padding: "0 12px",
                        font: "13px/1 -apple-system, 'Helvetica Neue', sans-serif",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        height: 28,
                        border: 0,
                        borderRadius: 14,
                        padding: "0 12px",
                        background: "#23272c",
                        color: "#c6cdd5",
                        font: "12px/1 -apple-system, 'Helvetica Neue', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      Go
                    </button>
                  </form>
                )}
                <iframe
                  src={src}
                  width={WEB_W}
                  height={showBar ? WEB_H - BAR_H : WEB_H}
                  style={{
                    border: "0",
                    background: "#0e1114",
                    display: "block",
                    flex: 1,
                  }}
                  title="laptop screen"
                />
              </div>
            </Html>
          </>
        ) : (
          <mesh position={[0, -(LID_T / 2 + 0.0018), SCREEN_CZ]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SCREEN_W, SCREEN_H]} />
            <meshStandardMaterial
              map={screenTexture}
              emissiveMap={screenTexture}
              emissive="#ffffff"
              emissiveIntensity={1.05}
              roughness={0.45}
              metalness={0}
              toneMapped={false}
            />
          </mesh>
        )}

        {/* camera notch — same glass as the panel, embedded in the screen
            surface (it reflects like the screen does); floats a hair in front
            so it occludes both the texture and the live iframe */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0022), SCREEN_CZ + SCREEN_H / 2 - NOTCH_D / 2 + 0.0004]}
          geometry={geoms.notch}
          material={mats.glass}
        />
        {/* the camera dot itself, apart from the glass */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0028), SCREEN_CZ + SCREEN_H / 2 - NOTCH_D / 2 + 0.0004]}
        >
          <cylinderGeometry args={[0.0016, 0.0016, 0.0002, 16]} />
          <meshStandardMaterial color="#101722" roughness={0.15} metalness={0.5} />
        </mesh>

        {/* spill light: screen glow onto the deck */}
        <pointLight
          position={[0, -0.06, 0.17]}
          intensity={0.06}
          distance={0.5}
          decay={2}
          color="#bcd2e8"
        />
      </group>
    </group>
  );
}

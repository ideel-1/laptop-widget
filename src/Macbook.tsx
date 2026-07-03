import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

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
 * Contract (same as the terminal): `Macbook({ screenTexture, screenUrl? })`,
 * machine sits on y=0, ~0.5 units wide, centered.
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
const HINGE_Z = -BASE_D / 2 + 0.007;
const HINGE_Y = FOOT_H + BASE_H + 0.0006;

// front thumb scoop — carved only into the TOP half of the base, so the
// bottom silhouette stays a straight line (that's how the real one reads)
const SCOOP_HALF_W = 0.05;
const SCOOP_DEPTH = 0.0045;
const BASE_TOP_H = BASE_H * 0.5;
const BASE_BOT_H = BASE_H - BASE_TOP_H;

// screen
const SCREEN_W = 0.474;
const SCREEN_H = 0.308;
const GLASS_W = 0.488;
const GLASS_L = 0.334;
const SCREEN_Z = LID_L / 2; // center of glass + screen on the lid
const NOTCH_W = 0.052;
const NOTCH_D = 0.0078;
const BEZEL_TEXT = "MacBook Air";

// keyboard
const U = 0.0295; // key pitch
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
const TP_Z = 0.0795;

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

/** One base slab; `notch` carves the thumb scoop into the front edge (+Z). */
function baseSlabGeometry(t: number, notch: boolean) {
  const w = BASE_W;
  const d = BASE_D;
  const r = PLAN_R;
  const x = -w / 2;
  // shape-space: front edge (world +Z) is y = -d/2 (rotateX(-PI/2) mirrors Y→-Z)
  const y = -d / 2;

  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  if (notch) {
    const nw = SCOOP_HALF_W;
    const nd = SCOOP_DEPTH;
    const Rs = (nw * nw + nd * nd) / (2 * nd); // arc through (±nw, y) dipping to (0, y+nd)
    const yc = y + nd - Rs;
    const a0 = Math.atan2(y - yc, -nw);
    const a1 = Math.atan2(y - yc, nw);
    shape.lineTo(-nw, y);
    shape.absarc(0, yc, Rs, a0, a1, true); // the scoop
  }
  shape.lineTo(w / 2 - r, y);
  shape.quadraticCurveTo(w / 2, y, w / 2, y + r);
  shape.lineTo(w / 2, y + d - r);
  shape.quadraticCurveTo(w / 2, y + d, w / 2 - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const bevel = 0.0014;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: t - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, -(t / 2 - bevel), 0);
  return geom;
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

// "MacBook Air" print on the bottom bezel
function buildBezelTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 1024, 96);
  g.fillStyle = "rgba(190,193,198,0.85)";
  g.font = `500 44px "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(BEZEL_TEXT, 512, 50);
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

export function Macbook({
  screenTexture,
  screenUrl,
}: {
  screenTexture: THREE.Texture;
  screenUrl?: string;
}) {
  const keys = useMemo(computeKeys, []);
  const legendTex = useMemo(() => buildLegendTexture(keys), [keys]);
  const bezelTex = useMemo(buildBezelTexture, []);
  const noiseTex = useMemo(buildNoiseTexture, []);

  const mats = useMemo(() => {
    const alu = new THREE.MeshStandardMaterial({
      color: "#c8ccd2",
      roughness: 0.42,
      metalness: 0.85,
      roughnessMap: noiseTex,
      bumpMap: noiseTex,
      bumpScale: 0.03,
      envMapIntensity: 1.1,
    });
    const aluLid = alu.clone();
    aluLid.color = new THREE.Color("#c4c8ce");
    const trackpad = new THREE.MeshStandardMaterial({
      color: "#c8ccd2",
      roughness: 0.32,
      metalness: 0.8,
      envMapIntensity: 1.05,
    });
    const tpLine = new THREE.MeshStandardMaterial({
      color: "#71757c",
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
    const notch = new THREE.MeshStandardMaterial({
      color: "#050506",
      roughness: 0.35,
      metalness: 0,
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
    return { alu, aluLid, trackpad, tpLine, key, well, glass, notch, dark, foot };
  }, [noiseTex]);

  const geoms = useMemo(
    () => ({
      baseBot: baseSlabGeometry(BASE_BOT_H, false),
      baseTop: baseSlabGeometry(BASE_TOP_H, true),
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
      p.set(key.x, deckTop + 0.0006 + KEY_H / 2, key.z);
      s.set(key.w / (U - GAP), 1, key.d / (U - GAP));
      m.compose(p, q, s);
      keysRef.current.setMatrixAt(i, m);
    });
    keysRef.current.instanceMatrix.needsUpdate = true;
  }, [keys]);

  const deckTop = FOOT_H + BASE_H;

  return (
    <group>
      {/* ---------------- base: bottom case + notched top case ---------------- */}
      <mesh
        position={[0, FOOT_H + BASE_BOT_H / 2, 0]}
        geometry={geoms.baseBot}
        material={mats.alu}
        castShadow
        receiveShadow
      />
      <mesh
        position={[0, FOOT_H + BASE_BOT_H + BASE_TOP_H / 2, 0]}
        geometry={geoms.baseTop}
        material={mats.alu}
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
        position={[0, deckTop + 0.0006 + KEY_H + 0.0003, KB_CENTER_Z]}
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
        {/* lid shell */}
        <mesh
          position={[0, 0, LID_L / 2]}
          geometry={geoms.lid}
          material={mats.aluLid}
          castShadow
          receiveShadow
        />

        {/* edge-to-edge glass on the inner face */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0008), SCREEN_Z]}
          geometry={geoms.glass}
          material={mats.glass}
        />

        {/* the screen itself */}
        {screenUrl ? (
          <>
            {/* dead glass behind the live page */}
            <mesh position={[0, -(LID_T / 2 + 0.0018), SCREEN_Z]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[SCREEN_W, SCREEN_H]} />
              <meshStandardMaterial color="#0a0d10" roughness={0.4} metalness={0} />
            </mesh>
            <Html
              transform
              occlude="blending"
              distanceFactor={400}
              position={[0, -(LID_T / 2 + 0.0022), SCREEN_Z]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={SCREEN_W / WEB_W}
              zIndexRange={[5, 0]}
            >
              <iframe
                src={screenUrl}
                width={WEB_W}
                height={WEB_H}
                style={{
                  border: "0",
                  background: "#0e1114",
                  display: "block",
                  borderRadius: "18px", // the panel's rounded corners
                }}
                title="macbook screen"
              />
            </Html>
          </>
        ) : (
          <mesh position={[0, -(LID_T / 2 + 0.0018), SCREEN_Z]} rotation={[Math.PI / 2, 0, 0]}>
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

        {/* camera notch, hanging from the top bezel over the screen */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0026), SCREEN_Z + SCREEN_H / 2 - NOTCH_D / 2 + 0.0004]}
          geometry={geoms.notch}
          material={mats.notch}
        />
        {/* the camera dot itself */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0032), SCREEN_Z + SCREEN_H / 2 - NOTCH_D / 2 + 0.0004]}
        >
          <cylinderGeometry args={[0.0016, 0.0016, 0.0002, 16]} />
          <meshStandardMaterial color="#0d1117" roughness={0.2} metalness={0.4} />
        </mesh>

        {/* bottom-bezel print */}
        <mesh
          position={[0, -(LID_T / 2 + 0.0018), SCREEN_Z - SCREEN_H / 2 - 0.0062]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.096, 0.009]} />
          <meshStandardMaterial map={bezelTex} transparent alphaTest={0.05} roughness={1} />
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

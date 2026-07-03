import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { LaptopCanvas } from "../LaptopCanvas";
import { LID_FRAME } from "../Laptop";
import type { LaptopConfig, LaptopSticker } from "../types";

/**
 * LAPTOP EDITOR — the localhost-only customization surface. Pick a color,
 * drop sticker images in, drag them around the lid, then copy the config
 * JSON and pass it to <LaptopCanvas {...config} /> in the page you ship.
 * Import from "laptop-widget/editor" so none of this enters your bundle.
 */

const ACCENT = "#4c8dff";

// big uploads become bloated data-URIs — resize to a sane sticker resolution
function fileToStickerDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 512;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * invisible plane over the lid's outer face: drag stickers along it. Sits in
 * a group replicating the lid transform, so group-local x/z ARE the sticker's
 * config x/y.
 */
function LidDragSurface({
  stickers,
  selected,
  onSelect,
  onMove,
}: {
  stickers: LaptopSticker[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  onMove: (i: number, x: number, y: number) => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const dragging = useRef<number | null>(null);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;

  const localPoint = (e: ThreeEvent<PointerEvent>) => {
    const v = group.current.worldToLocal(e.point.clone());
    return {
      x: THREE.MathUtils.clamp(v.x, -LID_FRAME.width / 2, LID_FRAME.width / 2),
      y: THREE.MathUtils.clamp(v.z, 0, LID_FRAME.length),
    };
  };

  const down = (e: ThreeEvent<PointerEvent>) => {
    const p = localPoint(e);
    // nearest sticker whose footprint contains the hit
    let best: number | null = null;
    let bestD = Infinity;
    stickers.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < Math.max(0.02, (s.scale ?? 0.06) * 0.65) && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    onSelect(best);
    if (best != null) {
      dragging.current = best;
      if (controls) controls.enabled = false;
      e.stopPropagation();
    }
  };

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (dragging.current == null) return;
    const p = localPoint(e);
    onMove(dragging.current, p.x, p.y);
    e.stopPropagation();
  };

  const up = () => {
    dragging.current = null;
    if (controls) controls.enabled = true;
  };

  return (
    <group
      ref={group}
      position={[0, LID_FRAME.hingeY, LID_FRAME.hingeZ]}
      rotation={[LID_FRAME.angle, 0, 0]}
    >
      <mesh
        position={[0, LID_FRAME.thickness / 2 + 0.0005, LID_FRAME.length / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
      >
        <planeGeometry args={[LID_FRAME.width, LID_FRAME.length]} />
        {/* DoubleSide or the raycaster backface-culls it from behind the lid */}
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* selection ring */}
      {selected != null && stickers[selected] && (
        <mesh
          position={[
            stickers[selected].x,
            LID_FRAME.thickness / 2 + 0.001,
            stickers[selected].y,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry
            args={[
              ((stickers[selected].scale ?? 0.06) / 2) * 1.25,
              ((stickers[selected].scale ?? 0.06) / 2) * 1.25 + 0.0018,
              48,
            ]}
          />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

// ---------------- panel UI ----------------

const panel: CSSProperties = {
  width: 320,
  flex: "none",
  height: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  padding: "18px 18px 28px",
  background: "#101214",
  borderLeft: "1px solid #1e2126",
  color: "#c6cdd5",
  font: "13px/1.5 -apple-system, 'Helvetica Neue', sans-serif",
};
const h: CSSProperties = {
  margin: "22px 0 8px",
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7c848d",
};
const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 30,
  padding: "0 10px",
  border: "1px solid #23272c",
  borderRadius: 6,
  background: "#0c0e11",
  color: "#c6cdd5",
  font: "12px/1 ui-monospace, monospace",
  outline: "none",
};
const btn: CSSProperties = {
  height: 30,
  padding: "0 12px",
  border: "1px solid #2a2f35",
  borderRadius: 6,
  background: "#1a1e23",
  color: "#c6cdd5",
  font: "12px/1 -apple-system, 'Helvetica Neue', sans-serif",
  cursor: "pointer",
};

const PRESETS = [
  { name: "silver", value: "#c8ccd2" },
  { name: "space gray", value: "#8a8d93" },
  { name: "midnight", value: "#31353d" },
  { name: "pink", value: "#d9aebb" },
  { name: "sky", value: "#aac4d9" },
  { name: "gold", value: "#d6c6a8" },
];

export function LaptopEditor({
  initial,
  style,
}: {
  /** start from an existing config (paste back what you exported earlier) */
  initial?: LaptopConfig;
  style?: CSSProperties;
}) {
  const [color, setColor] = useState(initial?.color ?? "#c8ccd2");
  const [stickers, setStickers] = useState<LaptopSticker[]>(
    initial?.stickers ?? []
  );
  const [screenUrl, setScreenUrl] = useState<string>(
    initial?.screenUrl === null ? "" : (initial?.screenUrl ?? "self")
  );
  const [urlBar, setUrlBar] = useState(initial?.urlBar ?? true);
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const config: LaptopConfig = {
    color,
    stickers,
    screenUrl: screenUrl.trim() === "" ? null : screenUrl.trim(),
    urlBar,
  };
  const json = JSON.stringify(
    config,
    (_, v) =>
      typeof v === "number" ? Number(v.toFixed(4)) : (v as unknown),
    2
  );

  const addSticker = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const image = await fileToStickerDataUri(file);
    setStickers((s) => [
      ...s,
      { image, x: 0, y: LID_FRAME.length * 0.55, rotation: 0, scale: 0.07 },
    ]);
    setSelected(stickers.length);
    e.target.value = "";
  };

  const patch = useCallback(
    (i: number, p: Partial<LaptopSticker>) =>
      setStickers((s) => s.map((st, j) => (j === i ? { ...st, ...p } : st))),
    []
  );

  const sel = selected != null ? stickers[selected] : null;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#0c0d0f",
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        <LaptopCanvas
          {...config}
          // wallpaper while editing: the live screen's <Html> iframe floats
          // over the canvas DOM and would swallow the lid's pointer events
          screenUrl={null}
          // editing is about the lid back — start behind and above, where the
          // lid's reflection catches the sky formers and shows its color
          camera={[0.25, 0.62, -1.15]}
          interactive
        >
          {/* workshop fill — metal specular is tinted by the base color, so
              this sheen makes the chosen color readable on the lid back */}
          <directionalLight position={[0.6, 1.6, -2.4]} intensity={1.5} />
          <LidDragSurface
            stickers={stickers}
            selected={selected}
            onSelect={setSelected}
            onMove={(i, x, y) => patch(i, { x, y })}
          />
        </LaptopCanvas>
        <div
          style={{
            position: "absolute",
            left: 14,
            bottom: 12,
            color: "#7c848d",
            font: "11px/1.4 -apple-system, 'Helvetica Neue', sans-serif",
            pointerEvents: "none",
          }}
        >
          drag to orbit · click a sticker to select · drag it to move
        </div>
      </div>

      <div style={panel}>
        <div style={{ ...h, marginTop: 0 }}>Laptop color</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.value}
              title={p.name}
              onClick={() => setColor(p.value)}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                cursor: "pointer",
                background: p.value,
                border:
                  color === p.value
                    ? `2px solid ${ACCENT}`
                    : "2px solid #23272c",
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: 26,
              height: 26,
              padding: 0,
              border: "2px solid #23272c",
              borderRadius: "50%",
              background: "none",
              cursor: "pointer",
            }}
            title="custom color"
          />
        </div>

        <div style={h}>Screen</div>
        <input
          value={screenUrl}
          onChange={(e) => setScreenUrl(e.target.value)}
          placeholder='"self", a URL, or empty for wallpaper'
          spellCheck={false}
          style={inputStyle}
        />
        <p style={{ margin: "6px 0 0", color: "#7c848d", fontSize: 11 }}>
          the live page renders on the shipped site — the editor previews the
          wallpaper so the lid stays draggable
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={urlBar}
            onChange={(e) => setUrlBar(e.target.checked)}
          />
          URL bar inside the screen
        </label>

        <div style={h}>Stickers</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={addSticker}
          style={{ display: "none" }}
        />
        <button style={btn} onClick={() => fileRef.current?.click()}>
          + Add sticker image
        </button>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {stickers.map((s, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              style={{
                width: 44,
                height: 44,
                padding: 2,
                borderRadius: 6,
                cursor: "pointer",
                background: "#0c0e11",
                border:
                  selected === i
                    ? `2px solid ${ACCENT}`
                    : "2px solid #23272c",
              }}
            >
              <img
                src={s.image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </button>
          ))}
        </div>

        {sel && selected != null && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background: "#0c0e11",
              border: "1px solid #1e2126",
            }}
          >
            <label style={{ display: "block", marginBottom: 8 }}>
              size
              <input
                type="range"
                min={0.02}
                max={0.16}
                step={0.002}
                value={sel.scale ?? 0.06}
                onChange={(e) => patch(selected, { scale: Number(e.target.value) })}
                style={{ width: "100%" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 10 }}>
              rotation
              <input
                type="range"
                min={-Math.PI}
                max={Math.PI}
                step={0.02}
                value={sel.rotation ?? 0}
                onChange={(e) =>
                  patch(selected, { rotation: Number(e.target.value) })
                }
                style={{ width: "100%" }}
              />
            </label>
            <button
              style={{ ...btn, borderColor: "#5a2a2a", color: "#e08c8c" }}
              onClick={() => {
                setStickers((s) => s.filter((_, j) => j !== selected));
                setSelected(null);
              }}
            >
              Remove sticker
            </button>
          </div>
        )}

        <div style={h}>Export</div>
        <p style={{ margin: "0 0 8px", color: "#7c848d" }}>
          Copy the config and render{" "}
          <code style={{ color: "#aeb6bf" }}>{"<LaptopCanvas {...config} />"}</code>{" "}
          in the page you ship. The editor never needs to be deployed.
        </p>
        <button
          style={{ ...btn, borderColor: ACCENT, color: "#dbe7ff" }}
          onClick={async () => {
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy config JSON"}
        </button>
        <pre
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: "#0c0e11",
            border: "1px solid #1e2126",
            color: "#8fa0b3",
            font: "10.5px/1.5 ui-monospace, monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {json}
        </pre>
      </div>
    </div>
  );
}

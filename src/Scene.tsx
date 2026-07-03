import { useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  MeshReflectorMaterial,
} from "@react-three/drei";
import * as THREE from "three";

/**
 * SHARED SCENE SHELL — ported from operator-terminal-3d.
 * Owns lighting, reflections, floor, camera, orbit controls, and the
 * placeholder screen texture (an animated macOS-ish wallpaper). The machine
 * only supplies its own mesh via `renderMachine(screenTexture)`.
 */

function usePlaceholderScreenTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 666;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, ctx: canvas.getContext("2d")!, tex };
  }, []);
}

// slow-drifting abstract wallpaper — ribbons of teal/ice light on deep ink,
// in the family of Apple's press-shot swirl
function drawScreen(ctx: CanvasRenderingContext2D, t: number) {
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

function SceneContents({
  renderMachine,
}: {
  renderMachine: (screenTexture: THREE.Texture) => ReactNode;
}) {
  const { ctx, tex } = usePlaceholderScreenTexture();
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    drawScreen(ctx, clock.current);
    tex.needsUpdate = true;
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* procedural env map — the soft studio the aluminum reflects */}
      <Environment resolution={256}>
        <Lightformer intensity={2.6} position={[0, 4, 3]} scale={[8, 3, 1]} />
        <Lightformer intensity={0.9} position={[-4, 1.5, 1]} scale={[3, 4, 1]} color="#bcd0e8" />
        <Lightformer intensity={0.9} position={[4, 1.5, 1]} scale={[3, 4, 1]} color="#e8dcc8" />
        <Lightformer intensity={0.5} position={[0, 1, -4]} scale={[6, 2, 1]} />
      </Environment>

      {renderMachine(tex)}

      <ContactShadows
        position={[0, -0.001, 0]}
        opacity={0.5}
        scale={4}
        blur={2.4}
        far={2}
        resolution={1024}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[20, 20]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.35}
          mixBlur={8}
          mixStrength={1.2}
          blur={[300, 100]}
          roughness={0.9}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#0c0d0f"
          metalness={0.4}
        />
      </mesh>

      <OrbitControls
        makeDefault
        enableDamping
        minDistance={0.45}
        maxDistance={3.5}
        maxPolarAngle={Math.PI / 2 - 0.02}
        target={[0, 0.11, 0]}
      />
    </>
  );
}

// ?cam=x,y,z overrides the start camera (handy for screenshots / embeds)
function initialCamera(): [number, number, number] {
  const p = new URLSearchParams(window.location.search).get("cam");
  if (p) {
    const v = p.split(",").map(Number);
    if (v.length === 3 && v.every((n) => Number.isFinite(n)))
      return [v[0], v[1], v[2]];
  }
  return [0.55, 0.42, 0.95];
}

export function Scene({
  renderMachine,
}: {
  renderMachine: (screenTexture: THREE.Texture) => ReactNode;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: initialCamera(), fov: 35 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#0c0d0f"]} />
      <SceneContents renderMachine={renderMachine} />
    </Canvas>
  );
}

import type { CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  MeshReflectorMaterial,
} from "@react-three/drei";
import * as THREE from "three";
import { Laptop, type LaptopProps } from "./Laptop";
import { laptopEmbedDepth } from "./embed";

/**
 * BATTERIES-INCLUDED STAGE — canvas, camera, orbit, studio lighting,
 * reflective floor, contact shadow. Drop it into any React page; no three.js
 * knowledge required. For an existing R3F canvas, use <Laptop /> directly.
 */
export type LaptopCanvasProps = LaptopProps & {
  /** start camera position; ?cam=x,y,z in the page URL overrides it */
  camera?: [number, number, number];
  /** orbit controls — default: on at depth 0, off inside a laptop screen */
  interactive?: boolean;
  /** canvas background color, or "transparent". Default "#0c0d0f" */
  background?: string;
  style?: CSSProperties;
  className?: string;
};

// ?cam=x,y,z overrides the start camera (handy for screenshots / embeds)
function initialCamera(fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const p = new URLSearchParams(window.location.search).get("cam");
  if (p) {
    const v = p.split(",").map(Number);
    if (v.length === 3 && v.every((n) => Number.isFinite(n)))
      return [v[0], v[1], v[2]];
  }
  return fallback;
}

export function LaptopCanvas({
  camera = [0.55, 0.42, 0.95],
  interactive,
  background = "#0c0d0f",
  style,
  className,
  ...laptop
}: LaptopCanvasProps) {
  const transparent = background === "transparent";
  const orbit = interactive ?? laptopEmbedDepth() === 0;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: initialCamera(camera), fov: 35 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        alpha: transparent,
      }}
      style={{ width: "100%", height: "100%", ...style }}
      className={className}
    >
      {!transparent && <color attach="background" args={[background]} />}

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

      <Laptop {...laptop} />

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

      {orbit && (
        <OrbitControls
          makeDefault
          enableDamping
          minDistance={0.45}
          maxDistance={3.5}
          maxPolarAngle={Math.PI / 2 - 0.02}
          target={[0, 0.11, 0]}
        />
      )}
    </Canvas>
  );
}

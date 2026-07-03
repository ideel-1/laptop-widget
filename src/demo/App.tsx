import { useEffect, useState } from "react";
import { LaptopCanvas, laptopEmbedDepth } from "../lib";
import { LaptopEditor } from "../lib/editor";

type Route = "mac" | "web" | "custom" | "editor";

// built-in demo sticker — a little round badge, no asset files needed
const BADGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="60" fill="#e8543f"/><circle cx="64" cy="64" r="44" fill="#f4ede2"/><text x="64" y="79" font-family="Helvetica, Arial" font-size="42" font-weight="700" text-anchor="middle" fill="#e8543f">R</text></svg>`
  );
const HEART =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path d="M64 112 C20 80 8 52 24 34 C38 18 58 24 64 40 C70 24 90 18 104 34 C120 52 108 80 64 112 Z" fill="#3f7fe8"/></svg>`
  );

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(
    (window.location.hash.replace("#", "") as Route) || "mac"
  );
  useEffect(() => {
    const on = () =>
      setRoute((window.location.hash.replace("#", "") as Route) || "mac");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

// ?embed hides all chrome — for dropping the scene into another page as an
// iframe. Pages living inside a laptop screen also drop the chrome.
const EMBED =
  new URLSearchParams(window.location.search).has("embed") ||
  laptopEmbedDepth() > 0;

export default function App() {
  const route = useHashRoute();

  return (
    <>
      {!EMBED && (
        <nav className="nav">
          <a href="#mac" className={route === "mac" ? "active" : ""}>Mac</a>
          <a href="#web" className={route === "web" ? "active" : ""}>Web</a>
          <a href="#custom" className={route === "custom" ? "active" : ""}>Custom</a>
          <a href="#editor" className={route === "editor" ? "active" : ""}>Editor</a>
          <span className="label">procedural macbook · code-built, no model files</span>
        </nav>
      )}

      {/* #mac: wallpaper screen. #web: live iframe — defaults to this very
          page, so the laptop shows the laptop (recursion capped at depth 2) */}
      {route === "mac" && <LaptopCanvas screenUrl={null} />}
      {route === "web" && <LaptopCanvas />}
      {route === "editor" && (
        <LaptopEditor
          initial={{
            color: "#c8ccd2",
            screenUrl: "self",
            stickers: [
              { image: BADGE, x: -0.06, y: 0.2, rotation: -0.35, scale: 0.07 },
            ],
          }}
        />
      )}
      {/* color + stickers showcase, shot from behind the lid */}
      {route === "custom" && (
        <LaptopCanvas
          screenUrl={null}
          color="#d9aebb"
          camera={[0.25, 0.4, -1.35]}
          stickers={[
            { image: BADGE, x: -0.06, y: 0.2, rotation: -0.35, scale: 0.07 },
            { image: HEART, x: 0.09, y: 0.12, rotation: 0.5, scale: 0.05 },
          ]}
        />
      )}
    </>
  );
}

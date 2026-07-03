import { useEffect, useState } from "react";
import { Scene } from "./Scene";
import { Macbook } from "./Macbook";

type Route = "mac" | "web";

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

// ?embed hides all chrome — for dropping the scene into another page as an iframe
const EMBED = new URLSearchParams(window.location.search).has("embed");

export default function App() {
  const route = useHashRoute();
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [screenUrl, setScreenUrl] = useState("https://example.com");

  const loadUrl = () => {
    let u = urlInput.trim();
    if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
    setScreenUrl(u);
  };

  return (
    <>
      {!EMBED && (
        <nav className="nav">
          <a href="#mac" className={route === "mac" ? "active" : ""}>Mac</a>
          <a href="#web" className={route === "web" ? "active" : ""}>Web</a>
          <span className="label">procedural macbook · code-built, no model files</span>
        </nav>
      )}

      {route === "web" && !EMBED && (
        <form
          className="urlbar"
          onSubmit={(e) => {
            e.preventDefault();
            loadUrl();
          }}
        >
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            spellCheck={false}
          />
          <button type="submit">Load</button>
        </form>
      )}

      {route === "mac" && (
        <Scene renderMachine={(tex) => <Macbook screenTexture={tex} />} />
      )}
      {route === "web" && (
        <Scene
          renderMachine={(tex) => (
            <Macbook screenTexture={tex} screenUrl={screenUrl} />
          )}
        />
      )}
    </>
  );
}

import "./App.css";
import { useEffect, useState } from "react";
import { SeededSketchPage } from "./components/SeededSketchPage";

type PageRoute = "main" | "secondary";

const MAIN_ROUTE = "#/";
const SECOND_ROUTE = "#/secondary";
const MAIN_VASE_IMAGES = [
  "/sketch-images/vases/vase06.png",
  "/sketch-images/vases/vase04.png",
  "/sketch-images/vases/vase05.png",
];
const SECONDARY_VASE_IMAGES = [
  "/sketch-images/vases/vase01.png",
  "/sketch-images/vases/vase02.png",
  "/sketch-images/vases/vase03.png",
];

function resolveRoute(hash: string): PageRoute {
  return hash === SECOND_ROUTE ? "secondary" : "main";
}

function App() {
  const [route, setRoute] = useState<PageRoute>(() => resolveRoute(window.location.hash));

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = MAIN_ROUTE;
    }

    const onHashChange = () => {
      setRoute(resolveRoute(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    route === "main" ? (
      <SeededSketchPage
        title="Mercury Generative Art"
        seed={20260209}
        presetCount={8}
        vaseImages={MAIN_VASE_IMAGES}
        savePrefix="main-dithered-preset"
        navLabel="Open Second Page"
        onNavigate={() => {
          window.location.hash = SECOND_ROUTE;
        }}
      />
    ) : (
      <SeededSketchPage
        title="Mercury Generative Art - Page 2"
        seed={20260210}
        presetCount={8}
        vaseImages={SECONDARY_VASE_IMAGES}
        savePrefix="secondary-dithered-preset"
        navLabel="Back to Main Page"
        onNavigate={() => {
          window.location.hash = MAIN_ROUTE;
        }}
      />
    )
  );
}

export default App;

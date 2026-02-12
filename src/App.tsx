import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import p5 from "p5";
import "./App.css";
import { createSketch, type SketchOptions } from "./sketch/createSketch";
import { createSeededPresets } from "./sketch/seedData";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const VASE_IMAGES = ["/vases/vase01.png", "/vases/vase02.png", "/vases/vase03.png"];

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sketchRef = useRef<p5 | null>(null);

  const presets = useMemo<SketchOptions[]>(
    () =>
      createSeededPresets(20260209, 8).map((preset, i) => ({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        imagePath: VASE_IMAGES[i % VASE_IMAGES.length],
        variables: preset.variables,
      })),
    [],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = createSketch(presets[index]);
    const instance = new p5(sketch, containerRef.current);
    sketchRef.current = instance;

    return () => {
      instance.remove();
      if (sketchRef.current === instance) {
        sketchRef.current = null;
      }
    };
  }, [index, presets]);

  const saveCurrentImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const instance = sketchRef.current;
    if (!instance) return;
    instance.saveCanvas(`dithered-preset-${index + 1}`, "png");
  };

  return (
    <main className="app" onClick={() => setIndex((current) => (current + 1) % presets.length)}>
      <h1>Mercury Generative Art</h1>
      <p>Click anywhere to rotate presets.</p>
      <p className="preset">Preset {index + 1} / {presets.length}</p>
      <div className="canvasWrap" ref={containerRef} />
      <button className="saveBtn" onClick={saveCurrentImage}>
        Save PNG
      </button>
    </main>
  );
}

export default App;

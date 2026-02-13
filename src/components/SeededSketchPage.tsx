import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import p5 from "p5";
import { createSketch, type SketchOptions } from "../sketch/createSketch";
import { createSeededPresets } from "../sketch/seedData";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

type SeededSketchPageProps = {
  title: string;
  seed: number;
  presetCount: number;
  vaseImages: string[];
  savePrefix: string;
  navLabel: string;
  onNavigate: () => void;
};

export function SeededSketchPage({
  title,
  seed,
  presetCount,
  vaseImages,
  savePrefix,
  navLabel,
  onNavigate,
}: SeededSketchPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sketchRef = useRef<p5 | null>(null);
  const [index, setIndex] = useState(0);

  const presets = useMemo<SketchOptions[]>(
    () =>
      createSeededPresets(seed, presetCount).map((preset, i) => ({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        imagePath: vaseImages[i % vaseImages.length],
        variables: preset.variables,
      })),
    [presetCount, seed, vaseImages],
  );

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
    instance.saveCanvas(`${savePrefix}-${index + 1}`, "png");
  };

  const navigateToOtherPage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onNavigate();
  };

  return (
    <main className="app" onClick={() => setIndex((current) => (current + 1) % presets.length)}>
      <h1>{title}</h1>
      <p>Click anywhere to rotate presets.</p>
      <p className="preset">Preset {index + 1} / {presets.length}</p>
      <div className="canvasWrap" ref={containerRef} />
      <div className="actions">
        <button className="navBtn" onClick={navigateToOtherPage}>
          {navLabel}
        </button>
        <button className="saveBtn" onClick={saveCurrentImage}>
          Save PNG
        </button>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import p5 from "p5";
import { createSketch, type SketchOptions, type SketchVariables } from "../sketch/createSketch";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

type SeededSketchPageProps = {
  title: string;
  presetVariables: SketchVariables[];
  vaseImages: string[];
  savePrefix: string;
  navLabel: string;
  onNavigate: () => void;
};

export function SeededSketchPage({
  title,
  presetVariables,
  vaseImages,
  savePrefix,
  navLabel,
  onNavigate,
}: SeededSketchPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sketchRef = useRef<p5 | null>(null);
  const [index, setIndex] = useState(0);
  const presetCount = presetsLength(presetVariables.length);

  const advancePreset = useCallback(() => {
    setIndex((current) => (current + 1) % presetCount);
  }, [presetCount]);

  const presets = useMemo<SketchOptions[]>(
    () =>
      presetVariables.map((variables, i) => ({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        imagePath: vaseImages[i % vaseImages.length],
        variables,
      })),
    [presetVariables, vaseImages],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (presets.length === 0) return;

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
    <main className="app" onClickCapture={advancePreset}>
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

function presetsLength(length: number) {
  return Math.max(1, length);
}

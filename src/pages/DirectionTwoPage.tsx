import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import p5 from "p5";
import {
  createDirectionTwoSketch,
  type DirectionTwoSketchOptions,
  type DirectionTwoVariables,
} from "../sketch/createDirectionTwoSketch";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

type DirectionTwoPageProps = {
  onNavigate: () => void;
};

const SECONDARY_VASE_IMAGES = [
  "/sketch-images/vases/vase01.png",
  "/sketch-images/vases/vase02.png",
  "/sketch-images/vases/vase03.png",
  "/sketch-images/vases/vase04.png",
  "/sketch-images/vases/vase05.png",
  "/sketch-images/vases/vase06.png",
];

const SECONDARY_TOP_IMAGES = [
  "/sketch-images/bouquet/stillife06.png"
];

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), t | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(rand: () => number, min: number, max: number) {
  return min + rand() * (max - min);
}

export function DirectionTwoPage({ onNavigate }: DirectionTwoPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sketchRef = useRef<p5 | null>(null);
  const [index, setIndex] = useState(0);

  const presets = useMemo<DirectionTwoSketchOptions[]>(() => {
    const rand = mulberry32(20260210);
    const pairs = SECONDARY_VASE_IMAGES.flatMap((vasePath) =>
      SECONDARY_TOP_IMAGES.map((topPath) => ({ vasePath, topPath })),
    );

    return pairs.map(({ vasePath, topPath }) => {
      const vars: DirectionTwoVariables = {
        pixelScale: 2,
        brightnessOffset: Math.floor(randomRange(rand, -28, -10)),
        contrastFactor: Math.floor(randomRange(rand, 8, 32)),
        stillLifeOffset: Math.floor(randomRange(rand, 70, 130)),
        stackYOffset: Math.floor(randomRange(rand, 50, 95)),
        drawAsRects: true,
        maxPixels: 1000000,
        shuffleEveryNFrames: rand() > 0.5 ? 0 : 30,
        rngSeed: Math.floor(randomRange(rand, 1, 99999)),
        vaseScale: randomRange(rand, 0.4, 0.72),
        stilllifeScale: randomRange(rand, 0.5, 0.95),
      };

      return {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        bottomImagePath: vasePath,
        topImagePath: topPath,
        variables: vars,
      };
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = createDirectionTwoSketch(presets[index]);
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
    instance.saveCanvas(`secondary-dithered-preset-${index + 1}`, "png");
  };

  const navigateToOtherPage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onNavigate();
  };

  return (
    <main className="app" onClick={() => setIndex((current) => (current + 1) % presets.length)}>
      <h1>Direction 2</h1>
      <p>Click anywhere to rotate presets.</p>
      <p className="preset">Preset {index + 1} / {presets.length}</p>
      <div className="canvasWrap" ref={containerRef} />
      <div className="actions">
        <button className="navBtn" onClick={navigateToOtherPage}>
          Back to Direction 1
        </button>
        <button className="saveBtn" onClick={saveCurrentImage}>
          Save PNG
        </button>
      </div>
    </main>
  );
}

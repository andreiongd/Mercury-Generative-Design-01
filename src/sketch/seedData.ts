import type { SketchVariables } from "./createSketch";

export type SketchPreset = {
  name: string;
  variables: SketchVariables;
};

function mulberry32(seed: number) {
  let t = seed;
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

export function createSeededPresets(
  seed = 20260209,
  count = 8,
): SketchPreset[] {
  const rand = mulberry32(seed);

  return Array.from({ length: count }, (_, index) => ({
    name: `Seed ${seed} / ${index + 1}`,
    variables: (() => {
      const pixelScale = 2;
      return {
        pixelScale,
        maxPixels: Math.floor(randomRange(rand, 5000, 15000)),
        brightnessOffset: Math.floor(randomRange(rand, -24, 0)),
        contrastFactor: Math.floor(randomRange(rand, 0, 40)),
        drawAsRects: rand() > 0,
        shuffleEveryNFrames: Math.floor(randomRange(rand, 0, 60)),
        rngSeed: Math.floor(randomRange(rand, 1, 99999)),
      };
    })(),
  }));
}

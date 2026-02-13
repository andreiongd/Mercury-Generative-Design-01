import type { SketchVariables } from "./createSketch";

type Range = {
  min: number;
  max: number;
};

type DirectionOneSeedConfig = {
  seed: number;
  presetCount: number;
  ranges?: {
    pixelScale?: Range;
    maxPixels?: Range;
    brightnessOffset?: Range;
    contrastFactor?: Range;
    flowerCount?: Range;
    bouquetScale?: Range;
    bouquetAspect?: Range;
    bouquetLift?: Range;
    bouquetInnerLift?: Range;
    bouquetDispersion?: Range;
    frontViewRatio?: Range;
    vaseScale?: Range;
  };
  fixed?: Partial<SketchVariables>;
};

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

function toInt(value: number) {
  return Math.floor(value);
}

function getRange(overrides: Range | undefined, defaults: Range): Range {
  if (!overrides) return defaults;
  return {
    min: overrides.min,
    max: overrides.max,
  };
}

export function generateDirectionOneSeededVariables(
  config: DirectionOneSeedConfig,
): SketchVariables[] {
  const presetCount = Math.max(1, Math.floor(config.presetCount));
  const seed = Math.floor(config.seed);
  const ranges = config.ranges ?? {};
  const fixed = config.fixed ?? {};

  const pixelScale = getRange(ranges.pixelScale, { min: 1, max: 2 });
  const maxPixels = getRange(ranges.maxPixels, { min: 30000, max: 100000 });
  const brightnessOffset = getRange(ranges.brightnessOffset, { min: -68, max: -48 });
  const contrastFactor = getRange(ranges.contrastFactor, { min: 6, max: 36 });
  const flowerCount = getRange(ranges.flowerCount, { min: 32, max: 50 });
  const bouquetScale = getRange(ranges.bouquetScale, { min: 0.25, max: 0.8 });
  const bouquetAspect = getRange(ranges.bouquetAspect, { min: 0.2, max: 0.9 });
  const bouquetLift = getRange(ranges.bouquetLift, { min: 62, max: 92 });
  const bouquetInnerLift = getRange(ranges.bouquetInnerLift, { min: 96, max: 132 });
  const bouquetDispersion = getRange(ranges.bouquetDispersion, { min: 0.42, max: 0.9 });
  const frontViewRatio = getRange(ranges.frontViewRatio, { min: 0.16, max: 0.28 });
  const vaseScale = getRange(ranges.vaseScale, { min: 0.34, max: 0.5 });

  return Array.from({ length: presetCount }, (_, i) => {
    const rand = mulberry32((seed + i * 1013904223) >>> 0);
    return {
      pixelScale: toInt(randomRange(rand, pixelScale.min, pixelScale.max + 0.999)),
      maxPixels: toInt(randomRange(rand, maxPixels.min, maxPixels.max)),
      brightnessOffset: toInt(randomRange(rand, brightnessOffset.min, brightnessOffset.max)),
      contrastFactor: toInt(randomRange(rand, contrastFactor.min, contrastFactor.max)),
      drawAsRects: true,
      rngSeed: toInt(randomRange(rand, 1, 99999)),
      flowerCount: toInt(randomRange(rand, flowerCount.min, flowerCount.max)),
      bouquetScale: randomRange(rand, bouquetScale.min, bouquetScale.max),
      bouquetAspect: randomRange(rand, bouquetAspect.min, bouquetAspect.max),
      bouquetLift: toInt(randomRange(rand, bouquetLift.min, bouquetLift.max)),
      bouquetInnerLift: toInt(randomRange(rand, bouquetInnerLift.min, bouquetInnerLift.max)),
      bouquetDispersion: randomRange(rand, bouquetDispersion.min, bouquetDispersion.max),
      frontViewRatio: randomRange(rand, frontViewRatio.min, frontViewRatio.max),
      showArrangementGuides: false,
      vaseScale: randomRange(rand, vaseScale.min, vaseScale.max),
      ...fixed,
    };
  });
}

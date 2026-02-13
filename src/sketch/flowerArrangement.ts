export type ArrangementPoint = {
  x: number;
  y: number;
  depth: number;
  spriteIndex: number;
  rotation: number;
  size: number;
};

export type ArrangementGuide = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
};

export type FlowerArrangementResult = {
  points: ArrangementPoint[];
  guides: {
    outer: ArrangementGuide;
    inner: ArrangementGuide;
  };
};

export type FlowerArrangementOptions = {
  centerX: number;
  centerY: number;
  flowerCount: number;
  bouquetScale: number;
  bouquetAspect: number;
  bouquetLift: number;
  innerLift: number;
  frontViewRatio: number;
  bouquetDispersion: number;
  spriteCount: number;
  rand: () => number;
  // legacy override; when omitted density is auto-derived from flowerCount.
  bouquetDensity?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceSquared(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function pickAngle(rand: () => number, frontBias = 0.62) {
  return rand() < frontBias ? rand() * Math.PI : Math.PI + rand() * Math.PI;
}

function sampleNearWithFarTail(rand: () => number, min: number, max: number, dispersion: number) {
  const span = Math.max(0, max - min);
  if (span <= 0) return min;

  const nearPower = lerp(3.2, 2.05, dispersion);
  let t = Math.pow(rand(), nearPower);

  const farChance = 0.08 + dispersion * 0.24;
  if (rand() < farChance) {
    const farStart = 0.72 + dispersion * 0.18;
    t = farStart + rand() * (1 - farStart);
  }

  return min + span * t;
}

type RingBuildOptions = {
  minGap: number;
  jitterMin: number;
  jitterMax: number;
  verticalJitter: number;
  tangentJitterFactor: number;
  sizeMin: number;
  sizeMax: number;
  spriteCount: number;
  frontBias: number;
  dispersion: number;
  rand: () => number;
};

function buildRingPoints(
  existing: ArrangementPoint[],
  count: number,
  guide: ArrangementGuide,
  options: RingBuildOptions,
) {
  const points: ArrangementPoint[] = [];
  const minGapSq = options.minGap * options.minGap;
  const attempts = count * 140;
  const tangentJitter = options.minGap * options.tangentJitterFactor;

  for (let attempt = 0; attempt < attempts && points.length < count; attempt += 1) {
    const angle = pickAngle(options.rand, options.frontBias);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const ringX = guide.centerX + cosA * guide.radiusX;
    const ringY = guide.centerY + sinA * guide.radiusY;

    const nx = cosA;
    const ny = sinA;
    const tx = -sinA;
    const ty = cosA;

    const jitterAbs = sampleNearWithFarTail(
      options.rand,
      options.jitterMin,
      options.jitterMax,
      options.dispersion,
    );
    const jitterSign = options.rand() < 0.68 ? 1 : -1;
    const radialJitter = jitterAbs * jitterSign;
    const tangentOffset = (options.rand() - 0.5) * 2 * tangentJitter;
    const verticalAmp = sampleNearWithFarTail(
      options.rand,
      options.verticalJitter * 0.2,
      options.verticalJitter * 1.45,
      options.dispersion,
    );
    const yOffset = (options.rand() - 0.5) * 2 * verticalAmp;

    const x = ringX + nx * radialJitter + tx * tangentOffset;
    const y = ringY + ny * radialJitter + ty * tangentOffset * 0.2 + yOffset;

    let blocked = false;
    for (let i = 0; i < existing.length; i += 1) {
      if (distanceSquared(x, y, existing[i].x, existing[i].y) < minGapSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (let i = 0; i < points.length; i += 1) {
      if (distanceSquared(x, y, points[i].x, points[i].y) < minGapSq) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    points.push({
      x,
      y,
      depth: sinA,
      spriteIndex: Math.floor(options.rand() * Math.max(1, options.spriteCount)),
      rotation: (options.rand() - 0.5) * 0.26,
      size:
        (options.sizeMin + options.rand() * (options.sizeMax - options.sizeMin)) *
        (0.9 + Math.max(0, sinA) * 0.22),
    });
  }

  return points;
}

export function generateFlowerArrangement(options: FlowerArrangementOptions): FlowerArrangementResult {
  const flowerCount = Math.max(6, Math.floor(options.flowerCount));
  const bouquetScale = clamp(options.bouquetScale, 0, 1);
  const bouquetAspect = clamp(options.bouquetAspect, 0, 1);
  const dispersion = clamp(options.bouquetDispersion, 0.05, 1);
  const frontViewRatio = clamp(options.frontViewRatio, 0.1, 0.8);

  const countNorm = clamp((flowerCount - 10) / 50, 0, 1);
  const autoDensityBase = 0.76 - countNorm * 0.24;
  const autoDensityJitter = (options.rand() - 0.5) * 0.14;
  const autoDensity = clamp(autoDensityBase + autoDensityJitter, 0.38, 0.88);
  const density = typeof options.bouquetDensity === "number"
    ? clamp(autoDensity * 0.7 + options.bouquetDensity * 0.3, 0.3, 0.9)
    : autoDensity;

  const targetCount = 42;
  const countRatio = clamp(flowerCount / targetCount, 0.4, 1.4);
  const circleScale = Math.pow(countRatio, 0.88);

  const widthBase = lerp(260, 440, countNorm);
  const widthScale = lerp(0.78, 1.28, bouquetScale);
  const widthNoise = 1 + (options.rand() - 0.5) * 0.18;
  const outerWidth = Math.max(110, widthBase * widthScale * widthNoise * circleScale);

  const aspectBase = lerp(0.36, 0.76, bouquetAspect);
  const aspectNoise = 1 + (options.rand() - 0.5) * 0.14;
  const rawHeight = outerWidth * aspectBase * aspectNoise;
  const frontHeight = Math.min(rawHeight, outerWidth * frontViewRatio);
  const outerHeight = Math.max(28, frontHeight * circleScale);

  const outerGuide: ArrangementGuide = {
    centerX: options.centerX,
    centerY: options.centerY - options.bouquetLift,
    radiusX: outerWidth * 0.5,
    radiusY: outerHeight * 0.5,
  };

  const outerShareNoise = (options.rand() - 0.5) * 0.08;
  const outerShare = clamp(0.62 + (0.5 - density) * 0.12 + outerShareNoise, 0.54, 0.78);
  const outerCount = clamp(Math.round(flowerCount * outerShare), 4, flowerCount - 2);
  const innerCount = Math.max(2, flowerCount - outerCount);

  const innerScaleNoise = (options.rand() - 0.5) * 0.1;
  const innerScale = clamp(0.5 + density * 0.24 + innerScaleNoise, 0.44, 0.84);
  const innerLiftJitter = (options.rand() - 0.5) * 2 * Math.max(4, outerGuide.radiusY * 0.12);
  const effectiveInnerLift = Math.max(0, options.innerLift + innerLiftJitter);
  const innerGuide: ArrangementGuide = {
    centerX: outerGuide.centerX,
    centerY: outerGuide.centerY - effectiveInnerLift,
    radiusX: outerGuide.radiusX * innerScale,
    radiusY: outerGuide.radiusY * innerScale,
  };

  const areaOuter = Math.PI * outerGuide.radiusX * outerGuide.radiusY;
  const areaInner = Math.PI * innerGuide.radiusX * innerGuide.radiusY * 0.9;
  const totalArea = areaOuter + areaInner;
  const baseSpacing = Math.sqrt(totalArea / flowerCount);
  const offsetDamping = lerp(1.08, 0.66, countNorm);

  const minGap = Math.max(2, baseSpacing * lerp(1.26, 0.78, density));
  const jitterMin = Math.max(1.5, minGap * (0.1 + 0.22 * dispersion) * offsetDamping);
  const jitterMax = Math.max(jitterMin + 1, minGap * (0.5 + 1.55 * dispersion) * offsetDamping);
  const verticalJitter = Math.max(
    4,
    outerGuide.radiusY * (0.3 + 0.9 * dispersion) * lerp(0.92, 0.56, countNorm),
  );
  const tangentJitterFactor = (0.26 + 0.75 * dispersion) * lerp(0.9, 0.64, countNorm);
  const baseFlowerSize = lerp(64, 92, countNorm) * lerp(1.08, 1.38, bouquetScale);
  const sizeSpread = lerp(0.42, 0.62, dispersion);
  const sizeMin = Math.max(20, baseFlowerSize * (1 - sizeSpread * 0.45));
  const sizeMax = Math.max(sizeMin + 8, baseFlowerSize * (1 + sizeSpread * 1.65));

  const ringOptions: RingBuildOptions = {
    minGap,
    jitterMin,
    jitterMax,
    verticalJitter,
    tangentJitterFactor,
    sizeMin,
    sizeMax,
    spriteCount: options.spriteCount,
    frontBias: 0.82,
    dispersion,
    rand: options.rand,
  };

  const all: ArrangementPoint[] = [];
  const outerPoints = buildRingPoints(all, outerCount, outerGuide, ringOptions);
  all.push(...outerPoints);

  const innerPoints = buildRingPoints(all, innerCount, innerGuide, {
    ...ringOptions,
    minGap: Math.max(2, minGap * 0.88),
    jitterMin: jitterMin * 0.6,
    jitterMax: jitterMax * 0.76,
    verticalJitter: verticalJitter * 0.72,
    sizeMin: sizeMin * 0.92,
    sizeMax: sizeMax * 1.02,
    frontBias: 0.68,
  });
  all.push(...innerPoints);

  all.sort((a, b) => a.depth - b.depth);
  return {
    points: all,
    guides: {
      outer: outerGuide,
      inner: innerGuide,
    },
  };
}

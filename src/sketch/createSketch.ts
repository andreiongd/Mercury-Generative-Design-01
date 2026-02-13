import type p5 from "p5";
import { generateFlowerArrangement } from "./flowerArrangement";

type RGB = [number, number, number];
type FlowerPlacement = {
  x: number;
  y: number;
  depth: number;
  rotation: number;
  size: number;
  spriteIndex: number;
};

type FlowerSprite = {
  image: p5.Image;
};

export type SketchVariables = {
  pixelScale?: number;
  brightnessOffset?: number;
  contrastFactor?: number;
  drawAsRects?: boolean;
  maxPixels?: number;
  shuffleEveryNFrames?: number;
  rngSeed?: number;
  flowerCount?: number;
  bouquetScale?: number;
  bouquetAspect?: number;
  bouquetLift?: number;
  bouquetInnerLift?: number;
  bouquetDensity?: number;
  bouquetDispersion?: number;
  frontViewRatio?: number;
  showArrangementGuides?: boolean;
  // legacy fields (still supported as fallback)
  bouquetWidth?: number;
  bouquetHeight?: number;
  arrangementOuterWidth?: number;
  arrangementOuterHeight?: number;
  arrangementOuterLift?: number;
  arrangementInnerLift?: number;
  arrangementFrontViewRatio?: number;
  arrangementShowGuides?: boolean;
  flowerDrawSize?: number;
  flowerDrawSizeMin?: number;
  flowerDrawSizeMax?: number;
  arrangementOuterCount?: number;
  arrangementInnerCount?: number;
  arrangementMinGap?: number;
  arrangementJitterMin?: number;
  arrangementJitterMax?: number;
  arrangementVerticalJitter?: number;
  flowerSizeMin?: number;
  flowerSizeMax?: number;
};

export type SketchOptions = {
  width?: number;
  height?: number;
  imagePath?: string;
  variables?: SketchVariables;
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

function clamp255(value: number) {
  return Math.max(0, Math.min(255, value));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function createSketch(opts: SketchOptions = {}) {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1350;
  const imagePath = opts.imagePath ?? "/sketch-images/vases/vase01.png";

  const vars = opts.variables ?? {};

  const pixelScale = Math.max(1, Math.floor(vars.pixelScale ?? 3));
  const BRIGHTNESS_OFFSET = vars.brightnessOffset ?? -10;
  const CONTRAST_FACTOR = vars.contrastFactor ?? 10;
  const DRAW_AS_RECTS = vars.drawAsRects ?? true;
  const MAX_PIXELS = Math.max(0, Math.floor(vars.maxPixels ?? 50000));
  const RNG_SEED = Math.floor(vars.rngSeed ?? 1337);
  const VASE_SCALE = 0.45;
  const fallbackFlowerCount =
    (vars.arrangementOuterCount ?? 24) + (vars.arrangementInnerCount ?? 13);
  const FLOWER_COUNT = Math.max(6, Math.floor(vars.flowerCount ?? fallbackFlowerCount));
  const legacyWidth = vars.bouquetWidth ?? vars.arrangementOuterWidth;
  const legacyHeight = vars.bouquetHeight ?? vars.arrangementOuterHeight;
  const derivedScaleFromLegacy = clamp01(
    typeof legacyWidth === "number" ? (legacyWidth - 260) / 240 : 0.56,
  );
  const legacyAspectRatio =
    typeof legacyWidth === "number" && typeof legacyHeight === "number" && legacyWidth > 0
      ? legacyHeight / legacyWidth
      : 0.56;
  const derivedAspectFromLegacy = clamp01((legacyAspectRatio - 0.32) / 0.5);
  const BOUQUET_SCALE = clamp01(vars.bouquetScale ?? derivedScaleFromLegacy);
  const BOUQUET_ASPECT = clamp01(vars.bouquetAspect ?? derivedAspectFromLegacy);
  const BOUQUET_LIFT = Math.max(0, vars.bouquetLift ?? vars.arrangementOuterLift ?? 72);
  const BOUQUET_INNER_LIFT = Math.max(0, vars.bouquetInnerLift ?? vars.arrangementInnerLift ?? 112);
  const BOUQUET_DENSITY = vars.bouquetDensity;
  const BOUQUET_DISPERSION = clamp01(vars.bouquetDispersion ?? 0.67);
  const FRONT_VIEW_RATIO = Math.max(
    0.12,
    Math.min(0.75, vars.frontViewRatio ?? vars.arrangementFrontViewRatio ?? 0.22),
  );
  const SHOW_GUIDES = vars.showArrangementGuides ?? vars.arrangementShowGuides ?? false;

  return (p: p5) => {
    let raw: p5.Image | null = null;
    let img: p5.Image | null = null;
    let pg: p5.Graphics;

    let finalW = 0;
    let finalH = 0;
    let fittedOffsetX = 0;
    let fittedOffsetY = 0;
    let fittedW = 0;
    let fittedH = 0;
    let arrangementCenterX = 0;
    let arrangementCenterY = 0;
    let arrangementInnerCenterY = 0;
    let arrangementOuterRadiusX = 0;
    let arrangementOuterRadiusY = 0;
    let arrangementInnerRadiusX = 0;
    let arrangementInnerRadiusY = 0;
    let flowerPlacements: FlowerPlacement[] = [];
    let flowerSprites: FlowerSprite[] = [];

    const palette: RGB[] = [
      [0, 0, 0],
      [66, 133, 244],
      [234, 67, 53],
      [251, 188, 5],
      [52, 168, 83],
      [248, 249, 250],
    ];
    const darkestColor = palette[0];

    let drawIdx = new Int32Array(0);
    let drawCount = 0;
    let isReady = false;

    const shuffleDrawIdxOnce = () => {
      const rand = mulberry32(RNG_SEED);
      for (let i = drawIdx.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = drawIdx[i];
        drawIdx[i] = drawIdx[j];
        drawIdx[j] = tmp;
      }
    };

    const isDarkest = (r: number, g: number, b: number) =>
      r === darkestColor[0] && g === darkestColor[1] && b === darkestColor[2];

    const nearestPalette = (r: number, g: number, b: number): RGB => {
      let best = Number.POSITIVE_INFINITY;
      let pick: RGB = palette[0];

      for (let i = 0; i < palette.length; i += 1) {
        const pr = palette[i][0];
        const pgc = palette[i][1];
        const pb = palette[i][2];
        const dr = r - pr;
        const dg = g - pgc;
        const db = b - pb;
        const d2 = dr * dr + dg * dg + db * db;
        if (d2 < best) {
          best = d2;
          pick = palette[i];
        }
      }

      return pick;
    };

    const openingAnchorFromPath = (): [number, number] => {
      const path = imagePath.toLowerCase();
      if (path.includes("vase01")) return [0.5, 0.31];
      if (path.includes("vase02")) return [0.5, 0.13];
      if (path.includes("vase03")) return [0.5, 0.09];
      return [0.5, 0.2];
    };

    const buildFlowerPlacements = () => {
      if (fittedW <= 0 || fittedH <= 0) {
        flowerPlacements = [];
        return;
      }

      const [anchorX, anchorY] = openingAnchorFromPath();
      const centerX = fittedOffsetX + anchorX * fittedW;
      const centerY = fittedOffsetY + anchorY * fittedH;

      const rand = mulberry32((RNG_SEED ^ 0x9e3779b9) >>> 0);
      const arrangement = generateFlowerArrangement({
        centerX,
        centerY,
        flowerCount: FLOWER_COUNT,
        bouquetScale: BOUQUET_SCALE,
        bouquetAspect: BOUQUET_ASPECT,
        bouquetLift: BOUQUET_LIFT,
        innerLift: BOUQUET_INNER_LIFT,
        frontViewRatio: FRONT_VIEW_RATIO,
        ...(typeof BOUQUET_DENSITY === "number" ? { bouquetDensity: BOUQUET_DENSITY } : {}),
        bouquetDispersion: BOUQUET_DISPERSION,
        spriteCount: flowerSprites.length,
        rand,
      });

      flowerPlacements = arrangement.points;
      arrangementCenterX = arrangement.guides.outer.centerX;
      arrangementCenterY = arrangement.guides.outer.centerY;
      arrangementOuterRadiusX = arrangement.guides.outer.radiusX;
      arrangementOuterRadiusY = arrangement.guides.outer.radiusY;
      arrangementInnerCenterY = arrangement.guides.inner.centerY;
      arrangementInnerRadiusX = arrangement.guides.inner.radiusX;
      arrangementInnerRadiusY = arrangement.guides.inner.radiusY;
    };

    const fitImageToSize = (src: p5.Image, outW: number, outH: number) => {
      const scale = Math.min(outW / src.width, outH / src.height) * VASE_SCALE;
      const newW = src.width * scale;
      const newH = src.height * scale;
      const dx = (outW - newW) * 0.5;
      const dy = (outH - newH) * 0.5;

      const g = p.createGraphics(outW, outH);
      g.pixelDensity(1);
      g.clear();
      g.noSmooth();
      g.imageMode(p.CORNER);
      g.image(src, dx, dy, newW, newH);

      return { image: g.get(), dx, dy, w: newW, h: newH };
    };

    const adjustBrightness = (target: p5.Image, offset: number) => {
      target.loadPixels();
      for (let i = 0; i < target.pixels.length; i += 4) {
        target.pixels[i] = clamp255(target.pixels[i] + offset);
        target.pixels[i + 1] = clamp255(target.pixels[i + 1] + offset);
        target.pixels[i + 2] = clamp255(target.pixels[i + 2] + offset);
      }
      target.updatePixels();
    };

    const adjustContrast = (target: p5.Image, contrastFactor: number) => {
      target.loadPixels();
      const factor = (259 * (contrastFactor + 255)) / (255 * (259 - contrastFactor));
      for (let i = 0; i < target.pixels.length; i += 4) {
        const r = factor * (target.pixels[i] - 128) + 128;
        const g = factor * (target.pixels[i + 1] - 128) + 128;
        const b = factor * (target.pixels[i + 2] - 128) + 128;

        target.pixels[i] = clamp255(r);
        target.pixels[i + 1] = clamp255(g);
        target.pixels[i + 2] = clamp255(b);
      }
      target.updatePixels();
    };

    const applyDither = (target: p5.Image) => {
      target.loadPixels();

      const w = target.width;
      const h = target.height;
      const n = w * h;

      const r = new Float32Array(n);
      const g = new Float32Array(n);
      const b = new Float32Array(n);

      for (let i = 0, px = 0; i < n; i += 1, px += 4) {
        r[i] = target.pixels[px];
        g[i] = target.pixels[px + 1];
        b[i] = target.pixels[px + 2];
      }

      const distribute = (x: number, y: number, errR: number, errG: number, errB: number, factor: number) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = x + y * w;
        r[idx] = clamp255(r[idx] + errR * factor);
        g[idx] = clamp255(g[idx] + errG * factor);
        b[idx] = clamp255(b[idx] + errB * factor);
      };

      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const idx = x + y * w;
          const oldR = r[idx];
          const oldG = g[idx];
          const oldB = b[idx];

          const pick = nearestPalette(oldR, oldG, oldB);
          r[idx] = pick[0];
          g[idx] = pick[1];
          b[idx] = pick[2];

          const errR = oldR - pick[0];
          const errG = oldG - pick[1];
          const errB = oldB - pick[2];

          distribute(x + 1, y, errR, errG, errB, 7 / 16);
          distribute(x - 1, y + 1, errR, errG, errB, 3 / 16);
          distribute(x, y + 1, errR, errG, errB, 5 / 16);
          distribute(x + 1, y + 1, errR, errG, errB, 1 / 16);
        }
      }

      for (let i = 0, px = 0; i < n; i += 1, px += 4) {
        target.pixels[px] = r[i];
        target.pixels[px + 1] = g[i];
        target.pixels[px + 2] = b[i];
        target.pixels[px + 3] = 255;
      }

      target.updatePixels();
    };

    const prepareFlowerSprite = (src: p5.Image, targetSize: number): FlowerSprite => {
      const aspect = src.width / src.height;
      let newW = targetSize;
      let newH = targetSize;
      if (aspect > 1) {
        newH = Math.max(1, Math.floor(targetSize / aspect));
      } else {
        newW = Math.max(1, Math.floor(targetSize * aspect));
      }

      const scaled = src.get();
      scaled.resize(newW, newH);

      const out = p.createImage(targetSize, targetSize);
      out.loadPixels();
      for (let i = 0; i < out.pixels.length; i += 4) {
        out.pixels[i] = 0;
        out.pixels[i + 1] = 0;
        out.pixels[i + 2] = 0;
        out.pixels[i + 3] = 0;
      }
      out.updatePixels();

      const dx = Math.floor((targetSize - newW) / 2);
      const dy = Math.floor((targetSize - newH) / 2);
      out.copy(scaled, 0, 0, newW, newH, dx, dy, newW, newH);
      return { image: out };
    };

    const loadFlowerSprites = () => {
      const paths = [
        "/sketch-images/flowers/flower01.png",
        "/sketch-images/flowers/flower02.png",
        "/sketch-images/flowers/flower03.png",
        "/sketch-images/flowers/flower04.png",
        "/sketch-images/flowers/flower05.png",
        "/sketch-images/flowers/flower06.png",
        "/sketch-images/flowers/flower07.png",
      ];

      const loaded = new Array<FlowerSprite | null>(paths.length).fill(null);
      let remaining = paths.length;

      const done = () => {
        remaining -= 1;
        if (remaining > 0) return;
        flowerSprites = loaded.filter((item): item is FlowerSprite => item !== null);
        buildFlowerPlacements();
        if (raw) rebuildImageAndCache();
      };

      for (let i = 0; i < paths.length; i += 1) {
        p.loadImage(
          paths[i],
          (imgLoaded) => {
            loaded[i] = prepareFlowerSprite(imgLoaded, 36);
            done();
          },
          () => {
            done();
          },
        );
      }
    };

    const rebuildImageAndCache = () => {
      if (!raw) return;

      finalW = Math.max(1, Math.floor(p.width / pixelScale));
      finalH = Math.max(1, Math.floor(p.height / pixelScale));
      const renderW = finalW * pixelScale;
      const renderH = finalH * pixelScale;

      const fitHigh = fitImageToSize(raw, renderW, renderH);
      fittedOffsetX = fitHigh.dx;
      fittedOffsetY = fitHigh.dy;
      fittedW = fitHigh.w;
      fittedH = fitHigh.h;
      buildFlowerPlacements();

      const composite = p.createGraphics(renderW, renderH);
      composite.pixelDensity(1);
      composite.clear();
      composite.noSmooth();
      composite.imageMode(p.CORNER);
      composite.image(fitHigh.image, 0, 0);

      if (SHOW_GUIDES) {
        composite.push();
        composite.noFill();
        composite.strokeWeight(2);
        composite.stroke(255, 40, 40, 210);
        composite.ellipse(
          arrangementCenterX,
          arrangementCenterY,
          arrangementOuterRadiusX * 2,
          arrangementOuterRadiusY * 2,
        );
        composite.stroke(60, 180, 255, 210);
        composite.ellipse(
          arrangementCenterX,
          arrangementInnerCenterY,
          arrangementInnerRadiusX * 2,
          arrangementInnerRadiusY * 2,
        );
        composite.pop();
      }

      for (let i = 0; i < flowerPlacements.length; i += 1) {
        const flower = flowerPlacements[i];
        if (flowerSprites.length === 0) continue;
        const sprite = flowerSprites[flower.spriteIndex % flowerSprites.length];
        const x = flower.x;
        const y = flower.y;
        const size = flower.size;

        composite.push();
        composite.imageMode(p.CENTER);
        composite.translate(x, y);
        composite.rotate(flower.rotation);
        composite.image(sprite.image, 0, 0, size, size);
        composite.pop();
      }

      img = composite.get();
      img.resize(finalW, finalH);
      adjustBrightness(img, BRIGHTNESS_OFFSET);
      adjustContrast(img, CONTRAST_FACTOR);
      applyDither(img);

      img.loadPixels();

      const indices: number[] = [];
      for (let i = 0; i < img.pixels.length; i += 4) {
        const r = img.pixels[i];
        const g = img.pixels[i + 1];
        const b = img.pixels[i + 2];
        if (!isDarkest(r, g, b)) {
          indices.push(i / 4);
        }
      }

      drawIdx = Int32Array.from(indices);
      shuffleDrawIdxOnce();
      drawCount = drawIdx.length;
      isReady = true;
    };

    p.setup = () => {
      p.createCanvas(width, height);
      p.pixelDensity(1);
      p.frameRate(30);
      p.noSmooth();
      p.colorMode(p.RGB, 255);

      pg = p.createGraphics(width, height);
      pg.pixelDensity(1);
      loadFlowerSprites();

      p.loadImage(
        imagePath,
        (loaded) => {
          raw = loaded;
          rebuildImageAndCache();
        },
        () => {
          const fallback = p.createImage(120, 180);
          fallback.loadPixels();
          for (let y = 0; y < fallback.height; y += 1) {
            for (let x = 0; x < fallback.width; x += 1) {
              const i = 4 * (x + y * fallback.width);
              const v = (x + y) % 255;
              fallback.pixels[i] = v;
              fallback.pixels[i + 1] = 255 - v;
              fallback.pixels[i + 2] = 120;
              fallback.pixels[i + 3] = 255;
            }
          }
          fallback.updatePixels();
          raw = fallback;
          rebuildImageAndCache();
        },
      );
    };

    p.draw = () => {
      if (!isReady || !img) {
        p.background(20);
        return;
      }

      pg.background(20);
      pg.noStroke();

      pg.push();
      pg.translate((pg.width - finalW * pixelScale) * 0.5, (pg.height - finalH * pixelScale) * 0.5);

      img.loadPixels();
      const toDraw = Math.min(drawCount, MAX_PIXELS);

      for (let k = 0; k < toDraw; k += 1) {
        const i = drawIdx[k];

        const x = i % finalW;
        const y = Math.floor(i / finalW);

        const px = x * pixelScale;
        const py = y * pixelScale;

        const pOffset = i * 4;
        const r = img.pixels[pOffset];
        const g = img.pixels[pOffset + 1];
        const b = img.pixels[pOffset + 2];

      

        pg.fill(r, g, b);

        if (DRAW_AS_RECTS) {
          pg.rect(px, py, pixelScale, pixelScale);
        } else {
          pg.ellipse(px + pixelScale * 0.5, py + pixelScale * 0.5, pixelScale, pixelScale);
        }
      }

      pg.pop();
      p.image(pg, 0, 0);
    };
  };
}

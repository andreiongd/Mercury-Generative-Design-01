import type p5 from "p5";

type RGB = [number, number, number];

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
};

export type DirectionTwoVariables = {
  pixelScale?: number;
  brightnessOffset?: number;
  contrastFactor?: number;
  stillLifeOffset?: number;
  stackYOffset?: number;
  drawAsRects?: boolean;
  maxPixels?: number;
  shuffleEveryNFrames?: number;
  rngSeed?: number;
  vaseScale?: number;
  stilllifeScale?: number;
  sideScale?: number;
  sideGapPx?: number;
  sideYOffsetPx?: number;
  minCoverage?: number;
};

export type DirectionTwoSketchOptions = {
  width?: number;
  height?: number;
  bottomImagePath: string;
  topImagePath: string;
  sideImagePath?: string;
  variables?: DirectionTwoVariables;
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

export function createDirectionTwoSketch(opts: DirectionTwoSketchOptions) {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1080;
  const vars = opts.variables ?? {};

  const pixelScale = Math.max(1, Math.floor(vars.pixelScale ?? 2));
  const BRIGHTNESS_OFFSET = vars.brightnessOffset ?? -20;
  const CONTRAST_FACTOR = vars.contrastFactor ?? 20;
  // Keep offsets in canvas pixels so composition position is stable across pixelScale changes.
  const STILLLIFE_OFFSET_PX = vars.stillLifeOffset ?? 100;
  const STACK_Y_OFFSET_PX = vars.stackYOffset ?? 80;
  const DRAW_AS_RECTS = vars.drawAsRects ?? false;
  const MAX_PIXELS = Math.max(0, Math.floor(vars.maxPixels ?? 50000));
  const MIN_COVERAGE = Math.max(0, Math.min(1, vars.minCoverage ?? 0.33));
  const SHUFFLE_EVERY_N_FRAMES = Math.max(0, Math.floor(vars.shuffleEveryNFrames ?? 0));
  const RNG_SEED = Math.floor(vars.rngSeed ?? 1337);
  const VASE_SCALE = vars.vaseScale ?? 0.5;
  const STILLLIFE_SCALE = vars.stilllifeScale ?? 0.75;
  const SIDE_SCALE = vars.sideScale ?? 0.52;
  const SIDE_GAP_PX = vars.sideGapPx ?? 34;
  const SIDE_Y_OFFSET_PX = vars.sideYOffsetPx ?? 0;

  const palette: RGB[] = [
    [0, 0, 0],
    [0, 0, 0],
    [66, 133, 244],
    [255, 50, 0],
    [234, 67, 53],
    [180, 288, 5],
    [52, 200, 3],
    [248, 249, 250],

  ];
  const darkestColor = palette[0];

  return (p: p5) => {
    let rawTop: p5.Image | null = null;
    let rawBottom: p5.Image | null = null;
    let rawSide: p5.Image | null = null;
    let imgTop: p5.Image | null = null;
    let imgBottom: p5.Image | null = null;
    let imgSide: p5.Image | null = null;
    let pg: p5.Graphics;

    let finalW = 0;
    let finalH = 0;
    let drawIdxBottom = new Int32Array(0);
    let drawCountBottom = 0;
    let drawIdxTop = new Int32Array(0);
    let drawCountTop = 0;
    let drawIdxSide = new Int32Array(0);
    let drawCountSide = 0;

    let vaseBounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
    let topBounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
    let sideBounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
    let topOffsetX = 0;
    let topOffsetY = 0;
    let sideOffsetX = 0;
    let sideOffsetY = 0;
    let isReady = false;

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
      if (pick[0] === 234 && pick[1] === 67 && pick[2] === 53) {
        return [208, 50, 117];
      }
      if (pick[0] === 66 && pick[1] === 133 && pick[2] === 244) {
        return [82, 102, 235];
      }
      if (pick[0] === 248 && pick[1] === 249 && pick[2] === 250) {
        return [255, 255, 255];
      }
   
      return pick;
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
          const pick = nearestPalette(r[idx], g[idx], b[idx]);
          const oldR = r[idx];
          const oldG = g[idx];
          const oldB = b[idx];
          r[idx] = pick[0];
          g[idx] = pick[1];
          b[idx] = pick[2];

          distribute(x + 1, y, oldR - pick[0], oldG - pick[1], oldB - pick[2], 7 / 16);
          distribute(x - 1, y + 1, oldR - pick[0], oldG - pick[1], oldB - pick[2], 3 / 16);
          distribute(x, y + 1, oldR - pick[0], oldG - pick[1], oldB - pick[2], 5 / 16);
          distribute(x + 1, y + 1, oldR - pick[0], oldG - pick[1], oldB - pick[2], 1 / 16);
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

    const prepareImageWithAspectScaled = (src: p5.Image, scale: number) => {
      const imgAspect = src.width / src.height;
      const canvasAspect = finalW / finalH;

      let baseW = finalW;
      let baseH = finalH;
      if (imgAspect > canvasAspect) {
        baseH = Math.max(1, Math.floor(finalW / imgAspect));
      } else {
        baseW = Math.max(1, Math.floor(finalH * imgAspect));
      }

      let newW = Math.max(1, Math.floor(baseW * scale));
      let newH = Math.max(1, Math.floor(baseH * scale));
      newW = Math.min(newW, finalW);
      newH = Math.min(newH, finalH);

      const scaled = src.get();
      scaled.resize(newW, newH);

      const out = p.createImage(finalW, finalH);
      out.loadPixels();
      for (let i = 0; i < out.pixels.length; i += 4) {
        out.pixels[i] = darkestColor[0];
        out.pixels[i + 1] = darkestColor[1];
        out.pixels[i + 2] = darkestColor[2];
        out.pixels[i + 3] = 255;
      }
      out.updatePixels();

      out.copy(
        scaled,
        0,
        0,
        newW,
        newH,
        Math.floor((finalW - newW) / 2),
        Math.floor((finalH - newH) / 2),
        newW,
        newH,
      );
      return out;
    };

    const computeBBox = (im: p5.Image): Bounds => {
      im.loadPixels();
      let minX = finalW;
      let minY = finalH;
      let maxX = -1;
      let maxY = -1;

      for (let px = 0; px < im.pixels.length; px += 4) {
        const r = im.pixels[px];
        const g = im.pixels[px + 1];
        const b = im.pixels[px + 2];
        if (isDarkest(r, g, b)) continue;
        const i = px / 4;
        const x = i % finalW;
        const y = Math.floor(i / finalW);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }

      if (maxX < 0) {
        minX = 0;
        minY = 0;
        maxX = 0;
        maxY = 0;
      }

      return {
        minX,
        minY,
        maxX,
        maxY,
        centerX: Math.floor((minX + maxX) / 2),
        centerY: Math.floor((minY + maxY) / 2),
      };
    };

    const buildTopCache = () => {
      if (!imgTop) {
        drawIdxTop = new Int32Array(0);
        drawCountTop = 0;
        return;
      }
      imgTop.loadPixels();
      const indices: number[] = [];
      for (let px = 0; px < imgTop.pixels.length; px += 4) {
        const r = imgTop.pixels[px];
        const g = imgTop.pixels[px + 1];
        const b = imgTop.pixels[px + 2];
        if (!isDarkest(r, g, b)) indices.push(px / 4);
      }
      drawIdxTop = Int32Array.from(indices);
      drawCountTop = drawIdxTop.length;
    };

    const buildBottomCache = () => {
      if (!imgBottom) {
        drawIdxBottom = new Int32Array(0);
        drawCountBottom = 0;
        return;
      }
      imgBottom.loadPixels();
      const indices: number[] = [];
      for (let px = 0; px < imgBottom.pixels.length; px += 4) {
        const r = imgBottom.pixels[px];
        const g = imgBottom.pixels[px + 1];
        const b = imgBottom.pixels[px + 2];
        if (!isDarkest(r, g, b)) indices.push(px / 4);
      }
      drawIdxBottom = Int32Array.from(indices);
      drawCountBottom = drawIdxBottom.length;
    };

    const buildSideCache = () => {
      if (!imgSide) {
        drawIdxSide = new Int32Array(0);
        drawCountSide = 0;
        return;
      }
      imgSide.loadPixels();
      const indices: number[] = [];
      for (let px = 0; px < imgSide.pixels.length; px += 4) {
        const r = imgSide.pixels[px];
        const g = imgSide.pixels[px + 1];
        const b = imgSide.pixels[px + 2];
        if (!isDarkest(r, g, b)) indices.push(px / 4);
      }
      drawIdxSide = Int32Array.from(indices);
      drawCountSide = drawIdxSide.length;
    };

    const shuffleDrawIdxBottom = (frameCount: number) => {
      if (drawIdxBottom.length === 0) return;
      const rand = mulberry32((RNG_SEED ^ 0x9e3779b9 ^ frameCount * 8191) >>> 0);
      for (let i = drawIdxBottom.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = drawIdxBottom[i];
        drawIdxBottom[i] = drawIdxBottom[j];
        drawIdxBottom[j] = tmp;
      }
    };

    const shuffleDrawIdxTop = (frameCount: number) => {
      if (drawIdxTop.length === 0) return;
      const rand = mulberry32((RNG_SEED + frameCount * 10007) >>> 0);
      for (let i = drawIdxTop.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = drawIdxTop[i];
        drawIdxTop[i] = drawIdxTop[j];
        drawIdxTop[j] = tmp;
      }
    };

    const shuffleDrawIdxSide = (frameCount: number) => {
      if (drawIdxSide.length === 0) return;
      const rand = mulberry32((RNG_SEED ^ 0x517cc1b7 ^ frameCount * 12289) >>> 0);
      for (let i = drawIdxSide.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = drawIdxSide[i];
        drawIdxSide[i] = drawIdxSide[j];
        drawIdxSide[j] = tmp;
      }
    };

    const rebuildImagesAndCaches = () => {
      if (!rawTop || !rawBottom) return;

      finalW = Math.max(1, Math.floor(width / pixelScale));
      finalH = Math.max(1, Math.floor(height / pixelScale));

      imgBottom = prepareImageWithAspectScaled(rawBottom, VASE_SCALE);
      adjustBrightness(imgBottom, BRIGHTNESS_OFFSET);
      adjustContrast(imgBottom, CONTRAST_FACTOR);
      applyDither(imgBottom);

      imgTop = prepareImageWithAspectScaled(rawTop, STILLLIFE_SCALE);
      adjustBrightness(imgTop, BRIGHTNESS_OFFSET);
      adjustContrast(imgTop, CONTRAST_FACTOR);
      applyDither(imgTop);

      if (rawSide) {
        imgSide = prepareImageWithAspectScaled(rawSide, SIDE_SCALE);
        adjustBrightness(imgSide, BRIGHTNESS_OFFSET);
        adjustContrast(imgSide, CONTRAST_FACTOR);
        applyDither(imgSide);
      } else {
        imgSide = null;
      }

      buildBottomCache();
      buildTopCache();
      buildSideCache();
      vaseBounds = computeBBox(imgBottom);
      topBounds = computeBBox(imgTop);
      if (imgSide) {
        sideBounds = computeBBox(imgSide);
      } else {
        sideBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0, centerY: 0 };
      }

      topOffsetX = vaseBounds.centerX - topBounds.centerX;
      topOffsetY = vaseBounds.minY - topBounds.maxY + STILLLIFE_OFFSET_PX / pixelScale;
      if (imgSide) {
        const stilllifeMaxX = topBounds.maxX + topOffsetX;
        const groupMaxX = Math.max(vaseBounds.maxX, stilllifeMaxX);
        sideOffsetX = groupMaxX + SIDE_GAP_PX / pixelScale - sideBounds.minX;
        sideOffsetY = vaseBounds.centerY - sideBounds.centerY + SIDE_Y_OFFSET_PX / pixelScale;
      } else {
        sideOffsetX = 0;
        sideOffsetY = 0;
      }

      // Shuffle once for a seeded randomized composition, then keep static unless explicitly animated.
      shuffleDrawIdxBottom(0);
      shuffleDrawIdxTop(0);
      shuffleDrawIdxSide(0);
      isReady = true;
    };

    const drawBottomWithCap = (toDraw: number) => {
      if (!imgBottom) return;
      imgBottom.loadPixels();

      for (let k = 0; k < toDraw; k += 1) {
        const i = drawIdxBottom[k];
        const pxIdx = i * 4;
        const r = imgBottom.pixels[pxIdx];
        const g = imgBottom.pixels[pxIdx + 1];
        const b = imgBottom.pixels[pxIdx + 2];
        const x = i % finalW;
        const y = Math.floor(i / finalW);
        const drawX = x * pixelScale;
        const drawY = y * pixelScale;

        pg.fill(r, g, b);

        if (DRAW_AS_RECTS) {
          pg.rect(drawX, drawY, pixelScale, pixelScale);
        } else {
          pg.ellipse(drawX + pixelScale * 0.5, drawY + pixelScale * 0.5, pixelScale, pixelScale);
        }
      }
    };

    const drawTopWithCapAndOffset = (toDraw: number) => {
      if (!imgTop) return;
      imgTop.loadPixels();

      for (let k = 0; k < toDraw; k += 1) {
        const i = drawIdxTop[k];
        const pxIdx = i * 4;
        const r = imgTop.pixels[pxIdx];
        const g = imgTop.pixels[pxIdx + 1];
        const b = imgTop.pixels[pxIdx + 2];

        const x = (i % finalW) + topOffsetX;
        const y = Math.floor(i / finalW) + topOffsetY;
        const drawX = x * pixelScale;
        const drawY = y * pixelScale;

        pg.fill(r, g, b);
        if (DRAW_AS_RECTS) {
          pg.rect(drawX, drawY, pixelScale, pixelScale);
        } else {
          pg.ellipse(drawX + pixelScale * 0.5, drawY + pixelScale * 0.5, pixelScale, pixelScale);
        }
      }
    };

    const drawSideWithCapAndOffset = (toDraw: number) => {
      if (!imgSide) return;
      imgSide.loadPixels();

      for (let k = 0; k < toDraw; k += 1) {
        const i = drawIdxSide[k];
        const pxIdx = i * 4;
        const r = imgSide.pixels[pxIdx];
        const g = imgSide.pixels[pxIdx + 1];
        const b = imgSide.pixels[pxIdx + 2];

        const x = (i % finalW) + sideOffsetX;
        const y = Math.floor(i / finalW) + sideOffsetY;
        const drawX = x * pixelScale;
        const drawY = y * pixelScale;

        pg.fill(r, g, b);
        if (DRAW_AS_RECTS) {
          pg.rect(drawX, drawY, pixelScale, pixelScale);
        } else {
          pg.ellipse(drawX + pixelScale * 0.5, drawY + pixelScale * 0.5, pixelScale, pixelScale);
        }
      }
    };

    p.setup = () => {
      p.createCanvas(width, height);
      p.pixelDensity(1);
      p.frameRate(30);
      p.noSmooth();
      p.colorMode(p.RGB, 255);

      pg = p.createGraphics(width, height);
      pg.pixelDensity(1);
      pg.noSmooth();

      let remaining = opts.sideImagePath ? 3 : 2;
      const done = () => {
        remaining -= 1;
        if (remaining > 0) return;
        rebuildImagesAndCaches();
      };

      p.loadImage(
        opts.bottomImagePath,
        (loaded) => {
          rawBottom = loaded;
          done();
        },
        () => {
          rawBottom = p.createImage(20, 20);
          done();
        },
      );

      p.loadImage(
        opts.topImagePath,
        (loaded) => {
          rawTop = loaded;
          done();
        },
        () => {
          rawTop = p.createImage(20, 20);
          done();
        },
      );

      if (opts.sideImagePath) {
        p.loadImage(
          opts.sideImagePath,
          (loaded) => {
            rawSide = loaded;
            done();
          },
          () => {
            rawSide = null;
            done();
          },
        );
      }
    };

    p.draw = () => {
      if (!isReady) {
        p.background("#171721");
        return;
      }

      if (SHUFFLE_EVERY_N_FRAMES > 0 && p.frameCount % SHUFFLE_EVERY_N_FRAMES === 0) {
        shuffleDrawIdxBottom(p.frameCount);
        shuffleDrawIdxTop(p.frameCount);
        shuffleDrawIdxSide(p.frameCount);
      }

      pg.background("#171721");
      pg.noStroke();
      pg.push();
      pg.translate(
        (pg.width - finalW * pixelScale) * 0.5,
        (pg.height - finalH * pixelScale) * 0.5 + STACK_Y_OFFSET_PX,
      );

      const totalDrawable = drawCountBottom + drawCountTop + drawCountSide;
      const minBudget = Math.floor(totalDrawable * MIN_COVERAGE);
      const totalBudget = Math.min(totalDrawable, Math.max(MAX_PIXELS, minBudget));

      let bottomBudget = 0;
      let topBudget = 0;
      let sideBudget = 0;
      if (totalDrawable > 0 && totalBudget > 0) {
        const bottomShare = drawCountBottom / totalDrawable;
        const topShare = drawCountTop / totalDrawable;
        const sideShare = drawCountSide / totalDrawable;
        bottomBudget = Math.min(drawCountBottom, Math.floor(totalBudget * bottomShare));
        topBudget = Math.min(drawCountTop, Math.floor(totalBudget * topShare));
        sideBudget = Math.min(drawCountSide, Math.floor(totalBudget * sideShare));

        const remaining = totalBudget - (bottomBudget + topBudget + sideBudget);
        if (remaining > 0) {
          const addBottom = Math.min(remaining, Math.max(0, drawCountBottom - bottomBudget));
          bottomBudget += addBottom;
          let remain2 = remaining - addBottom;
          const addTop = Math.min(remain2, Math.max(0, drawCountTop - topBudget));
          topBudget += addTop;
          remain2 -= addTop;
          sideBudget += Math.min(remain2, Math.max(0, drawCountSide - sideBudget));
        }
      }

      drawBottomWithCap(bottomBudget);
      drawTopWithCapAndOffset(topBudget);
      drawSideWithCapAndOffset(sideBudget);

      pg.pop();
      p.image(pg, 0, 0);
    };
  };
}

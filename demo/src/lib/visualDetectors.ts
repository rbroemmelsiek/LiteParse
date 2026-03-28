import sharp from "sharp";

export type VisualItemKind = "blank_line" | "checkbox" | "input_box";

export interface VisualItem {
  kind: VisualItemKind;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toPdfBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
  pdfWidth: number,
  pdfHeight: number,
) {
  return {
    x: (box.x / imageWidth) * pdfWidth,
    y: (box.y / imageHeight) * pdfHeight,
    width: (box.width / imageWidth) * pdfWidth,
    height: (box.height / imageHeight) * pdfHeight,
  };
}

function iou(a: PixelBox, b: PixelBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return inter / union;
}

function dedupeBoxes<T extends { box: PixelBox }>(items: T[], threshold = 0.7): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const hasNearDuplicate = kept.some((k) => iou(k.box, item.box) > threshold);
    if (!hasNearDuplicate) kept.push(item);
  }
  return kept;
}

export async function detectVisualItemsFromScreenshot(input: {
  imageBuffer: Buffer;
  imageWidth: number;
  imageHeight: number;
  pdfWidth: number;
  pdfHeight: number;
}) {
  const { imageBuffer, imageWidth, imageHeight, pdfWidth, pdfHeight } = input;
  const { data, info } = await sharp(imageBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const gray = data;
  const dark = new Uint8Array(width * height);
  const threshold = 90;
  for (let i = 0; i < gray.length; i += 1) {
    dark[i] = gray[i] < threshold ? 1 : 0;
  }

  const blankLineCandidates: Array<{ box: PixelBox; confidence: number }> = [];
  const minLineLength = Math.max(80, Math.floor(width * 0.12));

  for (let y = 0; y < height; y += 1) {
    let x = 0;
    while (x < width) {
      while (x < width && dark[y * width + x] === 0) x += 1;
      if (x >= width) break;
      const start = x;
      while (x < width && dark[y * width + x] === 1) x += 1;
      const runLen = x - start;
      if (runLen >= minLineLength) {
        const bandTop = Math.max(0, y - 1);
        const bandBottom = Math.min(height - 1, y + 1);
        let darkCount = 0;
        for (let yy = bandTop; yy <= bandBottom; yy += 1) {
          for (let xx = start; xx < x; xx += 1) {
            darkCount += dark[yy * width + xx];
          }
        }
        const bandArea = (bandBottom - bandTop + 1) * runLen;
        const density = darkCount / bandArea;
        if (density > 0.45 && density < 0.98) {
          blankLineCandidates.push({
            box: {
              x: start,
              y: Math.max(0, y - 1),
              width: runLen,
              height: Math.min(3, height - y),
            },
            confidence: Math.min(0.95, 0.55 + runLen / width),
          });
        }
      }
    }
  }

  const visited = new Uint8Array(width * height);
  const checkboxCandidates: Array<{ box: PixelBox; confidence: number }> = [];
  const inputBoxCandidates: Array<{ box: PixelBox; confidence: number }> = [];
  const queue = new Int32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIdx = y * width + x;
      if (dark[startIdx] === 0 || visited[startIdx] === 1) continue;

      let head = 0;
      let tail = 0;
      queue[tail++] = startIdx;
      visited[startIdx] = 1;

      let count = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;

      while (head < tail) {
        const idx = queue[head++];
        const cx = idx % width;
        const cy = Math.floor(idx / width);
        count += 1;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          idx - 1,
          idx + 1,
          idx - width,
          idx + width,
        ];
        for (const n of neighbors) {
          if (n < 0 || n >= dark.length) continue;
          const nx = n % width;
          const ny = Math.floor(n / width);
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          if (dark[n] === 0 || visited[n] === 1) continue;
          visited[n] = 1;
          queue[tail++] = n;
        }
      }

      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      if (boxW < 6 || boxH < 6) continue;
      const area = boxW * boxH;
      const fillRatio = count / area;
      const aspect = boxW / boxH;

      if (boxW >= 10 && boxW <= 90 && boxH >= 10 && boxH <= 90 && aspect > 0.7 && aspect < 1.35) {
        if (fillRatio > 0.07 && fillRatio < 0.5) {
          checkboxCandidates.push({
            box: { x: minX, y: minY, width: boxW, height: boxH },
            confidence: Math.min(0.97, 0.45 + (1 - Math.abs(1 - aspect)) * 0.4),
          });
        }
      }

      if (boxW >= 60 && boxW <= Math.floor(width * 0.8) && boxH >= 12 && boxH <= 90 && aspect > 1.8) {
        if (fillRatio > 0.04 && fillRatio < 0.35) {
          inputBoxCandidates.push({
            box: { x: minX, y: minY, width: boxW, height: boxH },
            confidence: Math.min(0.94, 0.4 + Math.min(0.45, boxW / width)),
          });
        }
      }
    }
  }

  const mergedBlankLines = dedupeBoxes(blankLineCandidates);
  const mergedCheckboxes = dedupeBoxes(checkboxCandidates);
  const mergedInputBoxes = dedupeBoxes(inputBoxCandidates);

  const visualItems: VisualItem[] = [
    ...mergedBlankLines.map((item) => ({
      kind: "blank_line" as const,
      ...toPdfBox(item.box, imageWidth, imageHeight, pdfWidth, pdfHeight),
      confidence: Number(item.confidence.toFixed(3)),
    })),
    ...mergedCheckboxes.map((item) => ({
      kind: "checkbox" as const,
      ...toPdfBox(item.box, imageWidth, imageHeight, pdfWidth, pdfHeight),
      confidence: Number(item.confidence.toFixed(3)),
    })),
    ...mergedInputBoxes.map((item) => ({
      kind: "input_box" as const,
      ...toPdfBox(item.box, imageWidth, imageHeight, pdfWidth, pdfHeight),
      confidence: Number(item.confidence.toFixed(3)),
    })),
  ];

  visualItems.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  return visualItems.slice(0, 180);
}

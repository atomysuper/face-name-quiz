import {
  FaceDetector,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

import { getPublicEnv } from '@/lib/env';
import type { BoundingBox, DetectedCrop } from '@/lib/types';

let detectorPromise: Promise<FaceDetector> | null = null;

const TILE_CONFIGS = [
  { columns: 1, rows: 1, overlap: 0 },
  { columns: 2, rows: 2, overlap: 0.18 },
  { columns: 3, rows: 2, overlap: 0.2 },
] as const;

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('crop 이미지 생성에 실패했습니다.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function clampBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.max(1, Math.min(imageWidth - x, Math.floor(box.w)));
  const h = Math.max(1, Math.min(imageHeight - y, Math.floor(box.h)));
  return { x, y, w, h };
}

function expandBoundingBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  const padX = Math.max(box.w * 0.22, 18);
  const padY = Math.max(box.h * 0.34, 22);

  return clampBox(
    {
      x: box.x - padX,
      y: box.y - padY,
      w: box.w + padX * 2,
      h: box.h + padY * 2,
    },
    imageWidth,
    imageHeight,
  );
}

function intersectionOverUnion(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection <= 0) {
    return 0;
  }

  const areaA = a.w * a.h;
  const areaB = b.w * b.h;
  const union = areaA + areaB - intersection;
  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

function dedupeBoxes(boxes: BoundingBox[]): BoundingBox[] {
  const sorted = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);
  const kept: BoundingBox[] = [];

  for (const box of sorted) {
    const duplicate = kept.some((target) => intersectionOverUnion(box, target) >= 0.42);
    if (!duplicate) {
      kept.push(box);
    }
  }

  return kept.sort((a, b) => {
    const topDiff = a.y - b.y;
    if (Math.abs(topDiff) > 24) {
      return topDiff;
    }
    return a.x - b.x;
  });
}

function extractBoxesFromCanvas(
  detector: FaceDetector,
  canvas: HTMLCanvasElement,
  offsetX: number,
  offsetY: number,
  sourceWidth: number,
  sourceHeight: number,
): BoundingBox[] {
  const result = detector.detect(canvas);

  return (result.detections ?? [])
    .map((detection) => detection.boundingBox)
    .filter(Boolean)
    .map((box) =>
      expandBoundingBox(
        {
          x: (box!.originX / canvas.width) * sourceWidth + offsetX,
          y: (box!.originY / canvas.height) * sourceHeight + offsetY,
          w: (box!.width / canvas.width) * sourceWidth,
          h: (box!.height / canvas.height) * sourceHeight,
        },
        sourceWidth + offsetX,
        sourceHeight + offsetY,
      ),
    );
}

function cropFromBox(image: HTMLImageElement, box: BoundingBox) {
  const canvas = document.createElement('canvas');
  canvas.width = box.w;
  canvas.height = box.h;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('crop 캔버스를 만들지 못했습니다.');
  }

  context.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return canvas;
}

async function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    const { wasmRoot, modelPath } = getPublicEnv();

    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.35,
        minSuppressionThreshold: 0.2,
      });
    })();
  }

  return detectorPromise;
}

function detectBoxes(detector: FaceDetector, image: HTMLImageElement): BoundingBox[] {
  const workingCanvas = document.createElement('canvas');
  const workingContext = workingCanvas.getContext('2d');

  if (!workingContext) {
    throw new Error('작업용 캔버스를 만들지 못했습니다.');
  }

  const allBoxes: BoundingBox[] = [];

  for (const config of TILE_CONFIGS) {
    const tileWidth = image.naturalWidth / config.columns;
    const tileHeight = image.naturalHeight / config.rows;
    const stepX = tileWidth * (1 - config.overlap);
    const stepY = tileHeight * (1 - config.overlap);

    for (let top = 0; top < image.naturalHeight; top += stepY) {
      const sourceY = Math.min(top, image.naturalHeight - tileHeight);
      if (sourceY < 0) {
        continue;
      }

      for (let left = 0; left < image.naturalWidth; left += stepX) {
        const sourceX = Math.min(left, image.naturalWidth - tileWidth);
        if (sourceX < 0) {
          continue;
        }

        workingCanvas.width = Math.max(1, Math.round(tileWidth));
        workingCanvas.height = Math.max(1, Math.round(tileHeight));
        workingContext.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
        workingContext.drawImage(
          image,
          sourceX,
          sourceY,
          tileWidth,
          tileHeight,
          0,
          0,
          workingCanvas.width,
          workingCanvas.height,
        );

        allBoxes.push(
          ...extractBoxesFromCanvas(
            detector,
            workingCanvas,
            Math.round(sourceX),
            Math.round(sourceY),
            Math.round(tileWidth),
            Math.round(tileHeight),
          ),
        );

        if (sourceX + tileWidth >= image.naturalWidth) {
          break;
        }
      }

      if (sourceY + tileHeight >= image.naturalHeight) {
        break;
      }
    }
  }

  return dedupeBoxes(
    allBoxes.map((box) => clampBox(box, image.naturalWidth, image.naturalHeight)),
  );
}

export async function createManualCrop(
  file: File,
  box: BoundingBox,
): Promise<DetectedCrop> {
  const image = await fileToImage(file);
  const safeBox = clampBox(box, image.naturalWidth, image.naturalHeight);
  const canvas = cropFromBox(image, safeBox);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);

  return {
    id: crypto.randomUUID(),
    bbox: safeBox,
    blob,
    previewUrl: URL.createObjectURL(blob),
    source: 'manual',
  };
}

export async function detectAndCropFaces(file: File): Promise<DetectedCrop[]> {
  const detector = await getDetector();
  const image = await fileToImage(file);
  const boxes = detectBoxes(detector, image);

  const crops: DetectedCrop[] = [];

  for (const box of boxes) {
    const canvas = cropFromBox(image, box);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);

    crops.push({
      id: crypto.randomUUID(),
      bbox: box,
      blob,
      previewUrl: URL.createObjectURL(blob),
      source: 'auto',
    });
  }

  return crops;
}

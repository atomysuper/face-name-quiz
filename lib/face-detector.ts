import {
  FaceDetector,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

import { getPublicEnv } from '@/lib/env';
import type { BoundingBox, DetectedCrop } from '@/lib/types';

let detectorPromise: Promise<FaceDetector> | null = null;

// 타일을 이 해상도로 렌더해서 작은 얼굴도 크게 보이게 합니다
const TILE_RENDER_SIZE = 640;

// 업로드 사진을 이 크기 이하로 줄인 뒤 인식을 시작합니다 (속도·메모리 최적화)
const MAX_UPLOAD_DIMENSION = 2400;

// 촘촘한 타일 설정으로 단체사진의 작은 얼굴도 놓치지 않습니다
// 6×6 설정이 30명 이상 단체사진에서 핵심 역할을 합니다
const TILE_CONFIGS = [
  { columns: 1, rows: 1, overlap: 0 },
  { columns: 2, rows: 2, overlap: 0.15 },
  { columns: 3, rows: 3, overlap: 0.18 },
  { columns: 6, rows: 6, overlap: 0.1 },
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

export async function resizeImageFile(file: File): Promise<{ file: File; originalWidth: number; originalHeight: number }> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }

  const { naturalWidth: w, naturalHeight: h } = image;

  if (w <= MAX_UPLOAD_DIMENSION && h <= MAX_UPLOAD_DIMENSION) {
    return { file, originalWidth: w, originalHeight: h };
  }

  const scale = Math.min(MAX_UPLOAD_DIMENSION / w, MAX_UPLOAD_DIMENSION / h);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, originalWidth: w, originalHeight: h };
  ctx.drawImage(image, 0, 0, newW, newH);

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  const resized = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  return { file: resized, originalWidth: w, originalHeight: h };
}

function clampBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const w = Math.max(1, Math.min(imageWidth - x, Math.floor(box.w)));
  const h = Math.max(1, Math.min(imageHeight - y, Math.floor(box.h)));
  return { x, y, w, h };
}

function expandBoundingBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  // 귀 포함 tight 박스(≈귀~귀 너비, 눈~입 높이) 기준
  // 위쪽: 눈 위로 머리카락까지 포함하려면 150%
  // 아래쪽: 턱 + 목 약간
  // 좌우: 귀가 이미 포함돼 있으므로 10%만 추가
  const padLeft   = Math.max(box.w * 0.10, 10);
  const padRight  = Math.max(box.w * 0.10, 10);
  const padTop    = Math.max(box.h * 1.50, 30);
  const padBottom = Math.max(box.h * 0.60, 20);

  let expanded = clampBox(
    {
      x: box.x - padLeft,
      y: box.y - padTop,
      w: box.w + padLeft + padRight,
      h: box.h + padTop + padBottom,
    },
    imageWidth,
    imageHeight,
  );

  // 3:4 (가로:세로) 비율로 맞추기 — 중심 고정, 짧은 쪽을 늘림
  const TARGET_RATIO = 3 / 4;
  const cx = expanded.x + expanded.w / 2;
  const cy = expanded.y + expanded.h / 2;
  const currentRatio = expanded.w / expanded.h;

  if (currentRatio > TARGET_RATIO) {
    // 가로가 상대적으로 넓으면 세로를 늘림
    const newH = expanded.w / TARGET_RATIO;
    expanded = clampBox({ x: expanded.x, y: cy - newH / 2, w: expanded.w, h: newH }, imageWidth, imageHeight);
  } else {
    // 세로가 상대적으로 길면 가로를 늘림
    const newW = expanded.h * TARGET_RATIO;
    expanded = clampBox({ x: cx - newW / 2, y: expanded.y, w: newW, h: expanded.h }, imageWidth, imageHeight);
  }

  return expanded;
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
    const duplicate = kept.some((target) => intersectionOverUnion(box, target) >= 0.28);
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
  // MediaPipe/TFLite가 "INFO: ..." 메시지를 console.error로 출력합니다.
  // Next.js 개발 오버레이가 이를 에러로 잡아 표시하므로, 감지 중에만 잠시 억제합니다.
  const originalConsoleError = console.error;
  console.error = () => {};
  let result;
  try {
    result = detector.detect(canvas);
  } finally {
    console.error = originalConsoleError;
  }

  // 여기서는 패딩 없이 원시 좌표만 반환합니다.
  // expandBoundingBox는 전체 이미지 크기를 알 수 있는 detectBoxes 에서 적용합니다.
  return (result.detections ?? [])
    .map((detection) => {
      // 눈(0,1)·코(2)·입(3) 4개가 모두 있어야 유효한 얼굴로 인식
      const kps = detection.keypoints;
      if (!kps || kps.length < 4) return null;
      // 귀(4,5)까지 포함해 귀~귀 너비를 tight 박스에 반영
      const facePts = kps.slice(0, Math.min(kps.length, 6));
      const xs = facePts.map((kp) => kp.x * canvas.width);
      const ys = facePts.map((kp) => kp.y * canvas.height);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      return {
        x: (x0 / canvas.width) * sourceWidth + offsetX,
        y: (y0 / canvas.height) * sourceHeight + offsetY,
        w: ((x1 - x0) / canvas.width) * sourceWidth,
        h: ((y1 - y0) / canvas.height) * sourceHeight,
      };
    })
    .filter(Boolean) as BoundingBox[];
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
        minDetectionConfidence: 0.45,
        minSuppressionThreshold: 0.25,
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

        // 고정 해상도로 렌더하면 작은 얼굴도 모델 입력에서 크게 보입니다
        workingCanvas.width = TILE_RENDER_SIZE;
        workingCanvas.height = TILE_RENDER_SIZE;
        workingContext.clearRect(0, 0, TILE_RENDER_SIZE, TILE_RENDER_SIZE);
        workingContext.drawImage(
          image,
          sourceX,
          sourceY,
          tileWidth,
          tileHeight,
          0,
          0,
          TILE_RENDER_SIZE,
          TILE_RENDER_SIZE,
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

  // 전체 이미지 기준으로 클램프 후 중복 제거 (원시 박스 기준으로 dedupe가 더 정확)
  const rawClamped = allBoxes.map((box) =>
    clampBox(box, image.naturalWidth, image.naturalHeight),
  );
  const deduped = dedupeBoxes(rawClamped);

  // 중복 제거 후 전체 이미지 크기를 알고 expandBoundingBox 적용
  return deduped.map((box) =>
    clampBox(
      expandBoundingBox(box, image.naturalWidth, image.naturalHeight),
      image.naturalWidth,
      image.naturalHeight,
    ),
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

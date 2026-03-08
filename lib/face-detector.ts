import {
  FaceDetector,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

import { getPublicEnv } from '@/lib/env';
import type { BoundingBox, DetectedCrop } from '@/lib/types';

let detectorPromise: Promise<FaceDetector> | null = null;

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

function expandBoundingBox(box: BoundingBox, imageWidth: number, imageHeight: number): BoundingBox {
  const padX = box.w * 0.18;
  const padY = box.h * 0.28;

  const x = Math.max(0, Math.floor(box.x - padX));
  const y = Math.max(0, Math.floor(box.y - padY));
  const w = Math.min(imageWidth - x, Math.floor(box.w + padX * 2));
  const h = Math.min(imageHeight - y, Math.floor(box.h + padY * 2));

  return { x, y, w, h };
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
        minDetectionConfidence: 0.55,
        minSuppressionThreshold: 0.3,
      });
    })();
  }

  return detectorPromise;
}

export async function detectAndCropFaces(file: File): Promise<DetectedCrop[]> {
  const detector = await getDetector();
  const image = await fileToImage(file);
  const result = detector.detect(image);

  const crops: DetectedCrop[] = [];

  for (const detection of result.detections ?? []) {
    const box = detection.boundingBox;

    if (!box) {
      continue;
    }

    const expanded = expandBoundingBox(
      {
        x: box.originX,
        y: box.originY,
        w: box.width,
        h: box.height,
      },
      image.naturalWidth,
      image.naturalHeight,
    );

    const canvas = document.createElement('canvas');
    canvas.width = expanded.w;
    canvas.height = expanded.h;

    const context = canvas.getContext('2d');

    if (!context) {
      continue;
    }

    context.drawImage(
      image,
      expanded.x,
      expanded.y,
      expanded.w,
      expanded.h,
      0,
      0,
      expanded.w,
      expanded.h,
    );

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);

    crops.push({
      id: crypto.randomUUID(),
      bbox: expanded,
      blob,
      previewUrl: URL.createObjectURL(blob),
    });
  }

  return crops;
}

"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { createManualCrop, detectAndCropFaces } from '@/lib/face-detector';
import type { BoundingBox, DetectedCrop, ImportFacePayload } from '@/lib/types';
import { clamp, sanitizeFileSegment, toErrorMessage } from '@/lib/utils';

function fileNameWithoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

function normalizeDragToBox(drag: DragState, width: number, height: number): BoundingBox {
  const left = clamp(Math.min(drag.startX, drag.currentX), 0, width);
  const top = clamp(Math.min(drag.startY, drag.currentY), 0, height);
  const right = clamp(Math.max(drag.startX, drag.currentX), 0, width);
  const bottom = clamp(Math.max(drag.startY, drag.currentY), 0, height);

  return {
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
  };
}

function overlaps(a: BoundingBox, b: BoundingBox) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x1 && y2 > y1;
}

export function PhotoImporter() {
  const [label, setLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [crops, setCrops] = useState<DetectedCrop[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropsRef = useRef<DetectedCrop[]>([]);

  useEffect(() => {
    cropsRef.current = crops;
  }, [crops]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    return () => {
      for (const crop of cropsRef.current) {
        URL.revokeObjectURL(crop.previewUrl);
      }
    };
  }, []);

  const activeCrops = crops;
  const draftBox = useMemo(() => {
    if (!dragState || !imageSize) {
      return null;
    }
    return normalizeDragToBox(dragState, imageSize.width, imageSize.height);
  }, [dragState, imageSize]);

  function clearCurrentResources() {
    if (photoPreviewUrl) {
      URL.revokeObjectURL(photoPreviewUrl);
    }

    for (const crop of cropsRef.current) {
      URL.revokeObjectURL(crop.previewUrl);
    }

    setCrops([]);
    setDragState(null);
    setImageSize(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setDetecting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      clearCurrentResources();
      setSelectedFile(file);
      setLabel(fileNameWithoutExtension(file.name));
      setPhotoPreviewUrl(URL.createObjectURL(file));

      const detected = await detectAndCropFaces(file);
      setCrops(detected);

      if (detected.length === 0) {
        setMessage('자동 인식이 약했습니다. 아래 원본 사진에서 수동 추가 모드를 켜고 얼굴 박스를 직접 그려주세요.');
        setManualMode(true);
      } else {
        const manualHint = '부족한 얼굴은 수동 추가 모드로 직접 박스를 그리면 됩니다.';
        setMessage(`${detected.length}개의 얼굴을 자동 추출했습니다. ${manualHint}`);
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      setCrops([]);
    } finally {
      setDetecting(false);
    }
  }

  function handleRemoveCrop(cropId: string) {
    setCrops((current) => {
      const target = current.find((crop) => crop.id === cropId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((crop) => crop.id !== cropId);
    });
  }

  function getRelativePosition(event: React.PointerEvent<HTMLDivElement>) {
    const image = imageRef.current;
    if (!image) {
      return null;
    }

    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height || !image.naturalWidth || !image.naturalHeight) {
      return null;
    }

    const scaleX = image.naturalWidth / rect.width;
    const scaleY = image.naturalHeight / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    return {
      x: clamp(x, 0, image.naturalWidth),
      y: clamp(y, 0, image.naturalHeight),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!manualMode || !imageSize) {
      return;
    }

    event.preventDefault();

    const point = getRelativePosition(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) {
      return;
    }

    event.preventDefault();

    const point = getRelativePosition(event);
    if (!point) {
      return;
    }

    setDragState((current) =>
      current
        ? {
            ...current,
            currentX: point.x,
            currentY: point.y,
          }
        : current,
    );
  }

  async function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragState || !selectedFile || !imageSize) {
      setDragState(null);
      return;
    }

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const point = getRelativePosition(event);
    const completedDrag = {
      ...dragState,
      currentX: point?.x ?? dragState.currentX,
      currentY: point?.y ?? dragState.currentY,
    };
    const nextBox = normalizeDragToBox(completedDrag, imageSize.width, imageSize.height);
    setDragState(null);

    if (nextBox.w < 50 || nextBox.h < 50) {
      setMessage('박스가 너무 작습니다. 얼굴보다 조금 넉넉하게 다시 그려주세요.');
      return;
    }

    try {
      const manualCrop = await createManualCrop(selectedFile, nextBox);
      setCrops((current) => {
        const filtered = current.filter((crop) => !overlaps(crop.bbox, nextBox));
        return [...filtered, manualCrop];
      });
      setMessage('수동 박스를 추가했습니다. 겹치는 자동 박스는 새 박스로 교체했습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function handleRerunDetection() {
    if (!selectedFile) {
      return;
    }

    setDetecting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const detected = await detectAndCropFaces(selectedFile);
      setCrops((current) => {
        const manualOnly = current.filter((crop) => crop.source === 'manual');
        for (const autoCrop of current.filter((crop) => crop.source === 'auto')) {
          URL.revokeObjectURL(autoCrop.previewUrl);
        }
        return [...detected, ...manualOnly];
      });
      setMessage(`자동 인식을 다시 실행했습니다. 현재 ${detected.length}개의 자동 얼굴이 있습니다.`);
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) {
      setErrorMessage('먼저 단체사진을 선택해주세요.');
      return;
    }

    if (activeCrops.length === 0) {
      setErrorMessage('저장할 얼굴 crop이 없습니다. 자동 인식이 부족하면 수동으로 박스를 추가해주세요.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('label', label.trim() || sanitizeFileSegment(selectedFile.name));
      formData.append('photo', selectedFile);

      const faceMetadata: ImportFacePayload[] = activeCrops.map((crop, index) => {
        const fieldName = `crop-${index}`;
        formData.append(
          fieldName,
          new File([crop.blob], `${fieldName}.jpg`, { type: 'image/jpeg' }),
        );

        return {
          bbox: crop.bbox,
          fieldName,
          index,
        };
      });

      formData.append('faces', JSON.stringify(faceMetadata));

      const response = await fetch('/api/admin/import-photo', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? '업로드 저장에 실패했습니다.');
      }

      setMessage(
        `저장 완료: 사진 1장, 얼굴 ${payload.faceCount ?? activeCrops.length}개를 등록했습니다. 같은 사람은 나중에 검토 화면에서 같은 이름으로 연결하면 여러 사진이 한 사람으로 묶입니다.`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function renderOverlayBox(box: BoundingBox, key: string, tone: 'auto' | 'manual' | 'draft') {
    if (!imageSize) {
      return null;
    }

    const color = tone === 'manual' ? 'rgba(20,127,80,0.95)' : tone === 'draft' ? 'rgba(217,72,95,0.95)' : 'rgba(34,103,255,0.95)';
    const background = tone === 'manual' ? 'rgba(20,127,80,0.14)' : tone === 'draft' ? 'rgba(217,72,95,0.12)' : 'rgba(34,103,255,0.12)';

    return (
      <div
        key={key}
        className="overlay-box"
        style={{
          left: `${(box.x / imageSize.width) * 100}%`,
          top: `${(box.y / imageSize.height) * 100}%`,
          width: `${(box.w / imageSize.width) * 100}%`,
          height: `${(box.h / imageSize.height) * 100}%`,
          borderColor: color,
          background,
        }}
      />
    );
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <div className="stack-xs">
          <label className="label" htmlFor="group-photo">
            단체사진 업로드
          </label>
          <input
            id="group-photo"
            className="input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        <div className="stack-xs">
          <label className="label" htmlFor="photo-label">
            사진 이름
          </label>
          <input
            id="photo-label"
            className="input"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="예: 2026 입학식 1반"
          />
        </div>

        <div className="row gap-sm wrap">
          <button className={`button ${manualMode ? 'primary' : 'ghost'}`} type="button" onClick={() => setManualMode((value) => !value)} disabled={!selectedFile}>
            {manualMode ? '수동 추가 모드 켜짐' : '수동 추가 모드'}
          </button>
          <button className="button ghost" type="button" onClick={() => void handleRerunDetection()} disabled={!selectedFile || detecting}>
            자동 인식 다시 실행
          </button>
          <span className="badge">{activeCrops.length}개 얼굴 crop</span>
        </div>

        <p className="muted-text small-text">
          자동 인식이 누락되면 원본 사진 위에서 드래그해서 직접 얼굴 박스를 추가하세요. 이미 승인된 사람도 검토 화면에서 이름을 다시 바꿀 수 있습니다.
        </p>

        {detecting ? <p className="muted-text">얼굴을 찾는 중입니다...</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <div className="row gap-sm wrap">
          <button
            className="button primary"
            type="button"
            onClick={handleSave}
            disabled={saving || detecting || !selectedFile || activeCrops.length === 0}
          >
            {saving ? '저장 중...' : '추출 결과 저장'}
          </button>
        </div>
      </div>

      {photoPreviewUrl ? (
        <div className="card stack-md">
          <div className="row space-between wrap">
            <h3>원본 미리보기</h3>
            <p className="muted-text small-text">
              {manualMode ? '드래그해서 얼굴 박스를 추가하세요.' : '수동 추가 모드를 켜면 여기서 직접 박스를 그릴 수 있습니다.'}
            </p>
          </div>

          <div className="photo-stage-wrap">
            <div
              className={`photo-stage ${manualMode ? 'manual-on' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <img
                ref={imageRef}
                className="photo-preview"
                src={photoPreviewUrl}
                alt="원본 단체사진 미리보기"
                draggable={false}
                onLoad={(event) =>
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                }
              />
              <div className="photo-overlay">
                {activeCrops.map((crop) =>
                  renderOverlayBox(crop.bbox, crop.id, crop.source === 'manual' ? 'manual' : 'auto'),
                )}
                {draftBox ? renderOverlayBox(draftBox, 'draft', 'draft') : null}
              </div>
            </div>
          </div>
          <p className="muted-text small-text">모바일에서는 손가락으로 한번 크게 확대해서 위치를 확인한 뒤, 얼굴보다 조금 넉넉하게 드래그하면 수동 박스가 더 잘 맞습니다.</p>
        </div>
      ) : null}

      {activeCrops.length > 0 ? (
        <div className="stack-md">
          <div className="row space-between wrap">
            <h3>자동/수동으로 추출된 얼굴</h3>
            <p className="muted-text">잘못 잡힌 얼굴은 제거하고, 빠진 사람은 수동 추가 모드로 보완하세요.</p>
          </div>

          <div className="face-grid">
            {activeCrops.map((crop, index) => (
              <article key={crop.id} className="face-card">
                <img src={crop.previewUrl} alt={`얼굴 crop ${index + 1}`} />
                <div className="stack-xs">
                  <p className="small-text">
                    #{index + 1} · {Math.round(crop.bbox.w)}×{Math.round(crop.bbox.h)} · {crop.source === 'manual' ? '수동' : '자동'}
                  </p>
                  <button
                    className="button danger"
                    type="button"
                    onClick={() => handleRemoveCrop(crop.id)}
                  >
                    제거
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

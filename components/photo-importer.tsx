"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { createManualCrop, detectAndCropFaces, resizeImageFile } from '@/lib/face-detector';
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
  const [adjustingCropId, setAdjustingCropId] = useState<string | null>(null);
  const [adjustBox, setAdjustBox] = useState<BoundingBox | null>(null);
  const [resizeDrag, setResizeDrag] = useState<{
    handle: string;
    startClientX: number;
    startClientY: number;
    startBox: BoundingBox;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const photoStageRef = useRef<HTMLDivElement | null>(null);
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
    setAdjustingCropId(null);
    setAdjustBox(null);
    setResizeDrag(null);
  }

  function handleStartAdjust(cropId: string) {
    const crop = crops.find((c) => c.id === cropId);
    if (!crop) return;
    setAdjustingCropId(cropId);
    setAdjustBox({ ...crop.bbox });
    setResizeDrag(null);
    setManualMode(false);
    setMessage('모서리·가장자리를 드래그해서 범위를 조정하세요. 상자 안을 드래그하면 이동합니다.');
    photoStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleCancelAdjust() {
    setAdjustingCropId(null);
    setAdjustBox(null);
    setResizeDrag(null);
    setManualMode(false);
    setMessage(null);
  }

  async function handleApplyAdjust() {
    if (!adjustBox || !adjustingCropId || !selectedFile) return;
    const targetId = adjustingCropId;
    const newBox = { ...adjustBox };
    setAdjustingCropId(null);
    setAdjustBox(null);
    setResizeDrag(null);
    try {
      const newCrop = await createManualCrop(selectedFile, newBox);
      setCrops((current) => {
        const target = current.find((c) => c.id === targetId);
        if (target) URL.revokeObjectURL(target.previewUrl);
        return current.map((c) => (c.id === targetId ? { ...newCrop, source: c.source } : c));
      });
      setMessage('위치 조정이 완료되었습니다.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    }
  }

  function handleResizeHandleDown(handle: string, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizeDrag({
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...adjustBox! },
    });
  }

  function handleResizeHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeDrag || !imageSize || !imageRef.current) return;
    e.preventDefault();
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;
    const dx = (e.clientX - resizeDrag.startClientX) * scaleX;
    const dy = (e.clientY - resizeDrag.startClientY) * scaleY;
    const b = resizeDrag.startBox;
    const h = resizeDrag.handle;
    let newX = b.x, newY = b.y, newW = b.w, newH = b.h;
    if (h === 'move')                           { newX = b.x + dx; newY = b.y + dy; }
    if (h === 'nw' || h === 'w' || h === 'sw') { newX = b.x + dx; newW = b.w - dx; }
    if (h === 'ne' || h === 'e' || h === 'se') { newW = b.w + dx; }
    if (h === 'nw' || h === 'n' || h === 'ne') { newY = b.y + dy; newH = b.h - dy; }
    if (h === 'sw' || h === 's' || h === 'se') { newH = b.h + dy; }
    const MIN = 40;
    if (newW < MIN) { if (h.includes('w')) newX = b.x + b.w - MIN; newW = MIN; }
    if (newH < MIN) { if (h.includes('n')) newY = b.y + b.h - MIN; newH = MIN; }
    newX = Math.max(0, Math.min(imageSize.width - newW, newX));
    newY = Math.max(0, Math.min(imageSize.height - newH, newY));
    newW = Math.min(imageSize.width - newX, newW);
    newH = Math.min(imageSize.height - newY, newH);
    setAdjustBox({ x: newX, y: newY, w: newW, h: newH });
  }

  function handleResizeHandleUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setResizeDrag(null);
  }

  async function processFile(file: File) {
    setDetecting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      clearCurrentResources();

      // 큰 사진은 2400px 이하로 줄인 뒤 인식 시작
      const { file: resizedFile, originalWidth, originalHeight } = await resizeImageFile(file);
      const wasResized = resizedFile !== file;

      setSelectedFile(resizedFile);
      setLabel(fileNameWithoutExtension(file.name));
      setPhotoPreviewUrl(URL.createObjectURL(resizedFile));

      if (wasResized) {
        setMessage(`원본(${originalWidth}×${originalHeight})을 인식에 맞게 줄인 뒤 얼굴을 찾는 중입니다…`);
      }

      const detected = await detectAndCropFaces(resizedFile);
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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  }

  function handleDropZoneDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDropZoneDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDropZoneDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) void processFile(file);
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
    if (adjustBox) return; // 리사이즈 모드 중에는 새 박스 그리기 비활성
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

  function renderOverlayBox(box: BoundingBox, key: string, tone: 'auto' | 'manual' | 'draft' | 'adjusting') {
    if (!imageSize) {
      return null;
    }

    const color =
      tone === 'adjusting' ? 'rgba(245,158,11,1)' :
      tone === 'manual'    ? 'rgba(20,127,80,0.95)' :
      tone === 'draft'     ? 'rgba(217,72,95,0.95)' :
                             'rgba(34,103,255,0.95)';
    const background =
      tone === 'adjusting' ? 'rgba(245,158,11,0.18)' :
      tone === 'manual'    ? 'rgba(20,127,80,0.14)' :
      tone === 'draft'     ? 'rgba(217,72,95,0.12)' :
                             'rgba(34,103,255,0.12)';

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
          borderWidth: tone === 'adjusting' ? '3px' : '2px',
          background,
        }}
      />
    );
  }

  return (
    <section className="stack-lg">
      <div className="card stack-md">
        <label
          htmlFor="group-photo"
          className={`upload-zone${isDragOver ? ' upload-zone-active' : ''}${selectedFile ? ' upload-zone-filled' : ''}`}
          onDragOver={handleDropZoneDragOver}
          onDragLeave={handleDropZoneDragLeave}
          onDrop={handleDropZoneDrop}
        >
          <div className="upload-zone-icon">
            {detecting ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : selectedFile ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            )}
          </div>
          <div className="upload-zone-text">
            {detecting ? (
              <span className="upload-zone-main">얼굴을 인식하는 중…</span>
            ) : selectedFile ? (
              <>
                <span className="upload-zone-main">{selectedFile.name}</span>
                <span className="upload-zone-sub">다른 파일로 바꾸려면 클릭하거나 드래그하세요</span>
              </>
            ) : (
              <>
                <span className="upload-zone-main">사진을 여기에 드래그하거나 클릭해서 선택</span>
                <span className="upload-zone-sub">JPG · PNG · WEBP · HEIC 지원</span>
              </>
            )}
          </div>
          <input
            id="group-photo"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={detecting}
          />
        </label>

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
          <button className={`button ${manualMode ? 'primary' : 'ghost'}`} type="button" onClick={() => { setManualMode((value) => !value); setAdjustingCropId(null); }} disabled={!selectedFile}>
            {manualMode ? '수동 추가 모드 켜짐' : '수동 추가 모드'}
          </button>
          <button className="button ghost" type="button" onClick={() => void handleRerunDetection()} disabled={!selectedFile || detecting}>
            자동 인식 다시 실행
          </button>
          <span className="badge">{activeCrops.length}개 얼굴 crop</span>
          {adjustingCropId ? (
            <button className="button ghost" type="button" onClick={handleCancelAdjust}>
              조정 취소
            </button>
          ) : null}
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
        <div className="card stack-md" ref={photoStageRef}>
          <div className="row space-between wrap">
            <h3>원본 미리보기</h3>
            <p className="muted-text small-text">
              {adjustingCropId
                ? '주황색 박스 위치를 바꿀 새 박스를 드래그하세요.'
                : manualMode
                ? '드래그해서 얼굴 박스를 추가하세요.'
                : '수동 추가 모드를 켜면 여기서 직접 박스를 그릴 수 있습니다.'}
            </p>
          </div>

          {adjustingCropId && adjustBox ? (
            <div className="adjust-banner">
              <span>#{activeCrops.findIndex((c) => c.id === adjustingCropId) + 1}번 얼굴 — 모서리·가장자리 드래그로 범위 조정, 상자 안 드래그로 이동</span>
              <div className="row gap-sm" style={{ marginLeft: 'auto' }}>
                <button className="button primary" type="button" style={{ padding: '3px 14px', fontSize: 13 }} onClick={() => void handleApplyAdjust()}>
                  적용
                </button>
                <button className="button ghost" type="button" style={{ padding: '3px 12px', fontSize: 13 }} onClick={handleCancelAdjust}>
                  취소
                </button>
              </div>
            </div>
          ) : null}

          <div className="photo-stage-wrap">
            <div
              className={`photo-stage ${adjustBox ? '' : manualMode ? 'manual-on' : ''}`}
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
                  // 리사이즈 모드 중인 박스는 아래 별도 UI로 렌더하므로 여기서 건너뜀
                  crop.id === adjustingCropId && adjustBox ? null :
                  renderOverlayBox(
                    crop.bbox,
                    crop.id,
                    crop.source === 'manual' ? 'manual' : 'auto',
                  ),
                )}
                {draftBox ? renderOverlayBox(draftBox, 'draft', 'draft') : null}

                {/* ── 리사이즈 UI ─────────────────────────────── */}
                {adjustBox && imageSize ? (() => {
                  const bx = (v: number) => `${(v / imageSize.width) * 100}%`;
                  const by = (v: number) => `${(v / imageSize.height) * 100}%`;
                  const HANDLES = [
                    { k: 'nw', l: adjustBox.x,                    t: adjustBox.y,                    cur: 'nw-resize' },
                    { k: 'n',  l: adjustBox.x + adjustBox.w / 2,  t: adjustBox.y,                    cur: 'n-resize'  },
                    { k: 'ne', l: adjustBox.x + adjustBox.w,      t: adjustBox.y,                    cur: 'ne-resize' },
                    { k: 'e',  l: adjustBox.x + adjustBox.w,      t: adjustBox.y + adjustBox.h / 2,  cur: 'e-resize'  },
                    { k: 'se', l: adjustBox.x + adjustBox.w,      t: adjustBox.y + adjustBox.h,      cur: 'se-resize' },
                    { k: 's',  l: adjustBox.x + adjustBox.w / 2,  t: adjustBox.y + adjustBox.h,      cur: 's-resize'  },
                    { k: 'sw', l: adjustBox.x,                    t: adjustBox.y + adjustBox.h,      cur: 'sw-resize' },
                    { k: 'w',  l: adjustBox.x,                    t: adjustBox.y + adjustBox.h / 2,  cur: 'w-resize'  },
                  ];
                  return (
                    <>
                      {/* 박스 몸체 — 안쪽 드래그 시 이동 */}
                      <div
                        style={{
                          position: 'absolute',
                          left: bx(adjustBox.x), top: by(adjustBox.y),
                          width: bx(adjustBox.w), height: by(adjustBox.h),
                          border: '2.5px solid #F59E0B',
                          background: 'rgba(245,158,11,0.08)',
                          cursor: 'move',
                          pointerEvents: 'auto',
                          touchAction: 'none',
                          boxSizing: 'border-box',
                        }}
                        onPointerDown={(e) => handleResizeHandleDown('move', e)}
                        onPointerMove={handleResizeHandleMove}
                        onPointerUp={handleResizeHandleUp}
                      />
                      {/* 8방향 핸들 */}
                      {HANDLES.map((h) => (
                        <div
                          key={h.k}
                          style={{
                            position: 'absolute',
                            left: `calc(${bx(h.l)} - 6px)`,
                            top: `calc(${by(h.t)} - 6px)`,
                            width: 13, height: 13,
                            background: 'white',
                            border: '2.5px solid #F59E0B',
                            borderRadius: 3,
                            cursor: h.cur,
                            pointerEvents: 'auto',
                            touchAction: 'none',
                            zIndex: 10,
                          }}
                          onPointerDown={(e) => handleResizeHandleDown(h.k, e)}
                          onPointerMove={handleResizeHandleMove}
                          onPointerUp={handleResizeHandleUp}
                        />
                      ))}
                    </>
                  );
                })() : null}
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
              <article
                key={crop.id}
                className={`face-card${crop.id === adjustingCropId ? ' face-card-adjusting' : ''}`}
              >
                <img src={crop.previewUrl} alt={`얼굴 crop ${index + 1}`} />
                <div className="stack-xs">
                  <p className="small-text">
                    #{index + 1} · {Math.round(crop.bbox.w)}×{Math.round(crop.bbox.h)} · {crop.source === 'manual' ? '수동' : '자동'}
                  </p>
                  <div className="row gap-sm">
                    <button
                      className="button ghost"
                      type="button"
                      style={{ flex: 1 }}
                      onClick={() => handleStartAdjust(crop.id)}
                    >
                      위치 조정
                    </button>
                    <button
                      className="button danger"
                      type="button"
                      onClick={() => handleRemoveCrop(crop.id)}
                    >
                      제거
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

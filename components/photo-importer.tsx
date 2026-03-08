"use client";

import { useEffect, useRef, useState } from 'react';

import { detectAndCropFaces } from '@/lib/face-detector';
import type { DetectedCrop, ImportFacePayload } from '@/lib/types';
import { sanitizeFileSegment, toErrorMessage } from '@/lib/utils';

function fileNameWithoutExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

export function PhotoImporter() {
  const [label, setLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [crops, setCrops] = useState<DetectedCrop[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setDetecting(true);
    setErrorMessage(null);
    setMessage(null);

    try {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }

      for (const crop of crops) {
        URL.revokeObjectURL(crop.previewUrl);
      }

      setSelectedFile(file);
      setLabel(fileNameWithoutExtension(file.name));
      setPhotoPreviewUrl(URL.createObjectURL(file));

      const detected = await detectAndCropFaces(file);
      setCrops(detected);

      if (detected.length === 0) {
        setMessage('얼굴을 찾지 못했습니다. 다른 사진을 올리거나 모델 파일 경로를 확인해주세요.');
      } else {
        setMessage(`${detected.length}개의 얼굴을 추출했습니다. 오검출은 제거하고 저장하세요.`);
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

  async function handleSave() {
    if (!selectedFile) {
      setErrorMessage('먼저 단체사진을 선택해주세요.');
      return;
    }

    if (activeCrops.length === 0) {
      setErrorMessage('저장할 얼굴 crop이 없습니다.');
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
        `저장 완료: 사진 1장, 얼굴 ${payload.faceCount ?? activeCrops.length}개를 등록했습니다.`,
      );
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setSaving(false);
    }
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
          <span className="badge">{activeCrops.length}개 얼굴 crop</span>
        </div>
      </div>

      {photoPreviewUrl ? (
        <div className="card stack-md">
          <h3>원본 미리보기</h3>
          <img className="photo-preview" src={photoPreviewUrl} alt="원본 단체사진 미리보기" />
        </div>
      ) : null}

      {activeCrops.length > 0 ? (
        <div className="stack-md">
          <div className="row space-between wrap">
            <h3>자동 추출된 얼굴</h3>
            <p className="muted-text">잘못 잡힌 얼굴은 제거 버튼으로 빼주세요.</p>
          </div>

          <div className="face-grid">
            {activeCrops.map((crop, index) => (
              <article key={crop.id} className="face-card">
                <img src={crop.previewUrl} alt={`얼굴 crop ${index + 1}`} />
                <div className="stack-xs">
                  <p className="small-text">
                    #{index + 1} · {Math.round(crop.bbox.w)}×{Math.round(crop.bbox.h)}
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

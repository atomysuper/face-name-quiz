# 얼굴 이름 퀴즈 웹앱

단체사진에서 얼굴을 잘라 저장하고, 이름 제보를 받은 뒤, 퀴즈 형식으로 빠르게 외울 수 있게 만든 Next.js + Supabase 앱입니다.

## 들어있는 기능

- 관리자 로그인
- 단체사진 업로드
- MediaPipe Face Detector로 얼굴 자동 추출
- 잘못 잡힌 얼굴 제거 후 저장
- 누구나 이름 제보 가능
- 관리자가 제출된 이름 승인
- 승인된 얼굴만 퀴즈로 출제
- 오답/반응속도 기반 반복 출제
- 퀴즈 기록 저장

## 추천 흐름

1. `/admin/login` 에서 관리자 비밀번호 로그인
2. `/admin/upload` 에서 단체사진 업로드
3. 얼굴 자동 추출 결과에서 오검출 제거 후 저장
4. `/contribute` 에서 학생/교사가 이름 제보
5. `/admin/review` 에서 이름 승인
6. `/quiz` 에서 이름 퀴즈 진행

## 설치

```bash
npm install
cp .env.example .env
npm run dev
```

## 꼭 필요한 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (권장) 또는 `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSCODE`
- `SESSION_SECRET`

## Supabase 준비

1. Supabase 프로젝트 생성
2. `supabase/migrations/001_init.sql` 실행
3. Storage 버킷 생성 여부 확인
   - `group-photos`
   - `face-crops`

이 SQL은 버킷 생성도 같이 시도합니다. 이미 있으면 그대로 넘어갑니다.

### API 키 메모

이 프로젝트는 서버 전용 키를 사용합니다.

- 최신 Supabase 프로젝트면 `SUPABASE_SECRET_KEY` 사용 권장
- 기존 레거시 키가 남아 있으면 `SUPABASE_SERVICE_ROLE_KEY`도 사용 가능

둘 중 하나만 넣으면 됩니다.

## MediaPipe 모델 파일 준비

Face Detector 모델 파일은 기본적으로 아래 경로를 사용합니다.

```text
public/models/face_detection_short_range.tflite
```

### 방법 A
호환되는 Face Detector 모델 파일을 내려받아 위 경로에 넣기

### 방법 B
`.env`에서 `NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH` 를 절대 URL로 지정하기

예:
```bash
NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH=https://example.com/face_detection_short_range.tflite
```

## 보안 메모

- 이 프로젝트는 내부용 이름 암기 앱을 기준으로 만들었습니다.
- 얼굴 사진이 포함되므로 공개 서비스보다는 비공개 배포를 권장합니다.
- 현재 관리자는 공유 비밀번호 기반입니다.
- 실제 학교 운영용이면 추후 Supabase Auth 또는 SSO 연동을 권장합니다.

## 데이터 구조

- `people`: 사람 이름/별칭
- `photos`: 원본 단체사진
- `faces`: 잘라낸 얼굴
- `name_submissions`: 이름 제보
- `quiz_attempts`: 퀴즈 기록

## 구현 포인트

- 얼굴 검출은 브라우저에서 처리
- 원본 사진과 crop 이미지는 Supabase Storage에 저장
- DB 쓰기는 서버 Route Handler에서 server-side Supabase key로 수행
- 퀴즈 가중치는 localStorage + 서버 기록을 함께 사용

## 배포

Vercel 배포가 가장 편합니다.

1. Git 저장소에 올리기
2. Vercel import
3. 환경변수 입력
4. 배포

## 다음에 붙이면 좋은 기능

- 얼굴 박스 수동 이동
- 사람별 여러 사진 묶기
- 반/학년/팀 필터
- 초성만 보고 얼굴 찾기 모드
- 오답노트 전용 페이지
- 관리자 승인 이력

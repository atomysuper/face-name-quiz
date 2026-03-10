# 드리미학교 얼굴 이름 퀴즈

Next.js + Supabase 기반의 내부용 얼굴 이름 학습 웹앱입니다.

## 필요한 환경변수

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
ADMIN_PASSCODE=관리자비밀번호
SITE_PASSCODE=입장비밀번호
SESSION_SECRET=길고랜덤한문자열
NEXT_PUBLIC_MEDIAPIPE_WASM_ROOT=https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm
NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH=/models/blaze_face_short_range.tflite
```

- `SITE_PASSCODE`를 넣으면 첫 화면에서 전체 입장 비밀번호를 묻습니다.
- `SITE_PASSCODE`를 비워두고 싶지 않다면 반드시 설정하세요. 없으면 `ADMIN_PASSCODE`를 대신 사용합니다.
- 이번 수정본은 사이트 입장 쿠키 이름을 새로 바꿔서, 예전에 저장된 브라우저 쿠키가 있어도 다시 비밀번호를 묻게 했습니다.
- 모델 파일은 `public/models/blaze_face_short_range.tflite` 경로에 두는 것을 권장합니다.

## 주요 화면

- `/enter` : 사이트 입장 비밀번호
- `/quiz` : 퀴즈 메인
- `/contribute` : 이름 제보
- `/admin/upload` : 관리자 업로드
- `/admin/review` : 관리자 검토/삭제

## 참고

- 관리 페이지는 별도 메뉴에서 제거했고, 얼굴 삭제는 검토 화면에서 바로 할 수 있습니다.
- 객관식 보기에는 이름과 함께 별칭/기수 표시를 함께 보여줍니다.

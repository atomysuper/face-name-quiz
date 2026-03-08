type ServerEnv = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  adminPasscode: string;
  sessionSecret: string;
};

export function getServerEnv(): ServerEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPasscode = process.env.ADMIN_PASSCODE;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.');
  }

  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.',
    );
  }

  if (!adminPasscode) {
    throw new Error('ADMIN_PASSCODE 환경변수가 없습니다.');
  }

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET 환경변수가 없습니다.');
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    adminPasscode,
    sessionSecret,
  };
}

export function getPublicEnv() {
  return {
    wasmRoot:
      process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_ROOT ??
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    modelPath:
      process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH ??
      '/models/face_detection_short_range.tflite',
  };
}

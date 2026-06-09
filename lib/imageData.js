// base64 dataURL 이미지 검증/디코드 공용 헬퍼.
// 서버 측 크기 강제(클라 체크는 우회 가능) — R5-4/R5-7.

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * data:image/...;base64,xxx 형태를 검증.
 * @returns {{ ext: string, buffer: Buffer } | { error: string }}
 */
function parseImageDataUrl(dataUrl, maxBytes = MAX_IMAGE_BYTES) {
  if (typeof dataUrl !== 'string') return { error: '잘못된 이미지 데이터입니다.' };
  const match = dataUrl.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/);
  if (!match) return { error: '지원하지 않는 이미지 형식입니다.' };
  const b64 = match[2];
  // base64 문자열 길이로 디코드 바이트 크기 근사 (버퍼 할당 전 차단)
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > maxBytes) return { error: '이미지는 5MB 이하만 업로드 가능합니다.' };
  return { ext: match[1].replace('jpeg', 'jpg'), buffer: Buffer.from(b64, 'base64') };
}

module.exports = { parseImageDataUrl, MAX_IMAGE_BYTES };

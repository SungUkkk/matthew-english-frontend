import { fetchArticleTts, type TtsAccent } from "./api";

let sessionAbort: AbortController | null = null;

function stopInternal() {
  sessionAbort?.abort();
  sessionAbort = null;
}

/** 진행 중인 TTS 재생·요청 중단 */
export function stopArticleTtsPlayback(): void {
  stopInternal();
}

function playOneMp3DataUrl(dataUrl: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const audio = new Audio(dataUrl);
    const onAbort = () => {
      audio.pause();
      audio.removeAttribute("src");
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
    audio.onended = () => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    audio.onerror = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("오디오 재생에 실패했습니다."));
    };
    audio.play().catch((e) => {
      signal.removeEventListener("abort", onAbort);
      reject(e instanceof Error ? e : new Error(String(e)));
    });
  });
}

async function playPartsSequentially(partsBase64: string[], signal: AbortSignal): Promise<void> {
  for (const b64 of partsBase64) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const url = `data:audio/mpeg;base64,${b64}`;
    await playOneMp3DataUrl(url, signal);
  }
}

export type RequestTtsOptions = {
  /** MP3 수신 직후(재생 시작 전) 호출 — UI에서 fetch 전용 로딩 해제용 */
  onFetchComplete?: () => void;
};

/**
 * 이전 재생을 끊고, 서버에서 MP3 청크를 받아 순서대로 재생합니다.
 */
export async function requestAndPlayArticleTts(
  articleId: number,
  accent: TtsAccent,
  options?: RequestTtsOptions
): Promise<void> {
  stopInternal();
  const ac = new AbortController();
  sessionAbort = ac;
  try {
    const parts = await fetchArticleTts(articleId, accent, ac.signal);
    if (parts.length === 0) {
      throw new Error("재생할 음성 데이터가 없습니다.");
    }
    options?.onFetchComplete?.();
    await playPartsSequentially(parts, ac.signal);
  } finally {
    if (sessionAbort === ac) {
      sessionAbort = null;
    }
  }
}

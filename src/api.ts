// 기본: 상대 경로 /api 사용 → Vite가 127.0.0.1:8000으로 프록시. 브라우저는 5173만 호출해 CORS 없음.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Render 무료 티어 콜드 스타트 대비 (무제한 대기 방지) */
const LIST_TIMEOUT_MS = 22_000;
const DETAIL_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function articlesUrl(): string {
  return API_BASE ? `${API_BASE}/articles` : "/api/articles";
}

export function articleDetailUrl(id: number): string {
  return API_BASE ? `${API_BASE}/articles/${id}` : `/api/articles/${id}`;
}

/** 백엔드 origin (로컬 dev 시 Vite 프록시 대신 직접 호출할 때 사용) */
function apiOrigin(): string {
  return (
    import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")
  );
}

export function adminAccessUrl(): string {
  const o = apiOrigin();
  return o ? `${o}/admin/access` : "/api/admin/access";
}

/** ADMIN_ALLOWED_IPS 기준 허용 여부 (관리자 페이지와 동일). 미설정 시 항상 true. */
export async function fetchAdminAccessAllowed(): Promise<boolean> {
  try {
    const res = await fetch(adminAccessUrl(), { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { allowed?: boolean };
    return Boolean(data?.allowed);
  } catch {
    return false;
  }
}

export type TtsAccent = "us" | "gb" | "au";

const TTS_TIMEOUT_MS = 120_000;

export function articleTtsUrl(id: number): string {
  return API_BASE ? `${API_BASE}/articles/${id}/tts` : `/api/articles/${id}/tts`;
}

export async function fetchArticleTts(
  articleId: number,
  accent: TtsAccent,
  signal?: AbortSignal
): Promise<string[]> {
  const url = articleTtsUrl(articleId);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  const onExtAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      window.clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", onExtAbort);
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { detail?: string } | null;
      const detail = data?.detail;
      throw new Error(typeof detail === "string" ? detail : `TTS 요청 실패 (${res.status})`);
    }
    const data = (await res.json()) as { parts_base64?: string[] };
    if (!Array.isArray(data.parts_base64)) {
      throw new Error("TTS 응답 형식이 올바르지 않습니다.");
    }
    return data.parts_base64;
  } finally {
    window.clearTimeout(timer);
    if (signal) {
      signal.removeEventListener("abort", onExtAbort);
    }
  }
}

export type Article = {
  id: number;
  study_date_ymd: number | null;
  original_text: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  sentences: ArticleSentence[];
};

export type ArticleSentence = {
  id: number;
  order_index: number;
  english: string;
  korean: string;
  note_summary: string | null;
  expressions: SentenceExpression[];
};

export type SentenceExpression = {
  id: number;
  expression: string;
  explanation_ko: string;
  category: string | null;
};

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

export async function fetchArticles(): Promise<Article[]> {
  const url = articlesUrl();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1400 * attempt));
    }
    try {
      const res = await fetchWithTimeout(url, { cache: "no-store" }, LIST_TIMEOUT_MS);
      if (!res.ok) {
        throw new Error(`기사 목록을 불러오지 못했습니다. (${res.status})`);
      }
      return res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  if (isAbortError(lastErr)) {
    throw new Error(
      "서버 응답이 지연되고 있습니다. Render 무료 백엔드는 슬립 후 첫 요청이 오래 걸릴 수 있어요. 잠시 후 다시 시도해 주세요."
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchArticle(id: number): Promise<Article> {
  const url = articleDetailUrl(id);
  try {
    const res = await fetchWithTimeout(url, { cache: "no-store" }, DETAIL_TIMEOUT_MS);
    if (!res.ok) throw new Error("기사를 불러오지 못했습니다.");
    return res.json();
  } catch (e) {
    if (isAbortError(e)) {
      throw new Error(
        "응답 시간이 초과되었습니다. 백엔드가 깨어나는 중이면 잠시 뒤 새로고침해 보세요."
      );
    }
    throw e;
  }
}

export function formatStudyDate(ymd: number | null): string {
  if (ymd == null) return "—";
  const s = String(ymd);
  if (s.length !== 8) return String(ymd);
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

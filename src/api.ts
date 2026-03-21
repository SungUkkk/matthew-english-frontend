// 기본: 상대 경로 /api 사용 → Vite가 127.0.0.1:8000으로 프록시. 브라우저는 5173만 호출해 CORS 없음.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

/** Render 무료 티어 콜드 스타트 대비 (무제한 대기 방지) */
const LIST_TIMEOUT_MS = 55_000;
const DETAIL_TIMEOUT_MS = 55_000;

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

export type Article = {
  id: number;
  title: string;
  source: string | null;
  study_date_ymd: number | null;
  original_text: string;
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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1600));
    }
    try {
      const res = await fetchWithTimeout(url, {}, LIST_TIMEOUT_MS);
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
      "서버 응답이 제한 시간 안에 오지 않았습니다. Render 무료 백엔드는 잠들었다가 첫 요청 때 1분 가까이 걸릴 수 있습니다. 잠시 후 다시 시도해 주세요."
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchArticle(id: number): Promise<Article> {
  const url = articleDetailUrl(id);
  try {
    const res = await fetchWithTimeout(url, {}, DETAIL_TIMEOUT_MS);
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

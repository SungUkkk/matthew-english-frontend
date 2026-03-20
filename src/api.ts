// 기본: 상대 경로 /api 사용 → Vite가 127.0.0.1:8000으로 프록시. 브라우저는 5173만 호출해 CORS 없음.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

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

export async function fetchArticles(): Promise<Article[]> {
  const url = articlesUrl();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`기사 목록을 불러오지 못했습니다. (${res.status})`);
  return res.json();
}

export async function fetchArticle(id: number): Promise<Article> {
  const res = await fetch(articleDetailUrl(id));
  if (!res.ok) throw new Error("기사를 불러오지 못했습니다.");
  return res.json();
}

export function formatStudyDate(ymd: number | null): string {
  if (ymd == null) return "—";
  const s = String(ymd);
  if (s.length !== 8) return String(ymd);
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

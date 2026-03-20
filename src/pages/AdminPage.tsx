import React, { useEffect, useState } from "react";

type CreateArticlePayload = {
  title?: string | null;
  source?: string | null;
  study_date_ymd: number;
  original_text: string;
};

const isValidYmd = (value: string): boolean => {
  const trimmed = value.trim();
  if (!/^\d{8}$/.test(trimmed)) return false;
  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(4, 6));
  const day = Number(trimmed.slice(6, 8));
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
};

export const AdminPage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1";
    if (!isLocal) {
      setAllowed(false);
    }
  }, []);

  const apiBase =
    import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");
  const postUrl = apiBase ? `${apiBase}/articles` : "/api/articles";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const trimmedStudyDate = studyDate.trim();
    if (!trimmedStudyDate) {
      setError("스터디 날짜를 입력해 주세요.");
      return;
    }
    if (!isValidYmd(trimmedStudyDate)) {
      setError("스터디 날짜는 YYYYMMDD(예: 20260307) 형식의 8자리 유효한 날짜여야 합니다.");
      return;
    }

    if (!originalText.trim()) {
      setError("영어 원문 기사를 입력해 주세요.");
      return;
    }
    const studyDateYmd = Number(trimmedStudyDate);
    const payload: CreateArticlePayload = {
      title: title.trim() || null,
      source: null,
      study_date_ymd: studyDateYmd,
      original_text: originalText,
    };
    try {
      setIsSubmitting(true);
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? "등록 중 오류가 발생했습니다.");
      }
      setMessage("분석 및 저장이 완료되었습니다. (문장/표현 정보까지 DB에 저장됨)");
      setTitle("");
      setStudyDate("");
      setOriginalText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!allowed) {
    return (
      <div className="admin-layout">
        <header className="admin-header">
          <h1>관리자 페이지</h1>
          <p>이 페이지는 로컬 환경(내 PC)에서만 접근할 수 있습니다.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <h1>Article Analyzer - Admin</h1>
        <p>영문 원문과 스터디 날짜를 입력하면, 챗GPT 분석 결과가 DB에 자동 저장됩니다.</p>
      </header>
      <main className="admin-main">
        <section className="card admin-card">
          <h2>새 기사 등록</h2>
          <form onSubmit={handleSubmit} className="admin-form">
            <label>
              <div>제목 (선택)</div>
              <input
                type="text"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="예: Haunting season in Westminster"
              />
            </label>
            <label>
              <div>스터디 날짜 (YYYYMMDD)</div>
              <input
                type="text"
                value={studyDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudyDate(e.target.value)}
                placeholder="예: 20260307"
              />
            </label>
            <label>
              <div>영문 원문 기사</div>
              <textarea
                value={originalText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOriginalText(e.target.value)}
                rows={10}
                placeholder="영문 기사를 그대로 붙여 넣으세요."
              />
            </label>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "분석 중..." : "등록 및 분석"}
            </button>
          </form>
          {message && <p className="admin-message success">{message}</p>}
          {error && <p className="admin-message error">{error}</p>}
        </section>
      </main>
    </div>
  );
};


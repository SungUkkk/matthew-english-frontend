import React, { useEffect, useState } from "react";

type CreateArticlePayload = {
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

type AdminGate = "loading" | "allowed" | "denied" | "error";

export const AdminPage: React.FC = () => {
  const [studyDate, setStudyDate] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [gate, setGate] = useState<AdminGate>("loading");
  const [gateDetail, setGateDetail] = useState<string | null>(null);

  const apiBase =
    import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");
  const postUrl = apiBase ? `${apiBase}/articles` : "/api/articles";
  const accessUrl = apiBase ? `${apiBase}/admin/access` : "/api/admin/access";
  const backfillUrl = apiBase ? `${apiBase}/admin/backfill-summaries` : "/api/admin/backfill-summaries";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(accessUrl, { method: "GET" });
        const data = (await res.json().catch(() => null)) as { allowed?: boolean } | null;
        if (cancelled) return;
        if (!res.ok) {
          setGate("error");
          setGateDetail(`서버 응답 오류 (${res.status})`);
          return;
        }
        if (data?.allowed) {
          setGate("allowed");
        } else {
          setGate("denied");
          setGateDetail(
            "백엔드에 ADMIN_ALLOWED_IPS 로 등록된 공인 IP에서만 접근할 수 있습니다.",
          );
        }
      } catch {
        if (!cancelled) {
          setGate("error");
          setGateDetail("API에 연결할 수 없습니다. VITE_API_URL 과 CORS 설정을 확인하세요.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessUrl]);

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
      setStudyDate("");
      setOriginalText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackfillSummaries = async () => {
    setMessage(null);
    setError(null);
    try {
      setIsBackfilling(true);
      const res = await fetch(`${backfillUrl}?limit=500&workers=6`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { updated?: number; remaining?: number; failed_ids?: number[]; detail?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.detail ?? "요약 백필 중 오류가 발생했습니다.");
      }
      const updated = data?.updated ?? 0;
      const remaining = data?.remaining ?? 0;
      const failedCount = data?.failed_ids?.length ?? 0;
      setMessage(
        `요약 백필 완료: ${updated}건 업데이트, 남은 누락 ${remaining}건${failedCount > 0 ? `, 실패 ${failedCount}건` : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsBackfilling(false);
    }
  };

  if (gate === "loading") {
    return (
      <div className="admin-layout">
        <header className="admin-header">
          <h1>관리자 페이지</h1>
          <p>접근 권한 확인 중…</p>
        </header>
      </div>
    );
  }

  if (gate === "denied" || gate === "error") {
    return (
      <div className="admin-layout">
        <header className="admin-header">
          <h1>관리자 페이지</h1>
          <p>
            {gate === "denied"
              ? "이 환경에서는 관리자 기능을 사용할 수 없습니다."
              : "접근 확인에 실패했습니다."}
          </p>
          {gateDetail && <p className="admin-message error">{gateDetail}</p>}
          <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.85 }}>
            운영 서버(Render) 백엔드 환경변수 <code>ADMIN_ALLOWED_IPS</code>에 본인 PC의 공인
            IP(쉼표로 여러 개 가능)를 넣어 주세요. IP는 브라우저에서 &quot;what is my ip&quot;로
            확인할 수 있습니다. IP가 바뀌면 환경변수도 갱신해야 합니다.
          </p>
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
        <section className="card admin-card" style={{ marginTop: "12px" }}>
          <h2>기존 기사 요약 백필</h2>
          <p style={{ marginTop: 0, marginBottom: "10px", opacity: 0.9 }}>
            summary 누락 기사(기존 데이터)에 대해 최신 요약 규칙으로 다시 채웁니다.
          </p>
          <button
            type="button"
            className="admin-action-btn"
            onClick={handleBackfillSummaries}
            disabled={isBackfilling}
          >
            {isBackfilling ? "요약 생성 중..." : "기존 기사 요약 일괄 채우기"}
          </button>
        </section>
      </main>
    </div>
  );
};


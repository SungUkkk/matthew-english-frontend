import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchArticles, formatStudyDate, type Article } from "../api";
import { useTheme } from "../theme";
import { useZoom } from "../zoom";

const isProdApi = Boolean(import.meta.env.VITE_API_URL);

export const FeedPage: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadingHint, setLoadingHint] = useState("");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { zoom, increase, decrease } = useZoom();

  useEffect(() => {
    document.title = "Article Feed";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchArticles();
        if (!cancelled) setArticles(data);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
          const isNetworkError =
            msg.includes("fetch") ||
            msg.includes("Failed") ||
            msg.includes("NetworkError") ||
            msg.includes("연결");
          setError(
            isNetworkError && !isProdApi
              ? "백엔드에 연결할 수 없습니다. 1) 터미널에서 backend 폴더로 이동 후 'uvicorn app.main:app --reload --port 8000' 실행 2) 프론트엔드(npm run dev) 재시작 후 새로고침"
              : isNetworkError && isProdApi
                ? "백엔드에 연결할 수 없습니다. Render 대시보드에서 Web Service가 Live인지, VITE_API_URL이 맞는지 확인한 뒤 다시 시도해 주세요."
                : msg
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (!loading || !isProdApi) {
      setLoadingHint("");
      return;
    }
    const t1 = window.setTimeout(() => {
      setLoadingHint("서버 깨우는 중입니다. 잠시만 기다려 주세요...");
    }, 8000);
    const t2 = window.setTimeout(() => {
      setLoadingHint("지연이 길면 아래 '다시 시도'를 눌러 재요청해 주세요.");
    }, 17000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    const stored = sessionStorage.getItem("feedScrollY");
    if (stored == null) return;
    const y = Number(stored);
    if (!Number.isNaN(y)) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
    sessionStorage.removeItem("feedScrollY");
  }, [loading, articles.length]);

  if (loading) {
    return (
      <div className="user-layout">
        <header className="user-header">
          <h1 className="user-title">Article Feed</h1>
          <p className="user-subtitle">영문 기사로 영어 실력을 쌓아 보세요</p>
        </header>
        <main className="user-main">
          <div className="feed-loading">로딩 중...</div>
          {isProdApi && (
            <div className="feed-loading-sub">
              {loadingHint || "무료 서버 특성상 첫 요청은 다소 느릴 수 있습니다."}
            </div>
          )}
          {isProdApi && (
            <div className="feed-error-actions">
              <button
                type="button"
                className="feed-retry-btn"
                onClick={() => setLoadAttempt((n) => n + 1)}
              >
                다시 시도
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-layout">
        <header className="user-header">
          <h1 className="user-title">Article Feed</h1>
        </header>
        <main className="user-main">
          <div className="feed-error">{error}</div>
          <div className="feed-error-actions">
            <button
              type="button"
              className="feed-retry-btn"
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              다시 시도
            </button>
            {isProdApi && (
              <p className="feed-error-hint">
                무료 플랜은 서버가 잠들면 첫 요청에 수십 초~1분 이상 걸릴 수 있습니다. 한 번 더 눌러 보세요.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  const trimmedQuery = query.trim().toLowerCase();
  const filtered =
    trimmedQuery === ""
      ? articles
      : articles.filter((a) => {
          const original = a.original_text.toLowerCase();
          return (
            original.includes(trimmedQuery)
          );
        });

  return (
    <div className="user-layout">
      <header className="user-header">
        <h1 className="user-title">Article Feed</h1>
        <p className="user-subtitle">영문 기사로 영어 실력을 쌓아 보세요</p>
        <div className="feed-header-actions">
          <div className="feed-header-left">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
            >
              {theme === "light" ? "🌙 다크 모드" : "☀️ 라이트 모드"}
            </button>
            <div className="zoom-controls" aria-label="글자 크기 조절">
              <button
                type="button"
                className="zoom-btn"
                onClick={decrease}
              >
                A
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={increase}
              >
                A
              </button>
            </div>
          </div>
          <Link to="/saved" className="feed-saved-btn">★ 저장한 표현</Link>
        </div>
      </header>
      <main className="user-main">
        <div className="feed-search">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="feed-search-input"
            placeholder="원문 내용으로 기사 검색"
          />
          {trimmedQuery && (
            <span className="feed-search-count">
              검색 결과 {filtered.length}개
            </span>
          )}
          {!trimmedQuery && (
            <span className="feed-search-count">
              Total <strong>{articles.length}</strong>
            </span>
          )}
        </div>
        <div className="feed-list">
          {filtered.length === 0 ? (
            <div className="feed-empty">등록된 기사가 없습니다.</div>
          ) : (
            filtered.map((a) => (
              <article
                key={a.id}
                className="feed-card"
                onClick={() => {
                    sessionStorage.setItem("feedScrollY", String(window.scrollY));
                    navigate(`/articles/${a.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                      sessionStorage.setItem("feedScrollY", String(window.scrollY));
                      navigate(`/articles/${a.id}`);
                  }
                }}
              >
                <div className="feed-card-meta">
                  <span className="feed-card-date">{formatStudyDate(a.study_date_ymd)}</span>
                  {a.source && <span className="feed-card-source">{a.source}</span>}
                </div>
                <h2 className="feed-card-title">{a.title}</h2>
                <div className="feed-card-original">{a.original_text}</div>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

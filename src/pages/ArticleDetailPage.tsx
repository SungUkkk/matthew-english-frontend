import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { fetchArticle, formatStudyDate, type Article, type ArticleSentence } from "../api";
import { getBookmarks, toggleBookmark, type BookmarkItem } from "../bookmarks";

const SWIPE_THRESHOLD = 50;

const detailPageIndexStorageKey = (articleId: number) =>
  `articleDetailPageIndex:${articleId}`;

/** 새로고침 후에도 문장/요약 페이지 복구 (기사당, 탭 단위). URL ?sentence= 이 있으면 그 값이 우선 */
function readStoredDetailPageIndex(articleId: number, maxIndex: number): number | null {
  if (maxIndex < 0) return null;
  try {
    const raw = sessionStorage.getItem(detailPageIndexStorageKey(articleId));
    if (raw == null || raw === "") return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(n, maxIndex));
  } catch {
    return null;
  }
}

function writeStoredDetailPageIndex(articleId: number, index: number) {
  try {
    sessionStorage.setItem(detailPageIndexStorageKey(articleId), String(index));
  } catch {
    /* 저장 공간/비공개 모드 등 */
  }
}

/** 도트 줄(가로 스크롤)만 이동 — 활성 점(요약 S 포함)이 잘리지 않게 */
function scrollDotRowIfNeeded(container: HTMLElement, dot: HTMLElement, margin = 10) {
  const cRect = container.getBoundingClientRect();
  const r = dot.getBoundingClientRect();
  const deltaLeft = r.left - cRect.left - margin;
  const deltaRight = r.right - cRect.right + margin;
  let next = container.scrollLeft;
  if (deltaLeft < 0) next += deltaLeft;
  else if (deltaRight > 0) next += deltaRight;
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  container.scrollLeft = Math.max(0, Math.min(next, maxScroll));
}

function scrollDotsRowForIndex(
  container: HTMLElement,
  track: HTMLElement,
  currentIndex: number,
) {
  const el = track.children[currentIndex];
  if (!(el instanceof HTMLElement)) return;
  /* 1페이지: 항상 스크롤 시작(첫 도트+터치 영역 잘림 방지) */
  if (currentIndex === 0) {
    container.scrollLeft = 0;
    return;
  }
  scrollDotRowIfNeeded(container, el);
}

export const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [bookmarkVersion, setBookmarkVersion] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const dotsRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  useEffect(() => {
    const rawId = id == null ? "" : id.trim();
    const numId = rawId === "" ? NaN : parseInt(rawId, 10);
    if (Number.isNaN(numId) || numId < 1) {
      setLoading(false);
      setError("잘못된 기사 번호입니다.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await fetchArticle(numId);
        if (!cancelled) {
          setArticle(data);
          const summaryText = data.summary?.trim() ?? "";
          const hasSummary = summaryText.length > 0;
          const totalPs = data.sentences.length + (hasSummary ? 1 : 0);
          const maxIdx = Math.max(0, totalPs - 1);

          const sentencePage = searchParams.get("sentence");
          const pageNum = sentencePage != null ? parseInt(sentencePage, 10) : NaN;

          let nextIndex = 0;
          if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= data.sentences.length) {
            nextIndex = pageNum - 1;
          } else {
            const stored = readStoredDetailPageIndex(numId, maxIdx);
            if (stored !== null) nextIndex = stored;
          }
          setCurrentIndex(nextIndex);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "기사를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);

  const sentences = article?.sentences ?? [];
  const totalSentences = sentences.length;
  const summaryText = article?.summary?.trim() ?? "";
  const hasSummary = summaryText.length > 0;
  const totalPages = totalSentences + (hasSummary ? 1 : 0);
  const isSummaryPage = hasSummary && currentIndex === totalPages - 1;
  const canGoPrev = totalPages > 0 && currentIndex > 0;
  const canGoNext = totalPages > 0 && currentIndex < totalPages - 1;
  const currentSentence = !isSummaryPage && totalSentences > 0 ? sentences[currentIndex] : null;

  useEffect(() => {
    if (!article || !id) return;
    const rawId = id.trim();
    const routeId = parseInt(rawId, 10);
    if (Number.isNaN(routeId) || article.id !== routeId) return;
    if (totalPages === 0) return;
    const safeIndex = Math.max(0, Math.min(currentIndex, totalPages - 1));
    writeStoredDetailPageIndex(article.id, safeIndex);
  }, [article, id, currentIndex, totalPages]);

  useLayoutEffect(() => {
    const container = dotsRowRef.current;
    if (!container || totalPages === 0) return;
    const track = container.querySelector<HTMLElement>(".detail-swipe-dots-track");
    if (!track) return;
    if (currentIndex >= track.children.length) return;
    const run = () => scrollDotsRowForIndex(container, track, currentIndex);
    run();
    requestAnimationFrame(run);
  }, [currentIndex, totalPages]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < totalPages - 1 ? i + 1 : i));
  }, [totalPages]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (totalPages === 0) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [totalPages, goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    setTouchDeltaX(e.targetTouches[0].clientX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) return;
    // 왼쪽으로 밀면 다음 문장, 오른쪽으로 밀면 이전 문장 (모바일 카드 스와이프 관성)
    if (touchDeltaX < -SWIPE_THRESHOLD && canGoNext) goNext();
    else if (touchDeltaX > SWIPE_THRESHOLD && canGoPrev) goPrev();
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  if (loading) {
    return (
      <div className="user-layout detail-page-layout">
        <main className="user-main detail-main">
          <div className="feed-loading">기사를 불러오는 중...</div>
        </main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="user-layout detail-page-layout">
        <main className="user-main detail-main">
          <div className="feed-error">{error ?? "기사를 찾을 수 없습니다."}</div>
          <button type="button" className="detail-back" onClick={() => navigate(-1)}>
            ← 목록으로
          </button>
        </main>
      </div>
    );
  }

  if (totalSentences === 0) {
    return (
      <div className="user-layout">
        <main className="user-main detail-main">
          <div className="detail-nav-row detail-nav-row--single">
            <button type="button" className="detail-back" onClick={() => navigate(-1)}>
              ← 목록으로
            </button>
          </div>
          {!hasSummary && <p className="feed-empty">분석된 문장이 없습니다.</p>}
          {hasSummary && (
            <div className="detail-card-merged">
              <div className="detail-date-in-card">
                <span className="detail-date">{formatStudyDate(article.study_date_ymd)}</span>
              </div>
              <section className="detail-summary-card detail-summary-card--merged">
                <span className="detail-summary-badge">Summary</span>
                <p className="detail-summary-text">{summaryText}</p>
              </section>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (!currentSentence && !isSummaryPage) {
    return null;
  }

  return (
    <div className="user-layout detail-swipe-layout detail-page-layout">
      <main className="user-main detail-main">
        <div className="detail-progress-wrap detail-progress-wrap--compact" aria-hidden>
          <div className="detail-progress-track">
            <div
              className="detail-progress-fill"
              style={{ width: `${((currentIndex + 1) / totalPages) * 100}%` }}
            />
          </div>
          <span className="detail-progress-label">
            {currentIndex + 1} / {totalPages}
          </span>
        </div>

        <div className="detail-nav-row">
          <button type="button" className="detail-back" onClick={() => navigate(-1)}>
            ← 목록으로
          </button>
          <button
            type="button"
            className="detail-toc-toggle"
            onClick={() => setShowToc((v) => !v)}
            aria-expanded={showToc}
          >
            문장 목록 ({totalPages})
          </button>
        </div>

        {showToc && (
          <div className="detail-toc-panel">
            <div className="detail-toc-panel-head">문장 바로가기</div>
            <ul className="detail-toc-list">
              {sentences.map((s, i) => {
                const preview = s.english.length > 45 ? `${s.english.slice(0, 45)}…` : s.english;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`detail-toc-item ${i === currentIndex ? "active" : ""}`}
                      title={s.english}
                      onClick={() => {
                        setCurrentIndex(i);
                        setShowToc(false);
                      }}
                    >
                      <span className="detail-toc-num">{i + 1}</span>
                      <span className="detail-toc-preview">{preview}</span>
                    </button>
                  </li>
                );
              })}
              {hasSummary && (
                <li>
                  <button
                    type="button"
                    className={`detail-toc-item detail-toc-item-summary ${isSummaryPage ? "active" : ""}`}
                    onClick={() => {
                      setCurrentIndex(totalPages - 1);
                      setShowToc(false);
                    }}
                  >
                    <span className="detail-toc-num">{totalPages}</span>
                    <span className="detail-toc-preview">요약</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        <div
          className="detail-swipe-container detail-swipe-single"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="detail-sentence-wrap detail-sentence-wrap-single">
            <div className="detail-card-merged">
              <div className="detail-date-in-card">
                <span className="detail-date">{formatStudyDate(article.study_date_ymd)}</span>
              </div>
              {isSummaryPage ? (
                <section className="detail-summary-card detail-summary-card--merged">
                  <span className="detail-summary-badge">Summary</span>
                  <p className="detail-summary-text">{summaryText}</p>
                </section>
              ) : currentSentence ? (
                <SentenceCard
                  key={currentSentence.id}
                  sentence={currentSentence}
                  articleId={article.id}
                  articleTitle={formatStudyDate(article.study_date_ymd) || "기사"}
                  sentenceIndex={currentIndex}
                  bookmarkVersion={bookmarkVersion}
                  onBookmarkToggle={() => setBookmarkVersion((v) => v + 1)}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="detail-swipe-bar">
          <div className="detail-swipe-nav">
            <button
              type="button"
              className="detail-swipe-btn detail-swipe-prev"
              onClick={goPrev}
              disabled={!canGoPrev}
              aria-label="이전 문장"
            >
              ←
            </button>
            <span className="detail-swipe-indicator">
              {currentIndex + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="detail-swipe-btn detail-swipe-next"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label="다음 문장"
            >
              →
            </button>
          </div>
          <div className="detail-swipe-dots" ref={dotsRowRef}>
            <div className="detail-swipe-dots-track">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`detail-swipe-dot ${i === currentIndex ? "active" : ""} ${hasSummary && i === totalPages - 1 ? "is-summary-dot" : ""}`}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    /* 모바일: 첫 터치에서 click 이 누락·지연되는 경우 대비 */
                    if (e.pointerType === "touch" || e.pointerType === "pen") {
                      e.preventDefault();
                      setCurrentIndex(i);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                  aria-label={i < totalSentences ? `문장 ${i + 1}` : "요약"}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

type SentenceCardProps = {
  sentence: ArticleSentence;
  articleId: number;
  articleTitle: string;
  sentenceIndex: number;
  bookmarkVersion: number;
  onBookmarkToggle: () => void;
};

function SentenceCard({
  sentence,
  articleId,
  articleTitle,
  sentenceIndex,
  bookmarkVersion,
  onBookmarkToggle,
}: SentenceCardProps) {
  const bookmarkedIds = new Set(
    getBookmarks().map((b) => b.expressionId)
  );

  const handleBookmark = (ex: { id: number; expression: string; explanation_ko: string; category: string | null }) => {
    const item: BookmarkItem = {
      expressionId: ex.id,
      sentenceId: sentence.id,
      articleId,
      sentenceIndex,
      expression: ex.expression,
      explanation_ko: ex.explanation_ko,
      category: ex.category ?? null,
      articleTitle,
      sentenceEnglish: sentence.english,
      createdAt: Date.now(),
    };
    toggleBookmark(item);
    onBookmarkToggle();
  };

  return (
    <section className="detail-sentence">
      <p className="sentence-english">{sentence.english}</p>
      <p className="sentence-korean">{sentence.korean}</p>
      {sentence.note_summary && (
        <div className="sentence-note-wrap">
          <span className="sentence-note-label">Note</span>
          <p className="sentence-note">{sentence.note_summary}</p>
        </div>
      )}
      {sentence.expressions.length > 0 && (
        <>
          <h4 className="detail-expressions-heading">핵심 표현</h4>
          <ul className="sentence-expressions">
          {sentence.expressions.map((ex) => (
            <li key={ex.id} className="expression-item">
              <div className="expression-content">
                <strong className="expression-word">{ex.expression}</strong>
                <span className="expression-explanation">{ex.explanation_ko}</span>
                {ex.category && (
                  <span className="expression-category">{ex.category}</span>
                )}
              </div>
              <button
                type="button"
                className={`expression-bookmark ${bookmarkedIds.has(ex.id) ? "is-saved" : ""}`}
                onClick={() => handleBookmark(ex)}
                title={bookmarkedIds.has(ex.id) ? "저장 취소" : "저장"}
                aria-label={bookmarkedIds.has(ex.id) ? "저장 취소" : "표현 저장"}
              >
                {bookmarkedIds.has(ex.id) ? "★" : "☆"}
              </button>
            </li>
          ))}
          </ul>
        </>
      )}
    </section>
  );
}

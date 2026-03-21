import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { fetchArticle, formatStudyDate, type Article, type ArticleSentence } from "../api";
import { getBookmarks, toggleBookmark, type BookmarkItem } from "../bookmarks";

const SWIPE_THRESHOLD = 50;

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
          const sentencePage = searchParams.get("sentence");
          const pageNum = sentencePage != null ? parseInt(sentencePage, 10) : NaN;
          if (!Number.isNaN(pageNum) && pageNum >= 1 && pageNum <= data.sentences.length) {
            setCurrentIndex(pageNum - 1);
          } else {
            setCurrentIndex(0);
          }
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
  const total = sentences.length;
  const canGoPrev = total > 0 && currentIndex > 0;
  const canGoNext = total > 0 && currentIndex < total - 1;
  const currentSentence = total > 0 ? sentences[currentIndex] : null;

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i < total - 1 ? i + 1 : i));
  }, [total]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (total === 0) return;
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
  }, [total, goPrev, goNext]);

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
      <div className="user-layout">
        <main className="user-main">
          <div className="feed-loading">로딩 중...</div>
        </main>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="user-layout">
        <main className="user-main">
          <div className="feed-error">{error ?? "기사를 찾을 수 없습니다."}</div>
          <button type="button" className="detail-back" onClick={() => navigate(-1)}>
            목록으로
          </button>
        </main>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="user-layout">
        <main className="user-main detail-main">
          <button type="button" className="detail-back" onClick={() => navigate(-1)}>
            ← 목록으로
          </button>
          <header className="detail-header">
            <span className="detail-date">{formatStudyDate(article.study_date_ymd)}</span>
            {article.source && <span className="detail-source">{article.source}</span>}
            <h1 className="detail-title">{article.title}</h1>
          </header>
          <p className="feed-empty">분석된 문장이 없습니다.</p>
        </main>
      </div>
    );
  }

  if (!currentSentence) {
    return null;
  }

  return (
    <div className="user-layout detail-swipe-layout">
      <main className="user-main detail-main">
        <button type="button" className="detail-back" onClick={() => navigate(-1)}>
          ← 목록으로
        </button>

        <header className="detail-header">
          <span className="detail-date">{formatStudyDate(article.study_date_ymd)}</span>
          {article.source && <span className="detail-source">{article.source}</span>}
          <h1 className="detail-title">{article.title}</h1>
          <button
            type="button"
            className="detail-toc-toggle"
            onClick={() => setShowToc((v) => !v)}
            aria-expanded={showToc}
          >
            문장 목록 ({total})
          </button>
        </header>

        {showToc && (
          <div className="detail-toc-panel">
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
            <SentenceCard
              key={currentSentence.id}
              sentence={currentSentence}
              articleId={article.id}
              articleTitle={article.title}
              sentenceIndex={currentIndex}
              bookmarkVersion={bookmarkVersion}
              onBookmarkToggle={() => setBookmarkVersion((v) => v + 1)}
            />
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
              {currentIndex + 1} / {total}
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
          <div className="detail-swipe-dots">
            {sentences.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`detail-swipe-dot ${i === currentIndex ? "active" : ""}`}
                onClick={() => setCurrentIndex(i)}
                aria-label={`문장 ${i + 1}`}
              />
            ))}
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
        <p className="sentence-note">{sentence.note_summary}</p>
      )}
      {sentence.expressions.length > 0 && (
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
      )}
    </section>
  );
}

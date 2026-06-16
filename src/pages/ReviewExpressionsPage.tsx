import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getBookmarks, type BookmarkItem } from "../bookmarks";

const REVIEW_SIG_KEY = "reviewBookmarkSig";
const REVIEW_ORDER_KEY = "reviewBookmarkOrder";
const REVIEW_IDX_KEY = "reviewBookmarkIndex";
const SWIPE_THRESHOLD = 50;

function bookmarkSetSig(bookmarks: BookmarkItem[]): string {
  return [...new Set(bookmarks.map((b) => b.expressionId))]
    .sort((a, b) => a - b)
    .join(",");
}

function shuffleIds(ids: number[]): number[] {
  const copy = [...ids];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isValidOrder(order: number[], bookmarks: BookmarkItem[]): boolean {
  const ids = new Set(bookmarks.map((b) => b.expressionId));
  if (order.length !== bookmarks.length) return false;
  const seen = new Set<number>();
  for (const id of order) {
    if (!ids.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function readSession(bookmarks: BookmarkItem[]): { order: number[]; index: number } {
  const sig = bookmarkSetSig(bookmarks);
  try {
    const prevSig = sessionStorage.getItem(REVIEW_SIG_KEY);
    const rawOrder = sessionStorage.getItem(REVIEW_ORDER_KEY);
    const rawIdx = sessionStorage.getItem(REVIEW_IDX_KEY);
    if (prevSig === sig && rawOrder) {
      const order = JSON.parse(rawOrder) as unknown;
      if (!Array.isArray(order) || !order.every((x) => typeof x === "number")) {
        throw new Error("invalid order");
      }
      if (!isValidOrder(order, bookmarks)) throw new Error("stale order");
      let idx = parseInt(rawIdx ?? "0", 10);
      if (Number.isNaN(idx)) idx = 0;
      idx = Math.max(0, Math.min(idx, order.length - 1));
      return { order, index: idx };
    }
  } catch {
    /* fall through */
  }
  const order = shuffleIds(bookmarks.map((b) => b.expressionId));
  try {
    sessionStorage.setItem(REVIEW_SIG_KEY, sig);
    sessionStorage.setItem(REVIEW_ORDER_KEY, JSON.stringify(order));
    sessionStorage.setItem(REVIEW_IDX_KEY, "0");
  } catch {
    /* ignore */
  }
  return { order, index: 0 };
}

function persistIndex(index: number) {
  try {
    sessionStorage.setItem(REVIEW_IDX_KEY, String(index));
  } catch {
    /* ignore */
  }
}

function persistReshuffle(bookmarks: BookmarkItem[], order: number[]) {
  const sig = bookmarkSetSig(bookmarks);
  try {
    sessionStorage.setItem(REVIEW_SIG_KEY, sig);
    sessionStorage.setItem(REVIEW_ORDER_KEY, JSON.stringify(order));
    sessionStorage.setItem(REVIEW_IDX_KEY, "0");
  } catch {
    /* ignore */
  }
}

export const ReviewExpressionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => getBookmarks());
  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const suppressTapRef = useRef(false);

  useEffect(() => {
    const list = getBookmarks();
    setBookmarks(list);
    if (list.length === 0) {
      setOrder([]);
      setIndex(0);
      setSessionReady(true);
      return;
    }
    const { order: o, index: i } = readSession(list);
    setOrder(o);
    setIndex(i);
    setSessionReady(true);
  }, []);

  const byId = useMemo(() => {
    const m = new Map<number, BookmarkItem>();
    for (const b of bookmarks) m.set(b.expressionId, b);
    return m;
  }, [bookmarks]);

  const total = order.length;
  const currentId = total > 0 ? order[index] : undefined;
  const current = currentId != null ? byId.get(currentId) : undefined;

  useEffect(() => {
    if (!sessionReady || total === 0) {
      document.title = "표현 복습";
      return;
    }
    document.title = `복습 (${index + 1}/${total})`;
    return () => {
      document.title = "Matthew English";
    };
  }, [sessionReady, total, index]);

  useEffect(() => {
    if (!sessionReady || total === 0) return;
    persistIndex(index);
  }, [sessionReady, total, index]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (total === 0) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => (i > 0 ? i - 1 : i));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => (i < total - 1 ? i + 1 : i));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((i) => (i < total - 1 ? i + 1 : i));
  }, [total]);

  const handleReshuffle = useCallback(() => {
    const list = getBookmarks();
    setBookmarks(list);
    if (list.length === 0) {
      setOrder([]);
      setIndex(0);
      return;
    }
    const nextOrder = shuffleIds(list.map((b) => b.expressionId));
    persistReshuffle(list, nextOrder);
    setOrder(nextOrder);
    setIndex(0);
    setFlipped(false);
  }, []);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  if (!sessionReady) {
    return (
      <div className="user-layout">
        <main className="user-main review-expressions-main">
          <h1 className="sr-only">표현 복습</h1>
          <div className="feed-loading">준비 중...</div>
        </main>
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="user-layout">
        <main className="user-main review-expressions-main">
          <h1 className="saved-expressions-title">표현 복습</h1>
          <p className="saved-expressions-empty">복습할 저장 표현이 없습니다.</p>
          <Link to="/saved" className="detail-back saved-expressions-back">
            ← 저장한 표현으로
          </Link>
        </main>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="user-layout">
        <main className="user-main review-expressions-main">
          <h1 className="sr-only">표현 복습</h1>
          <p className="saved-expressions-empty">카드를 불러오지 못했습니다.</p>
          <Link to="/saved" className="detail-back saved-expressions-back">
            ← 저장한 표현으로
          </Link>
        </main>
      </div>
    );
  }

  const canPrev = index > 0;
  const canNext = index < total - 1;
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchDeltaX(0);
    suppressTapRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    setTouchDeltaX(e.targetTouches[0].clientX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) return;
    // 상세 페이지와 동일 기준: 50px 이상 밀었을 때만 페이지 이동
    if (touchDeltaX < -SWIPE_THRESHOLD && canNext) {
      goNext();
      suppressTapRef.current = true;
    } else if (touchDeltaX > SWIPE_THRESHOLD && canPrev) {
      goPrev();
      suppressTapRef.current = true;
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  return (
    <div className="user-layout review-page-layout">
      <main className="user-main review-expressions-main">
        <header className="review-page-header">
          <span className="review-page-eyebrow">Flashcards</span>
          <h1 className="review-page-title">표현 복습</h1>
          <p className="review-page-subtitle">카드를 탭하거나 스와이프해 보세요</p>
          <div className="review-progress-wrap" aria-hidden>
            <div className="review-progress-track">
              <div
                className="review-progress-fill"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
            <span className="review-progress-label">
              {index + 1} / {total}
            </span>
          </div>
        </header>

        <div className="review-toolbar">
          <button
            type="button"
            className="detail-back review-toolbar-back"
            onClick={() => navigate("/saved")}
          >
            ← 저장 목록
          </button>
          <button type="button" className="review-reshuffle-btn" onClick={handleReshuffle}>
            다시 섞기
          </button>
        </div>

        <div className="review-card-shell">
          <div
            className={`review-card ${flipped ? "review-card--flipped" : ""}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => {
              if (suppressTapRef.current) {
                suppressTapRef.current = false;
                return;
              }
              toggleFlip();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleFlip();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? "뜻 보기 중, 탭하면 앞면" : "표현 보기 중, 탭하면 뜻"}
          >
            <div className="review-card-inner">
              <div className="review-card-face review-card-front">
                {current.sentenceEnglish.trim() ? (
                  <p className="review-card-context">{current.sentenceEnglish}</p>
                ) : null}
                <p className="review-card-expression">{current.expression}</p>
                {current.category ? (
                  <span className="review-card-category">{current.category}</span>
                ) : null}
                <span className="review-card-hint">탭해서 뜻 보기</span>
              </div>
              <div className="review-card-face review-card-back">
                <p className="review-card-expression review-card-expression--small">{current.expression}</p>
                <p className="review-card-explanation">{current.explanation_ko}</p>
                <span className="review-card-hint">탭해서 앞면</span>
              </div>
            </div>
          </div>
        </div>

        <div className="review-bottom-bar">
          <div className="review-nav">
            <button type="button" className="review-nav-btn" onClick={goPrev} disabled={!canPrev} aria-label="이전 카드">
              ←
            </button>
            <button
              type="button"
              className="review-flip-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleFlip();
              }}
            >
              {flipped ? "앞면" : "뜻 보기"}
            </button>
            <button type="button" className="review-nav-btn" onClick={goNext} disabled={!canNext} aria-label="다음 카드">
              →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

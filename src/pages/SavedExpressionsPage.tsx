import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getBookmarks, removeBookmark, type BookmarkItem } from "../bookmarks";

const SAVED_SORT_KEY = "savedExpressionsSort";
const SAVED_SEARCH_QUERY_KEY = "savedExpressionsSearchQuery";
type SavedSort = "recent" | "alpha";

function readStoredSavedSort(): SavedSort {
  try {
    const s = sessionStorage.getItem(SAVED_SORT_KEY);
    if (s === "recent" || s === "alpha") return s;
  } catch {
    /* ignore */
  }
  return "recent";
}

function readStoredSavedSearchQuery(): string {
  try {
    return sessionStorage.getItem(SAVED_SEARCH_QUERY_KEY) ?? "";
  } catch {
    return "";
  }
}

export const SavedExpressionsPage: React.FC = () => {
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [query, setQuery] = useState(readStoredSavedSearchQuery);
  const [sort, setSort] = useState<SavedSort>(readStoredSavedSort);

  useEffect(() => {
    setItems(getBookmarks());
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SAVED_SORT_KEY, sort);
    } catch {
      /* ignore */
    }
  }, [sort]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SAVED_SEARCH_QUERY_KEY, query);
    } catch {
      /* ignore */
    }
  }, [query]);

  const handleRemove = (expressionId: number) => {
    removeBookmark(expressionId);
    setItems(getBookmarks());
  };

  const trimmedQuery = query.trim().toLowerCase();
  const searched =
    trimmedQuery === ""
      ? items
      : items.filter((b) => {
          const expr = b.expression.toLowerCase();
          const expl = b.explanation_ko.toLowerCase();
          const cat = (b.category ?? "").toLowerCase();
          return (
            expr.includes(trimmedQuery) ||
            expl.includes(trimmedQuery) ||
            cat.includes(trimmedQuery)
          );
        });

  const filtered = [...searched].sort((a, b) => {
    if (sort === "alpha") {
      return a.expression.localeCompare(b.expression);
    }
    // recent: createdAt 기준 내림차순 (최근 저장한 순)
    const aTime = a.createdAt ?? 0;
    const bTime = b.createdAt ?? 0;
    return bTime - aTime;
  });

  if (items.length === 0) {
    return (
      <div className="user-layout">
        <main className="user-main saved-expressions-main">
          <h1 className="saved-expressions-title">저장한 표현</h1>
          <p className="saved-expressions-empty">
            아직 저장한 표현이 없습니다.
            <br />
            기사 상세에서 표현 옆 ☆를 눌러 저장해 보세요.
          </p>
          <Link to="/" className="detail-back saved-expressions-back">
            ← 피드로 돌아가기
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="user-layout">
      <main className="user-main saved-expressions-main">
        <h1 className="saved-expressions-title">저장한 표현 ({items.length})</h1>
        <Link to="/" className="detail-back saved-expressions-back">
          ← 피드로 돌아가기
        </Link>
        <div className="saved-expressions-toolbar">
          <div className="saved-expressions-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="saved-expressions-search-input"
              placeholder="표현, 뜻, 카테고리로 검색해 보세요"
            />
            {trimmedQuery && (
              <span className="saved-expressions-search-count">
                검색 결과 {filtered.length}개
              </span>
            )}
          </div>
          <div className="saved-expressions-sort" aria-label="정렬">
            <button
              type="button"
              className={`saved-expressions-sort-btn ${sort === "recent" ? "active" : ""}`}
              onClick={() => setSort("recent")}
            >
              최신순
            </button>
            <button
              type="button"
              className={`saved-expressions-sort-btn ${sort === "alpha" ? "active" : ""}`}
              onClick={() => setSort("alpha")}
            >
              A → Z
            </button>
          </div>
        </div>
        <ul className="saved-expressions-list">
          {filtered.map((b) => (
            <li key={b.expressionId} className="saved-expression-item">
              <div className="saved-expression-content">
                <strong className="saved-expression-word">{b.expression}</strong>
                <span className="saved-expression-explanation">{b.explanation_ko}</span>
                {b.category && (
                  <span className="saved-expression-category">{b.category}</span>
                )}
                <Link
                  to={`/articles/${b.articleId}?sentence=${b.sentenceIndex + 1}`}
                  className="saved-expression-link"
                >
                  기사: {b.articleTitle}
                </Link>
              </div>
              <button
                type="button"
                className="saved-expression-remove"
                onClick={() => handleRemove(b.expressionId)}
                title="저장 취소"
                aria-label="저장 취소"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

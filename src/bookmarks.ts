const STORAGE_KEY = "matthew-english-bookmarks";

export type BookmarkItem = {
  expressionId: number;
  sentenceId: number;
  articleId: number;
  sentenceIndex: number;
  expression: string;
  explanation_ko: string;
  category: string | null;
  articleTitle: string;
  sentenceEnglish: string;
  createdAt?: number;
};

export function getBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const b = item as BookmarkItem;
      if (b.createdAt == null) {
        return { ...b, createdAt: Date.now() };
      }
      return b;
    });
  } catch {
    return [];
  }
}

export function saveBookmarks(items: BookmarkItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function isBookmarked(expressionId: number): boolean {
  return getBookmarks().some((b) => b.expressionId === expressionId);
}

export function toggleBookmark(item: BookmarkItem): boolean {
  const list = getBookmarks();
  const idx = list.findIndex((b) => b.expressionId === item.expressionId);
  if (idx >= 0) {
    list.splice(idx, 1);
    saveBookmarks(list);
    return false;
  }
  list.push(item);
  saveBookmarks(list);
  return true;
}

export function removeBookmark(expressionId: number): void {
  saveBookmarks(getBookmarks().filter((b) => b.expressionId !== expressionId));
}

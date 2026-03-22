import React, { useCallback, useState } from "react";
import { requestAndPlayArticleTts } from "../articleTtsPlayer";
import type { TtsAccent } from "../api";

type Props = {
  articleId: number;
  onError?: (message: string) => void;
};

const FLAG_BASE = `${import.meta.env.BASE_URL}flags/`;

const ACCENTS: { accent: TtsAccent; label: string; aria: string }[] = [
  { accent: "us", label: "US", aria: "미국 영어 음성으로 기사 전문 듣기" },
  { accent: "gb", label: "GB", aria: "영국 영어 음성으로 기사 전문 듣기" },
  { accent: "au", label: "AU", aria: "호주 영어 음성으로 기사 전문 듣기" },
];

export const FeedArticleTtsButtons: React.FC<Props> = ({ articleId, onError }) => {
  /** TTS API 수신 중에만 전체 버튼 비활성 (재생 중에는 다른 악센트로 전환 가능) */
  const [fetchingAccent, setFetchingAccent] = useState<TtsAccent | null>(null);

  const handleClick = useCallback(
    async (accent: TtsAccent) => {
      if (fetchingAccent !== null) return;
      setFetchingAccent(accent);
      try {
        await requestAndPlayArticleTts(articleId, accent, {
          onFetchComplete: () => setFetchingAccent(null),
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        const msg = e instanceof Error ? e.message : "음성 재생에 실패했습니다.";
        onError?.(msg);
      } finally {
        setFetchingAccent(null);
      }
    },
    [articleId, onError, fetchingAccent]
  );

  return (
    <div
      className="feed-tts-tray"
      role="group"
      aria-label="기사 전문 음성 듣기"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {ACCENTS.map(({ accent, label, aria }) => (
        <button
          key={accent}
          type="button"
          className={`feed-tts-pill ${fetchingAccent === accent ? "feed-tts-pill--loading" : ""}`}
          onClick={() => void handleClick(accent)}
          disabled={fetchingAccent !== null}
          aria-label={aria}
        >
          <span className="feed-tts-flag-ring" aria-hidden>
            <img
              className="feed-tts-flag-img"
              src={`${FLAG_BASE}${accent}.svg`}
              alt=""
              width={14}
              height={14}
              loading="lazy"
              decoding="async"
            />
          </span>
          <span className="feed-tts-code">{label}</span>
        </button>
      ))}
    </div>
  );
};

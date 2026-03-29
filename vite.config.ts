import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

/** index.html의 script/link(modulepreload 등)에 ?v= 붙여 CDN·브라우저 캐시 무효화 */
function cacheBustQueryPlugin(): Plugin {
  const buildId =
    process.env.VITE_CACHE_BUST?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim().slice(0, 12) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 12) ||
    String(Date.now());
  const v = encodeURIComponent(buildId);

  return {
    name: "cache-bust-query",
    transformIndexHtml: {
      order: "post",
      handler(html: string) {
        return html.replace(
          /(src|href)="(\/[^"?]+\.(?:js|mjs|css|tsx))"/gi,
          (full, attr, path) => {
            if (full.includes("?v=") || full.includes(`?v=${v}`)) return full;
            return `${attr}="${path}?v=${v}"`;
          },
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), cacheBustQueryPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});


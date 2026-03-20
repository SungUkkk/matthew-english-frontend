import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FeedPage } from "./pages/FeedPage";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";
import { SavedExpressionsPage } from "./pages/SavedExpressionsPage";
import { AdminPage } from "./pages/AdminPage";
import { ThemeProvider } from "./theme";
import { ZoomProvider } from "./zoom";
import "./styles.css";

export const App: React.FC = () => (
  <BrowserRouter>
    <ThemeProvider>
      <ZoomProvider>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/articles/:id" element={<ArticleDetailPage />} />
          <Route path="/saved" element={<SavedExpressionsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </ZoomProvider>
    </ThemeProvider>
  </BrowserRouter>
);

import React from "react";
import ReactDOM from "react-dom/client";
import MarkdownViewer from "@/MarkdownViewer";
import "@/index.css"; // Tailwind CSS
import "@/markdown-styles.css"; // Markdown-specific styles
import { testMarkdownContent, shortMarkdownContent } from "@/test/testContent";

// Function to render the React app
function renderApp() {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <MarkdownViewer />
      </React.StrictMode>
    );
  }
}

// Development mode: inject test content
if (import.meta.env.DEV) {
  console.log("🚀 Running in development mode");

  // Inject test markdown content
  window.markdownContent = testMarkdownContent;
  window.markdownContentReady = true;

  // Add dev tools to window for testing
  (window as any).devTools = {
    setContent: (content: string) => {
      window.markdownContent = content;
      window.markdownContentReady = true;
      // Force re-render
      const rootElement = document.getElementById("root");
      if (rootElement) {
        rootElement.innerHTML = "";
        renderApp();
      }
    },
    loadTestContent: () => {
      (window as any).devTools.setContent(testMarkdownContent);
    },
    loadShortContent: () => {
      (window as any).devTools.setContent(shortMarkdownContent);
    },
    loadCustomContent: (content: string) => {
      (window as any).devTools.setContent(content);
    },
  };

  console.log("📝 Test content loaded!");
  console.log("🛠️  Available dev tools:");
  console.log("  - devTools.loadTestContent() - Load full test document");
  console.log("  - devTools.loadShortContent() - Load short test");
  console.log("  - devTools.loadCustomContent(content) - Load custom markdown");

  // Render immediately in dev mode
  renderApp();
} else {
  // Production mode: wait for markdown content to be loaded
  if (window.markdownContentReady) {
    // Content already loaded, render immediately
    console.log("📄 Markdown content ready, rendering app...");
    renderApp();
  } else {
    // Wait for content to load
    console.log("⏳ Waiting for markdown content...");
    window.addEventListener('markdownContentLoaded', () => {
      console.log("📄 Markdown content loaded, rendering app...");
      renderApp();
    }, { once: true });
  }
}

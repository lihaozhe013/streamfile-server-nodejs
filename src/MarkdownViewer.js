import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./markdown-styles.css";

function MarkdownViewer() {
  // Get markdown content from window object (passed from server)
  const [markdownText, setMarkdownText] = useState(window.markdownContent || "");
  const [isPreviewOnly, setIsPreviewOnly] = useState(true);

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsPreviewOnly(!isPreviewOnly);
  };

  // Handle markdown changes in edit mode
  const handleMarkdownChange = (e) => {
    setMarkdownText(e.target.value);
  };

  return (
    <div className="markdown-viewer">
      <div className="toolbar">
        <h1>Markdown Viewer</h1>
        <button onClick={toggleEditMode}>
          {isPreviewOnly ? "Edit" : "Preview Only"}
        </button>
      </div>
      <blockquote id="bloackquote-notes">Note: The edit feature is temporary and is for preview purposes only, it does not modify the file!</blockquote>
      <br />
      <div className={`container ${isPreviewOnly ? "preview-only" : ""}`}>
        {!isPreviewOnly && (
          <textarea
            className="editor"
            value={markdownText}
            onChange={handleMarkdownChange}
          ></textarea>
        )}
        <div className="preview">
          <ReactMarkdown
            children={markdownText}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          />
        </div>
      </div>
    </div>
  );
}

// Initialize the app
function init() {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    ReactDOM.render(<MarkdownViewer />, rootElement);
  }
}

// Run the app
if (typeof window !== "undefined") {
  import("react-dom").then((ReactDOM) => {
    window.ReactDOM = ReactDOM;
    init();
  });
}

export default MarkdownViewer;
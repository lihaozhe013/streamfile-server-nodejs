import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

import type { MarkdownViewerProps, Heading } from "@/types";
import {
  cleanMarkdownText,
  generateHeadingId,
  extractTextContent,
  processRelativePaths,
  extractHeadings,
} from "@/utils/markdown";
import DevToolsPanel from "@/components/DevToolsPanel";

const MarkdownViewer: React.FC<MarkdownViewerProps> = () => {
  // Get markdown content from window object (passed from server)
  const [markdownText, setMarkdownText] = useState<string>(
    window.markdownContent || ""
  );
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const usedIds = useRef<Set<string>>(new Set());

  // Extract headings from markdown content
  useEffect(() => {
    if (markdownText) {
      const { headings: extractedHeadings, usedIds: newUsedIds } =
        extractHeadings(markdownText);
      usedIds.current = newUsedIds;
      setHeadings(extractedHeadings);
      setActiveHeading("");
    }
  }, [markdownText]);

  // Handle scroll to update active heading
  useEffect(() => {
    const handleScroll = () => {
      if (headings.length === 0) return;

      const scrollPosition = window.scrollY + 120; // Offset for header
      let currentActiveHeading = "";

      // Find the heading that's currently in view
      for (let i = 0; i < headings.length; i++) {
        const element = document.getElementById(headings[i].id);
        if (element) {
          const elementTop = element.offsetTop;

          if (scrollPosition >= elementTop - 50) {
            currentActiveHeading = headings[i].id;
          } else {
            break;
          }
        }
      }

      // If no heading found and we're at the top, clear active heading
      if (!currentActiveHeading && scrollPosition < 200) {
        currentActiveHeading = "";
      }

      if (currentActiveHeading !== activeHeading) {
        setActiveHeading(currentActiveHeading);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings, activeHeading]);

  // Handle relative paths in markdown content
  useEffect(() => {
    if (window.markdownContent) {
      const processedContent = processRelativePaths(
        window.markdownContent,
        window.location.pathname
      );
      setMarkdownText(processedContent);
    }
  }, []);

  // Handle back button click
  const handleBackClick = () => {
    const currentPath = window.location.pathname;
    const lastSlashIndex = currentPath.lastIndexOf("/");
    if (lastSlashIndex > 0) {
      const parentPath = currentPath.substring(0, lastSlashIndex);
      window.location.href = parentPath;
    } else {
      window.location.href = "/";
    }
  };

  // Handle TOC item click
  const handleTocClick = (headingId: string) => {
    const element = document.getElementById(headingId);

    if (element) {
      const headerOffset = 80;
      const elementPosition = element.offsetTop - headerOffset;

      window.scrollTo({
        top: elementPosition,
        behavior: "smooth",
      });

      setActiveHeading(headingId);
    } else {
      console.warn("Heading element not found for ID:", headingId);
      // Fallback: try to find by text content
      const allHeadings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      const targetHeading = headings.find((h) => h.id === headingId);

      if (targetHeading) {
        const fallbackElement = Array.from(allHeadings).find((el) => {
          const elementText = el.textContent?.trim() || "";
          return (
            elementText === targetHeading.text ||
            cleanMarkdownText(elementText) === targetHeading.text ||
            elementText === cleanMarkdownText(targetHeading.text)
          );
        });

        if (fallbackElement) {
          const headerOffset = 80;
          const elementPosition =
            fallbackElement.getBoundingClientRect().top +
            window.scrollY -
            headerOffset;

          window.scrollTo({
            top: elementPosition,
            behavior: "smooth",
          });

          setActiveHeading(headingId);
        }
      }
    }
  };

  // Custom heading renderer to add IDs
  const createHeadingRenderer = (level: number) => {
    return ({ children, ...props }: any) => {
      const renderedText = extractTextContent(children);

      const matchingHeading = headings.find(
        (h) => h.text === renderedText && h.level === level
      );
      const fallbackHeading = !matchingHeading
        ? headings.find(
            (h) =>
              cleanMarkdownText(h.text) === renderedText && h.level === level
          )
        : null;

      const finalHeading = matchingHeading || fallbackHeading;
      const id = finalHeading
        ? finalHeading.id
        : generateHeadingId(renderedText, usedIds.current);

      const headingProps = { id, ...props };

      return React.createElement(`h${level}`, headingProps, children);
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        }}
        className="lg:hidden"
      >
        <div
          style={{
            maxWidth: 'none',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          {/* Mobile TOC Toggle */}
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.color = '#111827';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.color = '#374151';
              e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }}
            className="lg:hidden"
          >
            <svg
              style={{ width: '1rem', height: '1rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            Contents
          </button>
        </div>
      </header>

      {/* Mobile TOC Overlay */}
      {isTocOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsTocOpen(false)}
        >
          <div
            className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Table of Contents
              </h3>
              <button
                onClick={() => setIsTocOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <nav className="space-y-1">
              {headings.map((heading) => (
                <button
                  key={`mobile-${heading.id}-${heading.level}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTocClick(heading.id);
                    setIsTocOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                    activeHeading === heading.id
                      ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  style={{
                    paddingLeft: `${
                      Math.max(heading.level - 1, 0) * 16 + 12
                    }px`,
                    borderLeft:
                      activeHeading === heading.id
                        ? "3px solid #3b82f6"
                        : "3px solid transparent",
                  }}
                  title={heading.text}
                  data-heading-id={heading.id}
                  data-heading-level={heading.level}
                >
                  <span className="block truncate">{heading.text}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content with sidebar */}
      <main className="flex-1 flex max-w-none w-full">
        {/* Desktop Table of Contents Sidebar - Typora style */}
        <aside className="hidden lg:block w-80 flex-shrink-0 bg-white/50 border-r border-gray-200 h-screen sticky top-0">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <button
                onClick={handleBackClick}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>

              <h3 className="text-sm font-semibold text-gray-900 mt-4 uppercase tracking-wide">
                Outline
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 pt-4">
                {headings.length > 0 ? (
                  <nav className="space-y-1">
                    {headings.map((heading) => (
                      <button
                        key={`${heading.id}-${heading.level}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTocClick(heading.id);
                        }}
                        className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                          activeHeading === heading.id
                            ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                        style={{
                          paddingLeft: `${
                            Math.max(heading.level - 1, 0) * 16 + 12
                          }px`,
                          borderLeft:
                            activeHeading === heading.id
                              ? "3px solid #3b82f6"
                              : "3px solid transparent",
                        }}
                        title={heading.text}
                        data-heading-id={heading.id}
                        data-heading-level={heading.level}
                      >
                        <span className="block truncate">{heading.text}</span>
                      </button>
                    ))}
                  </nav>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No headings found
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Content area */}
        <div className="flex-1 flex flex-col max-w-none">
          <article className="w-full bg-white min-h-screen">
            {/* Content area with reduced margins */}
            <div className="px-8 py-8 md:px-12 md:py-12" ref={contentRef}>
              <div className="prose prose-lg prose-slate max-w-none preview">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw as any]}
                  skipHtml={false}
                  components={{
                    h1: createHeadingRenderer(1),
                    h2: createHeadingRenderer(2),
                    h3: createHeadingRenderer(3),
                    h4: createHeadingRenderer(4),
                    h5: createHeadingRenderer(5),
                    h6: createHeadingRenderer(6),
                    br: () => <br />,
                  }}
                >
                  {markdownText}
                </ReactMarkdown>
              </div>
            </div>
          </article>
        </div>
      </main>

      {/* Dev Tools Panel - only in development */}
      {import.meta.env.DEV && (
        <DevToolsPanel
          onLoadTest={() => (window as any).devTools?.loadTestContent()}
          onLoadShort={() => (window as any).devTools?.loadShortContent()}
        />
      )}
    </div>
  );
};

export default MarkdownViewer;

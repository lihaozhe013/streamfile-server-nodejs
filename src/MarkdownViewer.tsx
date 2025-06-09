import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "./markdown-styles.css";

// Extend the Window interface to include our custom property
declare global {
  interface Window {
    markdownContent?: string;
    ReactDOM?: any;
  }
}

interface MarkdownViewerProps {}

interface Heading {
  id: string;
  text: string;
  level: number;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = () => {
  // Get markdown content from window object (passed from server)
  const [markdownText, setMarkdownText] = useState<string>(
    window.markdownContent || ""
  );
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [isTocOpen, setIsTocOpen] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract headings from markdown content
  useEffect(() => {
    if (markdownText) {
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      const extractedHeadings: Heading[] = [];
      let match;

      while ((match = headingRegex.exec(markdownText)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        extractedHeadings.push({ id, text, level });
      }

      setHeadings(extractedHeadings);
    }
  }, [markdownText]);

  // Handle scroll to update active heading
  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map(h => document.getElementById(h.id)).filter(Boolean);
      
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const element = headingElements[i];
        if (element && element.getBoundingClientRect().top <= 100) {
          setActiveHeading(headings[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  // Handle relative paths in markdown content
  useEffect(() => {
    if (window.markdownContent) {
      // Get the current file path from the URL
      const currentPath = window.location.pathname;
      const pathSegments = currentPath.split('/');
      
      // Remove '/files/' prefix and get the directory path
      if (pathSegments[1] === 'files') {
        const filePath = pathSegments.slice(2).join('/');
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        
        // Process markdown content to handle relative paths
        let processedContent = window.markdownContent;
        
        // Handle relative image paths
        processedContent = processedContent.replace(
          /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
          (match, alt, src) => {
            // Skip if it's already an absolute path or starts with /
            if (src.startsWith('/') || src.startsWith('http')) {
              return match;
            }
            // Convert relative path to absolute path
            const absolutePath = dirPath ? `/files/${dirPath}/${src}` : `/files/${src}`;
            return `![${alt}](${absolutePath})`;
          }
        );
        
        // Handle relative link paths
        processedContent = processedContent.replace(
          /\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
          (match, text, href) => {
            // Skip if it's already an absolute path or starts with /
            if (href.startsWith('/') || href.startsWith('http') || href.startsWith('#')) {
              return match;
            }
            // Convert relative path to absolute path
            const absolutePath = dirPath ? `/files/${dirPath}/${href}` : `/files/${href}`;
            return `[${text}](${absolutePath})`;
          }
        );
        
        setMarkdownText(processedContent);
      }
    }
  }, []);

  // Handle back button click
  const handleBackClick = () => {
    window.history.back();
  };

  // Handle TOC item click
  const handleTocClick = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Custom heading renderer to add IDs
  const createHeadingRenderer = (level: number) => {
    return ({ children, ...props }: any) => {
      const text = children[0];
      const id = typeof text === 'string' ? text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') : '';
      
      const headingProps = { id, ...props };
      
      switch (level) {
        case 1:
          return <h1 {...headingProps}>{children}</h1>;
        case 2:
          return <h2 {...headingProps}>{children}</h2>;
        case 3:
          return <h3 {...headingProps}>{children}</h3>;
        case 4:
          return <h4 {...headingProps}>{children}</h4>;
        case 5:
          return <h5 {...headingProps}>{children}</h5>;
        case 6:
          return <h6 {...headingProps}>{children}</h6>;
        default:
          return <h1 {...headingProps}>{children}</h1>;
      }
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-none px-6 py-3 flex justify-end items-center">
          {/* Mobile TOC Toggle */}
          <button 
            onClick={() => setIsTocOpen(!isTocOpen)}
            className="lg:hidden inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Contents
          </button>
        </div>
      </header>

      {/* Mobile TOC Overlay */}
      {isTocOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsTocOpen(false)}>
          <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Table of Contents</h3>
              <button 
                onClick={() => setIsTocOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-1">
              {headings.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => {
                    handleTocClick(heading.id);
                    setIsTocOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    activeHeading === heading.id
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                >
                  {heading.text}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content with sidebar */}
      <main className="flex-1 flex max-w-none w-full">
        {/* Desktop Table of Contents Sidebar */}
        <aside className="hidden lg:block w-80 flex-shrink-0 bg-white/50 border-r border-gray-200 min-h-screen">
          <div className="sticky p-6">
            {/* Back button in sidebar */}
            <button 
              onClick={handleBackClick}
              className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Table of Contents</h3>
            {headings.length > 0 ? (
              <nav className="space-y-1">
                {headings.map((heading) => (
                  <button
                    key={heading.id}
                    onClick={() => handleTocClick(heading.id)}
                    className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                      activeHeading === heading.id
                        ? 'bg-blue-100 text-blue-700 font-medium border-l-2 border-blue-500'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="text-sm text-gray-500 italic">No headings found</p>
            )}
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
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: createHeadingRenderer(1),
                    h2: createHeadingRenderer(2),
                    h3: createHeadingRenderer(3),
                    h4: createHeadingRenderer(4),
                    h5: createHeadingRenderer(5),
                    h6: createHeadingRenderer(6),
                  }}
                >
                  {markdownText}
                </ReactMarkdown>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
};

// Initialize the app
function init(): void {
  const rootElement = document.getElementById("root");
  if (rootElement && window.ReactDOM) {
    window.ReactDOM.render(<MarkdownViewer />, rootElement);
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
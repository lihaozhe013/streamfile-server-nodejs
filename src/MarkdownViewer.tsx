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

// Utility function to clean markdown formatting from text
const cleanMarkdownText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Remove bold formatting: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    // Remove italic formatting: *text* or _text_
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove strikethrough: ~~text~~
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code: `text`
    .replace(/`([^`]+)`/g, '$1')
    // Remove links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images: ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Clean up any remaining markdown characters
    .replace(/[*_~`[\]()]/g, '')
    .trim();
};

// Utility function to generate consistent heading IDs
const generateHeadingId = (text: string, existingIds: Set<string> = new Set()): string => {
  if (!text || typeof text !== 'string') {
    return `heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Clean markdown formatting first
  const cleanText = cleanMarkdownText(text);
  
  let baseId = cleanText
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // If baseId is empty after cleaning, generate a fallback
  if (!baseId) {
    baseId = `heading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Ensure uniqueness by adding a suffix if needed
  let finalId = baseId;
  let counter = 1;
  while (existingIds.has(finalId)) {
    finalId = `${baseId}-${counter}`;
    counter++;
  }
  
  existingIds.add(finalId);
  return finalId;
};

// Utility function to extract text content consistently
const extractTextContent = (node: any): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return node.toString();
  if (!node) return '';
  
  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }
  
  if (typeof node === 'object') {
    if (node.props && node.props.children) {
      return extractTextContent(node.props.children);
    }
    if (node.children) {
      return extractTextContent(node.children);
    }
  }
  
  return '';
};

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
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      const extractedHeadings: Heading[] = [];
      const newUsedIds = new Set<string>();
      let match;

      while ((match = headingRegex.exec(markdownText)) !== null) {
        const level = match[1].length;
        const rawText = match[2].trim();
        const cleanText = cleanMarkdownText(rawText); // Clean text for display
        const id = generateHeadingId(rawText, newUsedIds); // Use raw text for ID generation (it will be cleaned inside)
        extractedHeadings.push({ id, text: cleanText, level });
      }

      usedIds.current = newUsedIds;
      setHeadings(extractedHeadings);
      
      // Reset active heading when headings change
      setActiveHeading("");
    }
  }, [markdownText]);

  // Handle scroll to update active heading
  useEffect(() => {
    const handleScroll = () => {
      if (headings.length === 0) return;

      const scrollPosition = window.scrollY + 120; // Offset for header
      let currentActiveHeading = '';

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
        currentActiveHeading = '';
      }

      if (currentActiveHeading !== activeHeading) {
        setActiveHeading(currentActiveHeading);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings, activeHeading]);

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
    const currentPath = window.location.pathname;
    // Remove the filename by finding the last '/' and removing everything after it
    const lastSlashIndex = currentPath.lastIndexOf('/');
    if (lastSlashIndex > 0) {
      const parentPath = currentPath.substring(0, lastSlashIndex);
      window.location.href = parentPath;
    } else {
      // If no parent directory, go to root
      window.location.href = '/';
    }
  };

  // Handle TOC item click - improved version with error handling
  const handleTocClick = (headingId: string) => {
    const element = document.getElementById(headingId);
    
    if (element) {
      // Calculate the offset to account for the sticky header
      const headerOffset = 80;
      const elementPosition = element.offsetTop - headerOffset;
      
      // Smooth scroll to the element
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
      
      // Update active heading immediately for better UX
      setActiveHeading(headingId);
    } else {
      console.warn('Heading element not found for ID:', headingId);
      // Try to find the heading by text content as fallback
      const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const targetHeading = headings.find(h => h.id === headingId);
      
      if (targetHeading) {
        const fallbackElement = Array.from(allHeadings).find(el => {
          const elementText = el.textContent?.trim() || '';
          return elementText === targetHeading.text || 
                 cleanMarkdownText(elementText) === targetHeading.text ||
                 elementText === cleanMarkdownText(targetHeading.text);
        });
        
        if (fallbackElement) {
          const headerOffset = 80;
          const elementPosition = fallbackElement.getBoundingClientRect().top + window.scrollY - headerOffset;
          
          window.scrollTo({
            top: elementPosition,
            behavior: 'smooth'
          });
          
          setActiveHeading(headingId);
        }
      }
    }
  };

  // Custom heading renderer to add IDs - improved version with consistent ID generation
  const createHeadingRenderer = (level: number) => {
    return ({ children, ...props }: any) => {
      const renderedText = extractTextContent(children);
      
      // Find the matching heading from our extracted headings list
      // The rendered text should match the cleaned text we stored
      const matchingHeading = headings.find(h => h.text === renderedText && h.level === level);
      
      // If no match found, try to find by cleaning the rendered text and comparing
      const fallbackHeading = !matchingHeading ? 
        headings.find(h => cleanMarkdownText(h.text) === renderedText && h.level === level) : 
        null;
      
      const finalHeading = matchingHeading || fallbackHeading;
      const id = finalHeading ? finalHeading.id : generateHeadingId(renderedText, usedIds.current);
      
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
                  key={`mobile-${heading.id}-${heading.level}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTocClick(heading.id);
                    setIsTocOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                    activeHeading === heading.id
                      ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{ 
                    paddingLeft: `${Math.max(heading.level - 1, 0) * 16 + 12}px`,
                    borderLeft: activeHeading === heading.id ? '3px solid #3b82f6' : '3px solid transparent'
                  }}
                  title={heading.text}
                  data-heading-id={heading.id}
                  data-heading-level={heading.level}
                >
                  <span className="block truncate">
                    {heading.text}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main content with sidebar */}
      <main className="flex-1 flex max-w-none w-full">
        {/* Desktop Table of Contents Sidebar - Typora style */}
        <aside className="hidden lg:block w-80 flex-shrink-0 bg-white/50 border-r border-gray-200 min-h-screen">
          <div className="sticky top-20 p-6 max-h-[calc(100vh-5rem)] overflow-y-auto">
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
            
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Outline</h3>
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
                      ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{ 
                    paddingLeft: `${Math.max(heading.level - 1, 0) * 16 + 12}px`,
                    borderLeft: activeHeading === heading.id ? '3px solid #3b82f6' : '3px solid transparent'
                  }}
                  title={heading.text}
                  data-heading-id={heading.id}
                  data-heading-level={heading.level}
                >
                  <span className="block truncate">
                    {heading.text}
                  </span>
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
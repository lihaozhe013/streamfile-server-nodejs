import React from 'react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { Link } from 'react-router';
import { extractHeadings } from '@/lib/markdown';

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const headings = extractHeadings(content);
  const headingIds = headings.map((heading) => heading.id);
  let headingIndex = 0;

  const createHeading = (level: number) => {
    const Heading = ({ children }: { children?: React.ReactNode }) => {
      const id = headingIds[headingIndex] ?? `heading-${headingIndex}`;
      headingIndex += 1;
      return React.createElement(`h${level}`, { id }, children);
    };
    Heading.displayName = `MarkdownHeading${level}`;
    return Heading;
  };

  return (
    <div className="prose-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
        components={{
          h1: createHeading(1),
          h2: createHeading(2),
          h3: createHeading(3),
          h4: createHeading(4),
          h5: createHeading(5),
          h6: createHeading(6),
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('/files/')) {
              return (
                <Link to={href} {...props}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

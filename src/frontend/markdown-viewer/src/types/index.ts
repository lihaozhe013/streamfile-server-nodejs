/**
 * TypeScript type definitions for the Markdown Viewer
 */

export interface Heading {
  id: string;
  text: string;
  level: number;
}

export interface MarkdownViewerProps {}

declare global {
  interface Window {
    markdownContent?: string;
    markdownContentReady?: boolean;
  }
}

export {};

/**
 * Utility functions for markdown processing
 */

/**
 * Clean markdown formatting from text
 */
export const cleanMarkdownText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    // Remove HTML <br> tags and replace with spaces
    .replace(/<br\s*\/?>/gi, ' ')
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

/**
 * Generate consistent heading IDs from text
 */
export const generateHeadingId = (text: string, existingIds: Set<string> = new Set()): string => {
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

/**
 * Extract text content from React nodes consistently
 */
export const extractTextContent = (node: any): string => {
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

/**
 * Process markdown content to handle relative paths
 */
export const processRelativePaths = (content: string, currentPath: string): string => {
  const pathSegments = currentPath.split('/');
  
  // Remove '/files/' prefix and get the directory path
  if (pathSegments[1] !== 'files') {
    return content;
  }
  
  const filePath = pathSegments.slice(2).join('/');
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
  
  let processedContent = content;
  
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
  
  return processedContent;
};

/**
 * Extract headings from markdown text
 */
export interface Heading {
  id: string;
  text: string;
  level: number;
}

export const extractHeadings = (markdownText: string): { headings: Heading[]; usedIds: Set<string> } => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const extractedHeadings: Heading[] = [];
  const usedIds = new Set<string>();
  let match;

  while ((match = headingRegex.exec(markdownText)) !== null) {
    const level = match[1].length;
    const rawText = match[2].trim();
    const cleanText = cleanMarkdownText(rawText);
    const id = generateHeadingId(rawText, usedIds);
    extractedHeadings.push({ id, text: cleanText, level });
  }

  return { headings: extractedHeadings, usedIds };
};

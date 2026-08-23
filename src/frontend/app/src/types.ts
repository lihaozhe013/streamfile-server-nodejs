export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface SearchResult {
  file_name: string;
  file_path: string;
  relative_path: string;
}

export interface SearchResponse {
  query: {
    file_name: string;
    current_dir: string;
  };
  results: SearchResult[];
  count: number;
}

export interface MarkdownResponse {
  content: string;
  filename: string;
  path: string;
}

export interface UploadResponse {
  message: string;
  file?: {
    originalname?: string;
    filename?: string;
  };
}

export type FileRouteData =
  | {
      kind: 'directory';
      path: string;
      entries: FileEntry[];
      searchQuery: string;
      searchResults: SearchResult[] | null;
    }
  | {
      kind: 'markdown';
      path: string;
      markdown: MarkdownResponse;
    }
  | {
      kind: 'media';
      path: string;
    }
  | {
      kind: 'resource';
      path: string;
    };

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface Config {
  server: {
    host: string;
    port: number;
  };
  features: RuntimeFeatures;
  directories: {
    /** Optional; resolved public asset source with an embedded fallback. */
    public: string | null;
    upload: string;
    incoming: string;
    private: string;
  };
}

export interface RuntimeFeatures {
  upload: boolean;
  privateFiles: boolean;
  homePage: boolean;
}

export interface RuntimePaths {
  /** Home-relative data root holding files/, debug.log, and the optional public override. */
  dataRoot: string;
  /** Effective public asset directory: on disk or inside the standalone executable. */
  publicDir: string;
  /** True when publicDir points into the standalone executable's embedded assets. */
  publicEmbedded: boolean;
  filesDir: string;
  incomingDir: string;
  privateDir: string;
  spaShellPath: string;
  notFoundPath: string;
}

export interface RuntimeConfig {
  server: Config['server'];
  features: RuntimeFeatures;
  paths: RuntimePaths;
  configPath: string;
}

export interface SearchResult {
  file_name: string;
  file_path: string;
  relative_path: string;
}

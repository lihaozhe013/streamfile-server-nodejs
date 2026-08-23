export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface Config {
  server: {
    host: string;
    port: number;
  };
  directories: {
    public: string;
    upload: string;
    incoming: string;
    private: string;
  };
}

export interface RuntimePaths {
  rootDir: string;
  publicDir: string;
  filesDir: string;
  incomingDir: string;
  privateDir: string;
  spaShellPath: string;
  notFoundPath: string;
}

export interface RuntimeConfig {
  server: Config['server'];
  paths: RuntimePaths;
  configPath: string;
}

export interface SearchResult {
  file_name: string;
  file_path: string;
  relative_path: string;
}

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
    upload: string;
    incoming: string;
    private: string;
  };
}
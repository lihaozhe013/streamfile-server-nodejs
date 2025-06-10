interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface SearchResult {
  file_name: string;
  file_path: string;
  relative_path: string;
}

interface SearchResponse {
  query?: {
    file_name: string;
    current_dir: string;
  };
  results?: SearchResult[];
  count?: number;
  error?: string;
  details?: string;
}

function getCurrentDirectoryPath(): string {
  // Remove '/files' prefix and any leading/trailing slashes
  let pathname: string = window.location.pathname;
  if (pathname.startsWith('/files')) {
    let path: string = pathname.substring('/files'.length);
    if (path.startsWith('/')) path = path.substring(1);
    if (path.endsWith('/')) path = path.slice(0, -1);
    return decodeURIComponent(path);
  }
  return '';
}

async function fetchFiles(path: string = ''): Promise<void> {
  const res: Response = await fetch(`/api/list-files?path=${encodeURIComponent(path)}`);
  const files: FileEntry[] = await res.json();

  const list: HTMLElement | null = document.getElementById('file-list');
  if (!list) return;
  
  list.innerHTML = '';

  // Navigation row
  if (path) {
    const up: string = path.split('/').slice(0, -1).join('/');
    let upUrl: string = '/files';
    if (up) upUrl += '/' + encodeURIComponent(up).replace(/%2F/g, '/');
    if (!upUrl.endsWith('/')) upUrl += '/';
    list.innerHTML += 
      `<a href="${upUrl}" class="file-row">
        <img src="/icons/icons8-folder-48.png" class="icons">
        (Go Back)
      </a>`;
  } else {
    list.innerHTML += 
      `<a href="/" class="file-row">
        <img src="/icons/icons8-folder-48.png" class="icons">
        (Back to Home)
      </a>`;
  }

  files.forEach((file: FileEntry) => {
    const isDir: boolean = file.isDirectory;
    const fullPath: string = path ? `${path}/${file.name}` : file.name;
    const displayName: string = file.name;
    const encodedPath: string = fullPath.split('/').map(encodeURIComponent).join('/');

    if (displayName === '.DS_Store') return;

    if (isDir) {
      const href: string = `/files/${encodedPath}/`;
      list.innerHTML += `
        <a href="${href}" class="file-row">
          <img src="/icons/icons8-folder-48.png" class="icons">
          ${displayName}
        </a>`;
    } else {
      const filePath: string = `/files/${encodedPath}`;
      list.innerHTML += `
        <a href="${filePath}" class="file-row">
          <img src="/icons/file-icon.png" class="icons">
          ${displayName}
        </a>`;
    }
  });

  // Add click event for folder navigation (SPA-like)
  list.querySelectorAll('a.file-row').forEach((a: Element) => {
    const anchor = a as HTMLAnchorElement;
    const href = anchor.getAttribute('href');
    if (href && href.startsWith('/files/') && href.endsWith('/')) {
      anchor.addEventListener('click', function (e: Event) {
        e.preventDefault();
        const targetHref = anchor.getAttribute('href');
        if (targetHref) {
          window.location.href = targetHref;
        }
      });
    }
  });
}

// Search functionality
async function searchFiles(fileName: string, currentDir: string = ''): Promise<void> {
  if (!fileName.trim()) {
    alert('Please enter a filename to search');
    return;
  }

  const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
  const searchResults = document.getElementById('search-results') as HTMLElement;
  const searchList = document.getElementById('search-list') as HTMLElement;

  // Show loading state
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  searchResults.style.display = 'block';
  searchList.innerHTML = '<div class="loading">Searching files...</div>';

  try {
    const encodedFileName = encodeURIComponent(fileName);
    const encodedCurrentDir = encodeURIComponent(currentDir);
    const url = `/api/search_feat/file_name=${encodedFileName}/current_dir=${encodedCurrentDir}`;
    
    const response = await fetch(url);
    const data: SearchResponse = await response.json();

    if (data.error) {
      searchList.innerHTML = `<div class="error">Error: ${data.error}</div>`;
      return;
    }

    if (!data.results || data.count === 0) {
      searchList.innerHTML = `<div class="no-results">No files found matching "${fileName}"</div>`;
      return;
    }

    // Display search results
    searchList.innerHTML = '';
    data.results.forEach((result: SearchResult) => {
      const fileUrl = `/files/${result.relative_path}`;
      searchList.innerHTML += `
        <a href="${fileUrl}" class="file-row search-result-item">
          <img src="/icons/file-icon.png" class="icons">
          <div class="file-info">
            <div class="file-name">${result.file_name}</div>
            <div class="file-path">${result.relative_path}</div>
          </div>
        </a>`;
    });

    // Update results count
    const resultsHeader = searchResults.querySelector('h4');
    if (resultsHeader && data.count !== undefined) {
      resultsHeader.textContent = `Search Results (${data.count} found):`;
    }

  } catch (error) {
    console.error('Search error:', error);
    searchList.innerHTML = '<div class="error">Search failed. Please try again.</div>';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

function clearSearch(): void {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchResults = document.getElementById('search-results') as HTMLElement;
  
  searchInput.value = '';
  searchResults.style.display = 'none';
}

function initializeSearch(): void {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchBtn = document.getElementById('search-btn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clear-search-btn') as HTMLButtonElement;

  // Search button click
  searchBtn.addEventListener('click', () => {
    const fileName = searchInput.value.trim();
    const currentDir = getCurrentDirectoryPath();
    searchFiles(fileName, currentDir);
  });

  // Enter key in search input
  searchInput.addEventListener('keypress', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const fileName = searchInput.value.trim();
      const currentDir = getCurrentDirectoryPath();
      searchFiles(fileName, currentDir);
    }
  });

  // Clear button click
  clearBtn.addEventListener('click', clearSearch);
}

// Initialize everything
fetchFiles(getCurrentDirectoryPath());
initializeSearch(); 
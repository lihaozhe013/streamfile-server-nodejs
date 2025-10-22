function getCurrentDirectoryPath() {
  // Remove '/files' prefix and any leading/trailing slashes
  let pathname = window.location.pathname;
  if (pathname.startsWith('/files')) {
    let path = pathname.substring('/files'.length);
    if (path.startsWith('/')) path = path.substring(1);
    if (path.endsWith('/')) path = path.slice(0, -1);
    return decodeURIComponent(path);
  }
  return '';
}

async function fetchFiles(path = '') {
  const res = await fetch(`/api/list-files?path=${encodeURIComponent(path)}`);
  const data = await res.json();
  const files = data.files || data; // 支持两种返回格式

  const list = document.getElementById('file-list');
  if (!list) return;
  
  list.innerHTML = '';

  // Navigation row
  if (path) {
    const up = path.split('/').slice(0, -1).join('/');
    let upUrl = '/files';
    if (up) upUrl += '/' + encodeURIComponent(up).replace(/%2F/g, '/');
    if (!upUrl.endsWith('/')) upUrl += '/';
    list.innerHTML += 
      `<a href="${upUrl}" class="flex items-center p-3 border-b border-gray-200 hover:bg-gray-50 text-blue-600 bg-white no-underline rounded-xl transition-colors">
        <img src="/public/icons/folder.svg" class="w-5 h-5 mr-3">
        (Go Back)
      </a>`;
  } else {
    list.innerHTML += 
      `<a href="/" class="flex items-center p-3 border-b border-gray-200 hover:bg-gray-50 text-blue-600 bg-white no-underline rounded-xl transition-colors">
        <img src="/public/icons/document.svg" class="w-5 h-5 mr-3">
        (Back to Home)
      </a>`;
  }

  files.forEach((file) => {
    const isDir = file.isDirectory;
    const fullPath = path ? `${path}/${file.name}` : file.name;
    const displayName = file.name;
    const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');

    // Skip .DS_Store and files/directories that start with '.'
    if (displayName === '.DS_Store' || displayName.startsWith('.')) return;

    if (isDir) {
      const href = `/files/${encodedPath}/`;
      list.innerHTML += `
        <a href="${href}" class="flex items-center p-3 border-b border-gray-200 hover:bg-gray-50 text-blue-600 bg-white no-underline rounded-xl transition-colors">
          <img src="/public/icons/folder.svg" class="w-5 h-5 mr-3">
          ${displayName}
        </a>`;
    } else {
      const videoAudioExts = [
        'mp4', 'mp3', 'wav', 'avi', 'mov', 'flac', 'ogg', 'm4a', 'webm', 'mkv', 'aac', 'wmv', '3gp', 'm4v', 'mpg', 'mpeg'
      ];
      const imageExts = [
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'apng', 'avif', 'jfif', 'pjpeg', 'pjp', 'raw', 'heic', 'heif'
      ];
      const externalLinkExts = ['html'];
      const ext = displayName.split('.').pop()?.toLowerCase() || '';
      let icon = '/public/icons/document.svg';
      if (videoAudioExts.includes(ext)) {
        icon = '/public/icons/play-circle.svg';
      } else if (imageExts.includes(ext)) {
        icon = '/public/icons/photo.svg';
      } else if (externalLinkExts.includes(ext)) {
        icon = '/public/icons/external-link.svg';
      }
      const filePath = `/files/${encodedPath}`;
      list.innerHTML += `
        <a href="${filePath}" class="flex items-center p-3 border-b border-gray-200 hover:bg-gray-50 text-gray-900 bg-white no-underline rounded-xl transition-colors">
          <img src="${icon}" class="w-5 h-5 mr-3">
          ${displayName}
        </a>`;
    }
  });

  // Add click event for folder navigation (SPA-like)
  list.querySelectorAll('a.file-row').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('/files/') && href.endsWith('/')) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        const targetHref = a.getAttribute('href');
        if (targetHref) {
          window.location.href = targetHref;
        }
      });
    }
  });
}

// Search functionality
async function searchFiles(fileName, currentDir = '') {
  if (!fileName.trim()) {
    alert('Please enter a filename to search');
    return;
  }

  const searchBtn = document.getElementById('search-btn');
  const searchResults = document.getElementById('search-results');
  const searchList = document.getElementById('search-list');

  // Show loading state
  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching...';
  searchResults.style.display = 'block';
  searchList.innerHTML = '<div class="text-center p-4 text-gray-500 italic">Searching files...</div>';

  try {
    const encodedFileName = encodeURIComponent(fileName);
    const encodedCurrentDir = encodeURIComponent(currentDir);
    const url = `/api/search?q=${encodedFileName}&dir=${encodedCurrentDir}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      searchList.innerHTML = `<div class="text-center p-4 text-red-600 bg-red-50 border border-red-200 rounded-xl">Error: ${data.error}</div>`;
      return;
    }

    if (!data.results || data.count === 0) {
      searchList.innerHTML = `<div class="text-center p-4 text-gray-500 italic bg-gray-50 rounded-xl">No files found matching "${fileName}"</div>`;
      return;
    }

    // Display search results
    searchList.innerHTML = '';
    data.results.forEach((result) => {
      const videoAudioExts = [
        'mp4', 'mp3', 'wav', 'avi', 'mov', 'flac', 'ogg', 'm4a', 'webm', 'mkv', 'aac', 'wmv', '3gp', 'm4v', 'mpg', 'mpeg'
      ];
      const imageExts = [
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'apng', 'avif', 'jfif', 'pjpeg', 'pjp', 'raw', 'heic', 'heif'
      ];
      const ext = result.fileName.split('.').pop()?.toLowerCase() || '';
      let icon = '/public/icons/document.svg';
      if (videoAudioExts.includes(ext)) {
        icon = '/public/icons/play-circle.svg';
      } else if (imageExts.includes(ext)) {
        icon = '/public/icons/photo.svg';
      }
      const fileUrl = `/files/${result.relativePath}`;
      searchList.innerHTML += `
        <a href="${fileUrl}" class="flex items-center p-3 border-l-4 border-blue-600 bg-gray-50 hover:bg-blue-50 mb-2 rounded-2xl transition-colors">
          <img src="${icon}" class="w-5 h-5 mr-3">
          <div class="flex flex-col">
            <div class="font-medium text-gray-900">${result.fileName}</div>
            <div class="text-xs text-gray-500">${result.relativePath}</div>
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
    searchList.innerHTML = '<div class="text-center p-4 text-red-600 bg-red-50 border border-red-200 rounded-xl">Search failed. Please try again.</div>';
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search';
  }
}

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  
  searchInput.value = '';
  searchResults.style.display = 'none';
}

function initializeSearch() {
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearBtn = document.getElementById('clear-search-btn');

  // Search button click
  searchBtn.addEventListener('click', () => {
    const fileName = searchInput.value.trim();
    const currentDir = getCurrentDirectoryPath();
    searchFiles(fileName, currentDir);
  });

  // Enter key in search input
  searchInput.addEventListener('keypress', (e) => {
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

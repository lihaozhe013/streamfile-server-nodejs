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
  const files = await res.json();

  const list = document.getElementById('file-list');
  list.innerHTML = '';

  // Navigation row
  if (path) {
    const up = path.split('/').slice(0, -1).join('/');
    let upUrl = '/files';
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

  files.forEach(file => {
    const isDir = file.isDirectory;
    const fullPath = path ? `${path}/${file.name}` : file.name;
    const displayName = file.name;
    const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');

    if (displayName === '.DS_Store') return;

    if (isDir) {
      const href = `/files/${encodedPath}/`;
      list.innerHTML += `
        <a href="${href}" class="file-row">
          <img src="/icons/icons8-folder-48.png" class="icons">
          ${displayName}
        </a>`;
    } else {
      const filePath = `/files/${encodedPath}`;
      list.innerHTML += `
        <a href="${filePath}" class="file-row">
          <img src="/icons/file-icon.png" class="icons">
          ${displayName}
        </a>`;
    }
  });

  // Add click event for folder navigation (SPA-like)
  list.querySelectorAll('a.file-row').forEach(a => {
    if (a.getAttribute('href').startsWith('/files/') && a.getAttribute('href').endsWith('/')) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = a.getAttribute('href');
      });
    }
  });
}

fetchFiles(getCurrentDirectoryPath());

async function fetchFiles(path = '') {
  const res = await fetch(`/api/list-files?path=${encodeURIComponent(path)}`);
  const files = await res.json();

  const list = document.getElementById('file-list');
  list.innerHTML = '';

  if (path) {
    const up = path.split('/').slice(0, -1).join('/');
    const upPath = `?path=${encodeURIComponent(up)}`;
    list.innerHTML += 
    `<a href="${upPath}" class="file-row">
      <img src="/icons/icons8-folder-48.png" class="icons">
      (Go Back)
    </a> <br>`;
  }
  else {
    const url = new URL(window.location.href);
    const baseUrl = `${url.protocol}//${url.host}/`;
    list.innerHTML += 
    `<a href="${baseUrl}" class="file-row">
      <img src="/icons/icons8-folder-48.png" class="icons">
      (Go Back)
    </a>`;
  }

  files.forEach(async file => {
    const isDir = file.isDirectory;
    const fullPath = path ? `${path}/${file.name}` : file.name;
    const displayName = file.name;
    const encodedPath = encodeURIComponent(fullPath).replace(/%2F/g, '/');

    if (displayName === '.DS_Store') return;

    if (isDir) {
      // Check if index.html exists
      const indexUrl = `/files/${encodedPath}/index.html`;
      try {
        const res = await fetch(indexUrl, { method: 'HEAD' });
        if (res.ok) {
          // If index.html exists, point to the directory URL only
          const href = `/files/${encodedPath}/`;
          list.innerHTML += `
            <a href="${href}" class="file-row">
              <img src="/icons/icons8-folder-48.png" class="icons">
              ${displayName}
            </a>`;
          return;
        }
      } catch (e) {}

      list.innerHTML += `
        <a href="?path=${encodedPath}" class="file-row">
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

}

// Decode path in URL bar safely
const urlParams = new URLSearchParams(window.location.search);
const currentPath = decodeURIComponent(urlParams.get('path') || '');
fetchFiles(currentPath);

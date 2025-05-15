async function fetchFiles(path = '') {
  const res = await fetch(`/api/list-files?path=${encodeURIComponent(path)}`);
  const files = await res.json();

  const list = document.getElementById('file-list');
  list.innerHTML = '';

  if (path) {
    const up = path.split('/').slice(0, -1).join('/');
    const upPath = `?path=${encodeURIComponent(up)}`;
    list.innerHTML += 
    `<a href="${upPath}">
      <img src="/icons/icons8-folder-48.png" class="icons">
      (Go Back)
    </a> <br>`;
  }
  else {
    const url = new URL(window.location.href);
    const baseUrl = `${url.protocol}//${url.host}/`;
    list.innerHTML += 
    `<a href="${baseUrl}">
      <img src="/icons/icons8-folder-48.png" class="icons">
      (Go Back)
    </a> <br>`;
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
            <a href="${href}" class="folder">
              <img src="/icons/icons8-folder-48.png" class="icons">
              ${displayName}/
            </a><br>`;
          return;
        }
      } catch (e) {}

      list.innerHTML += `
        <a href="?path=${encodedPath}" class="folder">
          <img src="/icons/icons8-folder-48.png" class="icons">
          ${displayName}/
        </a><br>`;
    } else {
      const filePath = `/files/${encodedPath}`;
      list.innerHTML += `
        <a href="${filePath}" class="file">
          <img src="/icons/file-icon.png" class="icons">
          ${displayName}
        </a><br>`;
    }
  });

}

// Decode path in URL bar safely
const urlParams = new URLSearchParams(window.location.search);
const currentPath = decodeURIComponent(urlParams.get('path') || '');
fetchFiles(currentPath);

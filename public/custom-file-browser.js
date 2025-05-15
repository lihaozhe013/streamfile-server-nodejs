async function fetchFiles(path = '') {
  const res = await fetch(`/api/list-files?path=${encodeURIComponent(path)}`);
  const files = await res.json();

  const list = document.getElementById('file-list');
  list.innerHTML = '';

  if (path) {
    const up = path.split('/').slice(0, -1).join('/');
    const upPath = `?path=${encodeURIComponent(up)}`;
    list.innerHTML += `<a href="${upPath}">..(Go Back)</a> <br>`;
  }

  files.forEach(file => {
    const isDir = file.isDirectory;
    const fullPath = path ? `${path}/${file.name}` : file.name;

    const displayName = file.name;
    const encodedPath = encodeURIComponent(fullPath).replace(/%2F/g, '/');

    const href = isDir
      ? `?path=${encodedPath}`
      : `/files/${encodedPath}`;
    list.innerHTML +=
    `<a href="${href}" class="${isDir ? 'folder' : 'file'}">
      <img src="${isDir ? '/icons/icons8-folder-48.png' : '/icons/file-icon.png'}" class="icons">
      ${displayName}${isDir ? '/' : ''}
    </a> 
    <br>`;
  });
}

// Decode path in URL bar safely
const urlParams = new URLSearchParams(window.location.search);
const currentPath = decodeURIComponent(urlParams.get('path') || '');
fetchFiles(currentPath);

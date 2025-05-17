function getCurrentDirectoryPath() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryPath = urlParams.get('path');
  if (queryPath !== null) return decodeURIComponent(queryPath);

  const prefix = '/files/';
  let pathname = window.location.pathname;
  if (pathname.startsWith(prefix)) {
      let path = pathname.substring(prefix.length);
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

  if (path) {
      const up = path.split('/').slice(0, -1).join('/');
      let upUrl = '/files/';
      if (up) upUrl += encodeURIComponent(up) + '/';
      list.innerHTML += 
      `<a href="${upUrl}" class="file-row">
        <img src="/icons/icons8-folder-48.png" class="icons">
        (Go Back)
      </a> <br>`;
  } else {
      list.innerHTML += 
      `<a href="/files/" class="file-row">
        <img src="/icons/icons8-folder-48.png" class="icons">
        (Go Back)
      </a>`;
  }

  files.forEach(async file => {
      const isDir = file.isDirectory;
      const fullPath = path ? `${path}/${file.name}` : file.name;
      const displayName = file.name;
      const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');

      if (displayName === '.DS_Store') return;

      if (isDir) {
          const indexUrl = `/files/${encodedPath}/index.html`;
          try {
              const res = await fetch(indexUrl, { method: 'HEAD' });
              if (res.ok) {
                  const href = `/files/${encodedPath}/`;
                  list.innerHTML += `
                      <a href="${href}" class="file-row">
                          <img src="/icons/icons8-folder-48.png" class="icons">
                          ${displayName}
                      </a>`;
                  return;
              }
          } catch (e) {}

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

function getUploadElements() {
  const uploadForm = document.getElementById('uploadForm');
  const fileInput = document.getElementById('fileInput');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  if (!uploadForm || !fileInput || !progressContainer || !progressBar || !progressText) {
    console.error('Required upload elements not found');
    return null;
  }

  return { uploadForm, fileInput, progressContainer, progressBar, progressText };
}

function resetProgressBar(elements) {
  elements.progressContainer.style.display = 'none';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '';
}

function updateProgress(elements, percent) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = `${percent}%`;
}

function showProgressBar(elements) {
  elements.progressContainer.style.display = 'block';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '0%';
  elements.progressText.style.color = '#fff';
  elements.progressText.style.padding = '0 8px';
}

function handleUpload(e) {
  e.preventDefault(); // Prevent the default form submission behavior

  const elements = getUploadElements();
  if (!elements) return;

  if (!elements.fileInput.files || !elements.fileInput.files.length) {
    alert('Please select a file to upload.');
    return;
  }

  const formData = new FormData();
  formData.append('file', elements.fileInput.files[0]);

  const xhr = new XMLHttpRequest();

  showProgressBar(elements);

  // Listen for progress events
  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      updateProgress(elements, percentComplete);
    }
  });

  // Handle the completion of the request
  xhr.onload = () => {
    if (xhr.status === 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        if (response.message) {
          alert(response.message);
        } else {
          alert('File uploaded successfully!');
        }
      } catch (e) {
        alert('File uploaded successfully!');
      }
    } else {
      try {
        const response = JSON.parse(xhr.responseText);
        if (response.error) {
          alert('Upload failed: ' + response.error);
        } else {
          alert('Failed to upload file.');
        }
      } catch (e) {
        alert('Failed to upload file.');
      }
    }
    resetProgressBar(elements);
  };

  // Handle errors
  xhr.onerror = () => {
    alert('An error occurred during the upload.');
    resetProgressBar(elements);
  };

  xhr.open('POST', '/upload', true);
  xhr.send(formData);
}

// Initialize the upload form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const elements = getUploadElements();
  if (elements) {
    elements.uploadForm.addEventListener('submit', handleUpload);
  }
});

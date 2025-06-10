interface UploadElements {
  uploadForm: HTMLFormElement;
  fileInput: HTMLInputElement;
  progressContainer: HTMLElement;
  progressBar: HTMLElement;
  progressText: HTMLElement;
}

function getUploadElements(): UploadElements | null {
  const uploadForm = document.getElementById('uploadForm') as HTMLFormElement;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const progressContainer = document.getElementById('progressContainer') as HTMLElement;
  const progressBar = document.getElementById('progressBar') as HTMLElement;
  const progressText = document.getElementById('progressText') as HTMLElement;

  if (!uploadForm || !fileInput || !progressContainer || !progressBar || !progressText) {
    console.error('Required upload elements not found');
    return null;
  }

  return { uploadForm, fileInput, progressContainer, progressBar, progressText };
}

function resetProgressBar(elements: UploadElements): void {
  elements.progressContainer.style.display = 'none';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '';
}

function updateProgress(elements: UploadElements, percent: number): void {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = `${percent}%`;
}

function showProgressBar(elements: UploadElements): void {
  elements.progressContainer.style.display = 'block';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '0%';
  elements.progressText.style.color = '#fff';
  elements.progressText.style.padding = '0 8px';
}

function handleUpload(e: Event): void {
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
  xhr.upload.addEventListener('progress', (event: ProgressEvent<XMLHttpRequestEventTarget>) => {
    if (event.lengthComputable) {
      const percentComplete: number = Math.round((event.loaded / event.total) * 100);
      updateProgress(elements, percentComplete);
    }
  });

  // Handle the completion of the request
  xhr.onload = (): void => {
    if (xhr.status === 200) {
      alert('File uploaded successfully!');
    } else {
      alert('Failed to upload file.');
    }
    resetProgressBar(elements);
  };

  // Handle errors
  xhr.onerror = (): void => {
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
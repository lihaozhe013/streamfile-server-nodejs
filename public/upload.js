document.getElementById('uploadForm').addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent the default form submission behavior

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        alert('Please select a file to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const xhr = new XMLHttpRequest();

    // Show the progress container
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    // Listen for progress events
    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = `${percentComplete}%`;
            progressText.textContent = `${percentComplete}%`;
        }
    });

    // Handle the completion of the request
    xhr.onload = () => {
        if (xhr.status === 200) {
            alert('File uploaded successfully!');
        } else {
            alert('Failed to upload file.');
        }
        // Reset the progress bar after upload
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressText.textContent = '';
    };

    // Handle errors
    xhr.onerror = () => {
        alert('An error occurred during the upload.');
        progressContainer.style.display = 'none';
    };

    xhr.open('POST', '/upload', true);
    xhr.send(formData);
});
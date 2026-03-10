// DropRoom JavaScript - Clean Minimal Implementation
class DropRoom {
    constructor() {
        console.log('Current hostname:', window.location.hostname);
        
        // Auto-detect API URL based on environment
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.apiBaseUrl = 'http://localhost:3000';
        } else if (window.location.hostname.includes('github.io')) {
            // Production GitHub Pages - use deployed backend
            this.apiBaseUrl = 'https://droproom-yxsb.onrender.com'; // Your actual Render backend URL
        } else {
            // Custom domain or other environment
            this.apiBaseUrl = 'https://droproom-yxsb.onrender.com'; // Your actual Render backend URL
        }
        
        console.log('API Base URL:', this.apiBaseUrl);
        console.log('FORCED UPDATE: Using Railway backend - cache cleared');
        
        // Generate or get uploader ID for session tracking
        this.uploaderId = this.getOrCreateUploaderId();
        console.log('Uploader ID:', this.uploaderId);
        
        this.init();
    }

    getOrCreateUploaderId() {
        let uploaderId = localStorage.getItem('droproom_uploader_id');
        if (!uploaderId) {
            uploaderId = 'uploader_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('droproom_uploader_id', uploaderId);
        }
        return uploaderId;
    }

    // Saved rooms functionality
    saveRoom(roomId) {
        let savedRooms = JSON.parse(localStorage.getItem('droproom_saved_rooms') || '[]');
        
        if (!savedRooms.includes(roomId)) {
            savedRooms.push(roomId);
            localStorage.setItem('droproom_saved_rooms', JSON.stringify(savedRooms));
            this.showToast('Room saved successfully!', 'success');
        } else {
            this.showToast('Room already saved', 'info');
        }
    }

    getSavedRooms() {
        return JSON.parse(localStorage.getItem('droproom_saved_rooms') || '[]');
    }

    removeSavedRoom(roomId) {
        let savedRooms = JSON.parse(localStorage.getItem('droproom_saved_rooms') || '[]');
        savedRooms = savedRooms.filter(id => id !== roomId);
        localStorage.setItem('droproom_saved_rooms', JSON.stringify(savedRooms));
        this.showToast('Room removed from saved rooms', 'success');
    }

    init() {
        try {
            // Check if we're on the homepage, room page, or saved rooms page
            console.log('Current pathname:', window.location.pathname);
            console.log('Pathname ends with index.html:', window.location.pathname.endsWith('index.html'));
            console.log('Pathname equals /:', window.location.pathname === '/');
            
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                console.log('Initializing homepage');
                this.initHomepage();
            } else if (window.location.pathname.endsWith('room.html')) {
                console.log('Initializing room page');
                this.initRoomPage();
            } else if (window.location.pathname.endsWith('saved-rooms.html')) {
                console.log('Initializing saved rooms page');
                this.initSavedRoomsPage();
            } else {
                console.log('Unknown page, checking if it might be homepage');
                // GitHub Pages might serve index.html without the .html extension
                if (!window.location.pathname.includes('.') || window.location.pathname.endsWith('/')) {
                    console.log('Treating as homepage');
                    this.initHomepage();
                }
            }
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    initHomepage() {
        const createRoomBtn = document.getElementById('create-room-btn');
        const savedRoomsBtn = document.getElementById('saved-rooms-btn');
        
        console.log('Homepage init - createRoomBtn:', createRoomBtn);
        console.log('Homepage init - savedRoomsBtn:', savedRoomsBtn);
        console.log('API Base URL:', this.apiBaseUrl);
        
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => {
                console.log('Create room button clicked!');
                try {
                    this.createRoom();
                } catch (error) {
                    console.error('Error creating room:', error);
                    this.showToast('Failed to create room', 'error');
                }
            });
            console.log('Create room button event added');
        }
        
        if (savedRoomsBtn) {
            savedRoomsBtn.addEventListener('click', () => {
                console.log('Saved rooms button clicked!');
                window.location.href = 'saved-rooms.html';
            });
            console.log('Saved rooms button event added');
        }
    }

    initRoomPage() {
        console.log('=== INIT ROOM PAGE DEBUG ===');
        // Get room ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlRoomId = urlParams.get('room');
        
        console.log('URL parameter room:', urlRoomId);
        console.log('Current URL:', window.location.search);
        console.log('Full URL:', window.location.href);
        
        this.roomId = urlRoomId;
        
        if (!this.roomId) {
            console.error('No room ID provided in URL!');
            this.showToast('No room ID provided', 'error');
            return;
        }
        
        console.log('Final room ID being used:', this.roomId);
        
        // Display room ID
        const roomIdElement = document.getElementById('room-id');
        if (roomIdElement) {
            roomIdElement.textContent = this.roomId;
        }

        console.log('=== INIT ROOM PAGE DEBUG END ===');
        
        // Initialize room functionality
        this.initRoomFunctionality();
        this.loadFiles();
    }

    initRoomFunctionality() {
        // Share room button
        const shareRoomBtn = document.getElementById('share-room-btn');
        const saveRoomBtn = document.getElementById('save-room-btn');
        
        if (shareRoomBtn) {
            shareRoomBtn.addEventListener('click', () => this.shareRoom());
        }
        
        if (saveRoomBtn) {
            saveRoomBtn.addEventListener('click', () => this.saveRoom(this.roomId));
        }

        // Drop zone
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');

        if (dropZone) {
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, this.preventDefaults, false);
                document.body.addEventListener(eventName, this.preventDefaults, false);
            });

            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.classList.add('dragover');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.classList.remove('dragover');
                }, false);
            });

            // Handle dropped files
            dropZone.addEventListener('drop', (e) => this.handleDrop(e), false);
        }

        // Browse files button
        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drop-zone click
                fileInput.click();
            });
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    initSavedRoomsPage() {
        this.displaySavedRooms();
        
        // Start auto-refresh for saved rooms page
        this.startSavedRoomsRefresh();
    }

    startSavedRoomsRefresh() {
        // Clear existing refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Refresh saved rooms every 5 seconds (reduced from 1 second to avoid spam)
        this.refreshInterval = setInterval(() => {
            console.log('Auto-refreshing saved rooms...');
            this.displaySavedRooms();
        }, 5000);
    }

    displaySavedRooms() {
        const savedRoomsList = document.getElementById('saved-rooms-list');
        if (!savedRoomsList) return;

        const savedRooms = this.getSavedRooms();
        
        if (savedRooms.length === 0) {
            savedRoomsList.innerHTML = `
                <div class="empty-state">
                    <p>No saved rooms yet</p>
                    <p>Create a room and save it to see it here</p>
                </div>
            `;
            return;
        }

        savedRoomsList.innerHTML = savedRooms.map(roomId => `
            <div class="saved-room-item">
                <div class="room-info">
                    <h3 class="room-id">Room ID: ${roomId}</h3>
                    <p class="room-link">${window.location.origin}/room.html?room=${roomId}</p>
                </div>
                <div class="room-actions">
                    <button class="btn-primary" onclick="dropRoom.goToRoom('${roomId}')">
                        Open Room
                    </button>
                    <button class="btn-secondary" onclick="dropRoom.copyRoomLink('${roomId}')">
                        Copy Link
                    </button>
                    <button class="btn-delete" onclick="dropRoom.removeSavedRoom('${roomId}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    goToRoom(roomId) {
        window.location.href = `room.html?room=${roomId}`;
    }

    copyRoomLink(roomId) {
        const roomUrl = `${window.location.origin}/room.html?room=${roomId}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(roomUrl).then(() => {
                this.showToast('Room link copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(roomUrl);
            });
        } else {
            this.fallbackCopyToClipboard(roomUrl);
        }
    }

    createRoom() {
        console.log('createRoom() called');
        const roomId = this.generateRoomId();
        console.log('Generated room ID:', roomId);
        console.log('Redirecting to:', `room.html?room=${roomId}`);
        window.location.href = `room.html?room=${roomId}`;
    }

    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    shareRoom() {
        const roomUrl = window.location.href;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(roomUrl).then(() => {
                this.showToast('Room URL copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyToClipboard(roomUrl);
            });
        } else {
            this.fallbackCopyToClipboard(roomUrl);
        }
    }

    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Room URL copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy URL', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFiles(files);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        this.handleFiles(files);
    }

    handleFiles(files) {
        ([...files]).forEach(this.uploadFile.bind(this));
    }

    async uploadFile(file) {
        try {
            // Create progress toast
            const progressToast = document.createElement('div');
            progressToast.className = 'toast info';
            progressToast.textContent = `Preparing to upload ${file.name}...`;
            document.body.appendChild(progressToast);
            setTimeout(() => progressToast.classList.add('show'), 10);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('uploaderId', this.uploaderId);
            
            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && progressToast) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressToast.textContent = `Uploading ${file.name}... ${percentComplete}%`;
                    progressToast.className = `toast show info`;
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                console.log('=== UPLOAD COMPLETION DEBUG ===');
                console.log('Upload completed with status:', xhr.status);
                console.log('Upload response:', xhr.responseText);
                console.log('Current this.roomId before upload:', this.roomId);
                
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        console.log('Upload result:', result);
                        console.log('Response room ID:', result.roomId);
                        console.log('Current this.roomId after upload:', this.roomId);
                        
                        // CRITICAL FIX: Only update room ID if it's empty or if response returns a different room
                        // This prevents overwriting existing room IDs
                        if (!this.roomId || (result.roomId && result.roomId !== this.roomId)) {
                            console.warn('Room ID mismatch! Response:', result.roomId, 'Current:', this.roomId);
                            console.warn('Updating room ID to:', result.roomId);
                            this.roomId = result.roomId;
                            
                            // Update room ID display
                            const roomIdElement = document.getElementById('room-id');
                            if (roomIdElement) {
                                roomIdElement.textContent = this.roomId;
                            }
                        } else {
                            console.log('Room ID preserved:', this.roomId);
                        }
                        
                        // Update progress toast to success
                        if (progressToast) {
                            progressToast.textContent = `${file.name} uploaded successfully!`;
                            progressToast.className = 'toast show success';
                        }
                        
                        console.log('About to call loadFiles after upload...');
                        this.loadFiles(); // Refresh file list
                    } catch (parseError) {
                        console.error('Failed to parse upload response:', parseError);
                        console.error('Raw response:', xhr.responseText);
                        if (progressToast) {
                            progressToast.textContent = `Upload failed: Invalid response`;
                            progressToast.className = 'toast show error';
                        }
                    }
                } else {
                    console.error('Upload failed with status:', xhr.status);
                    console.error('Response:', xhr.responseText);
                    if (progressToast) {
                        progressToast.textContent = `Upload failed: ${xhr.statusText}`;
                        progressToast.className = 'toast show error';
                    }
                }
                
                // Remove progress toast after a delay
                setTimeout(() => {
                    if (progressToast && progressToast.parentNode) {
                        progressToast.classList.remove('show');
                        setTimeout(() => {
                            if (progressToast.parentNode) {
                                progressToast.parentNode.removeChild(progressToast);
                            }
                        }, 300);
                    }
                }, 2000);
            });
            
            // Handle errors
            xhr.addEventListener('error', () => {
                console.error('Upload network error');
                if (progressToast) {
                    progressToast.textContent = `Upload failed: Network error`;
                    progressToast.className = 'toast show error';
                }
            });
            
            xhr.open('POST', `${this.apiBaseUrl}/upload/${this.roomId}`);
            xhr.send(formData);
                
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
        }
    }

    async loadFiles() {
        try {
            console.log('=== LOADING FILES DEBUG ===');
            console.log('Loading files...');
            console.log(`Room ID: ${this.roomId}`);
            console.log(`API URL: ${this.apiBaseUrl}`);
            const fullUrl = `${this.apiBaseUrl}/list/${this.roomId}`;
            console.log('Full URL:', fullUrl);
            
            const response = await fetch(fullUrl);
            console.log('Fetch response status:', response.status);
            console.log('Fetch response headers:', response.headers);
            
            if (!response.ok) {
                console.error('Response not OK:', response.status, response.statusText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('Raw response text:', responseText);
            console.log('Response text length:', responseText.length);
            
            let files;
            try {
                files = JSON.parse(responseText);
                console.log('Successfully parsed JSON:', files);
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Response text that failed to parse:', responseText);
                files = [];
            }
            
            console.log('Files loaded:', files);
            console.log('Number of files:', files.length);
            console.log('Files array type:', Array.isArray(files));
            console.log('Files details:', files);
            
            this.displayFiles(files);
            
            // Start auto-refresh for room pages
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('Load files error:', error);
            console.error('Error details:', error.message, error.stack);
            this.showToast(`Failed to load files: ${error.message}`, 'error');
        }
    }

    startAutoRefresh() {
        // Clear existing refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Refresh files every 5 seconds (reduced from 1 second to avoid spam)
        this.refreshInterval = setInterval(() => {
            console.log('Auto-refreshing files...');
            // Use current room ID instead of re-extracting to prevent ID changes
            this.loadFiles();
        }, 5000);
    }

    displayFiles(files) {
        console.log('=== DISPLAY FILES DEBUG ===');
        const filesList = document.getElementById('files-list');
        
        console.log('displayFiles called with:', files);
        console.log('filesList element:', filesList);
        console.log('Looking for element with ID: files-list');
        
        if (!filesList) {
            console.error('files-list element not found!');
            return;
        }

        console.log('Files to display:', files.length);
        files.forEach((file, index) => {
            console.log(`Processing file ${index}:`, file);
        });
        
        if (files.length === 0) {
            console.log('No files to display, showing empty state');
            filesList.innerHTML = `
                <div class="empty-state">
                    <p>No files uploaded yet</p>
                </div>
            `;
            return;
        }

        console.log('Building HTML for', files.length, 'files');
        filesList.innerHTML = files.map(file => {
            console.log('Creating HTML for file:', file.name);
            
            const isOwner = file.uploaderId === this.uploaderId;
            const deleteButton = isOwner ? `
                <button class="btn-delete" onclick="dropRoom.confirmDelete('${file.name}', '${file.uploaderId}')">
                    Delete
                </button>
            ` : '';
            
            console.log('File uploader ID:', file.uploaderId);
            console.log('Current user ID:', this.uploaderId);
            console.log('Is owner:', isOwner);
            
            return `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                        ${file.uploadedAt ? `<div class="file-upload-time">Uploaded ${this.formatUploadTime(file.uploadedAt)}</div>` : ''}
                    </div>
                    <div class="file-actions">
                        <button class="btn-open" onclick="dropRoom.openFile('${file.name}')">
                            Open
                        </button>
                        <button class="btn-download" onclick="dropRoom.downloadFile('${file.name}')">
                            Download
                        </button>
                        ${deleteButton}
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('Final HTML length:', filesList.innerHTML.length);
        console.log('=== DISPLAY FILES DEBUG END ===');
        
        console.log('Files displayed successfully');
    }

    async openFile(filename) {
        try {
            // Get the file list to find the Cloudinary URL
            const response = await fetch(`${this.apiBaseUrl}/list/${this.roomId}`);
            const files = await response.json();
            
            const file = files.find(f => f.name === filename);
            
            if (file && file.cloudinaryData && file.cloudinaryData.secure_url) {
                // AI-powered file opening strategy
                const openUrl = this.getAIOptimizedOpenUrl(file);
                console.log('AI opening file with URL:', openUrl);
                
                // Special handling for PDFs - try multiple strategies
                if (file.name.toLowerCase().endsWith('.pdf')) {
                    this.openPdfWithFallbacks(file, openUrl);
                } else {
                    window.open(openUrl, '_blank');
                }
            } else if (file) {
                // Fallback to backend URL with AI optimization
                const openUrl = this.getAIOptimizedBackendUrl(file);
                console.log('AI opening backend URL:', openUrl);
                
                // Special handling for PDFs - try multiple strategies
                if (file.name.toLowerCase().endsWith('.pdf')) {
                    this.openPdfWithFallbacks(file, openUrl);
                } else {
                    window.open(openUrl, '_blank');
                }
            } else {
                console.error('File not found:', filename);
                this.showToast('File not found', 'error');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            this.showToast('Failed to open file', 'error');
        }
    }

    openPdfWithFallbacks(file, primaryUrl) {
        console.log('AI: Opening PDF with fallback strategies');
        
        // Strategy 1: Try direct URL first
        console.log('AI: PDF Strategy 1 - Direct URL:', primaryUrl);
        const newWindow = window.open(primaryUrl, '_blank');
        
        // Check if the window opened successfully and wait a bit
        setTimeout(() => {
            if (newWindow && newWindow.closed) {
                console.log('AI: Direct PDF opening failed, trying Google Docs viewer');
                // Strategy 2: Use Google Docs viewer
                const encodedUrl = encodeURIComponent(file.cloudinaryData.secure_url);
                const googleViewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
                console.log('AI: PDF Strategy 2 - Google Docs viewer:', googleViewerUrl);
                window.open(googleViewerUrl, '_blank');
            }
        }, 2000);
        
        // Also show user feedback
        this.showToast('Opening PDF... If it downloads, try the Download button instead', 'info');
    }

    getAIOptimizedOpenUrl(file) {
        const filename = file.name.toLowerCase();
        const extension = filename.split('.').pop();
        const baseUrl = file.cloudinaryData.secure_url;
        
        console.log('AI analyzing file for optimal opening:', { filename, extension });
        
        // AI-powered URL optimization for different file types
        if (['pdf'].includes(extension)) {
            // PDF: Multiple strategies for browser compatibility
            // Strategy 1: Try direct Cloudinary URL with viewer
            const directUrl = baseUrl + '#view=FitV';
            console.log('AI: PDF Strategy 1 - Direct URL:', directUrl);
            return directUrl;
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'heic', 'heif'].includes(extension)) {
            // Images: Add quality and format optimization
            return baseUrl.replace('/upload/', '/upload/q_auto,f_auto/');
        } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
            // Videos: Add streaming optimization
            return baseUrl.replace('/upload/', '/upload/q_auto,vc_auto/');
        } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
            // Audio: Add audio optimization
            return baseUrl.replace('/upload/', '/upload/q_auto,ac_auto/');
        } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(extension)) {
            // Documents: Use Google Docs viewer as fallback
            const encodedUrl = encodeURIComponent(baseUrl);
            return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
            // Archives: Try to open directly (will download if not supported)
            return baseUrl;
        } else {
            // Unknown files: Try direct opening first
            console.log('AI: Unknown file type, trying direct open:', extension);
            return baseUrl;
        }
    }

    getAIOptimizedBackendUrl(file) {
        const filename = file.name.toLowerCase();
        const extension = filename.split('.').pop();
        const encodedFilename = encodeURIComponent(filename);
        const baseUrl = `${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`;
        
        console.log('AI analyzing backend file for optimal opening:', { filename, extension });
        
        // AI-powered backend URL optimization
        if (['pdf'].includes(extension)) {
            // PDF: Add viewer parameter
            return baseUrl + '#view=FitV';
        } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf'].includes(extension)) {
            // Documents: Use Google Docs viewer
            const encodedUrl = encodeURIComponent(baseUrl);
            return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'heic', 'heif'].includes(extension)) {
            // Images: Direct opening should work in browser
            return baseUrl;
        } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
            // Videos: Direct opening should work in browser
            return baseUrl;
        } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
            // Audio: Direct opening should work in browser
            return baseUrl;
        } else {
            // Unknown files: Try direct opening
            console.log('AI: Unknown backend file type, trying direct open:', extension);
            return baseUrl;
        }
    }

async downloadFile(filename) {
        try {
            // Get the file list to find the Cloudinary URL
            const response = await fetch(`${this.apiBaseUrl}/list/${this.roomId}`);
            const files = await response.json();
            
            const file = files.find(f => f.name === filename);
            
            if (file && file.cloudinaryData && file.cloudinaryData.secure_url) {
                // Create download URL with attachment parameter
                const downloadUrl = file.cloudinaryData.secure_url.replace('/upload/', '/upload/fl_attachment/');
                console.log('Opening Cloudinary download URL:', downloadUrl);
                window.open(downloadUrl, '_blank');
            } else if (file) {
                // Fallback to backend URL
                const encodedFilename = encodeURIComponent(filename);
                const fileUrl = `${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`;
                console.log('Opening backend download URL:', fileUrl);
                window.open(fileUrl, '_blank');
            } else {
                console.error('File not found:', filename);
                this.showToast('File not found', 'error');
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            this.showToast('Failed to download file', 'error');
        }
    }

    confirmDelete(filename, uploaderId) {
        if (uploaderId !== this.uploaderId) {
            this.showToast('You can only delete your own files', 'error');
            return;
        }
        
        if (confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
            this.deleteFile(filename);
        }
    }

    async deleteFile(filename) {
        try {
            this.showToast(`Deleting ${filename}...`, 'info');
            
            // URL encode the filename to handle special characters
            const encodedFilename = encodeURIComponent(filename);
            
            console.log(`Deleting file: ${filename}`);
            console.log(`Room ID: ${this.roomId}`);
            console.log(`Uploader ID: ${this.uploaderId}`);
            console.log(`API URL: ${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`);
            
            const response = await fetch(`${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uploaderId: this.uploaderId
                })
            });

            console.log('Delete response status:', response.status);
            console.log('Delete response ok:', response.ok);

            if (!response.ok) {
                const error = await response.json();
                console.error('Delete error response:', error);
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Delete result:', result);
            this.showToast(`${filename} deleted successfully!`, 'success');
            this.loadFiles(); // Refresh file list
            
        } catch (error) {
            console.error('Delete error:', error);
            this.showToast(`Failed to delete ${filename}: ${error.message}`, 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUploadTime(uploadTime) {
        const date = new Date(uploadTime);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize DropRoom when DOM is ready
let dropRoom;

document.addEventListener('DOMContentLoaded', () => {
    dropRoom = new DropRoom();
    window.dropRoom = dropRoom;
});

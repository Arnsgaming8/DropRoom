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
                this.createRoom();
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
        // Get room ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId) {
            this.showToast('No room ID provided', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        // Display room ID
        const roomIdElement = document.getElementById('room-id');
        if (roomIdElement) {
            roomIdElement.textContent = this.roomId;
        }

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
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploaderId', this.uploaderId);

        try {
            console.log(`Uploading ${file.name} to ${this.apiBaseUrl}/upload/${this.roomId}`);
            
            // Create progress toast
            const progressToast = this.showToast(`Uploading ${file.name}... 0%`, 'info');
            
            const response = await fetch(`${this.apiBaseUrl}/upload/${this.roomId}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Upload result:', result);
            
            // Update progress toast to success
            if (progressToast) {
                progressToast.textContent = `${file.name} uploaded successfully!`;
                progressToast.className = 'toast show success';
            }
            
            this.loadFiles(); // Refresh file list
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
        }
    }

    async loadFiles() {
        try {
            console.log(`Loading files from: ${this.apiBaseUrl}/list/${this.roomId}`);
            
            const response = await fetch(`${this.apiBaseUrl}/list/${this.roomId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const files = await response.json();
            console.log('Files loaded:', files);
            this.displayFiles(files);
            
        } catch (error) {
            console.error('Load files error:', error);
            this.showToast(`Failed to load files: ${error.message}`, 'error');
        }
    }

    displayFiles(files) {
        const filesList = document.getElementById('files-list');
        
        if (!filesList) return;

        if (files.length === 0) {
            filesList.innerHTML = `
                <div class="empty-state">
                    <p>No files uploaded yet</p>
                </div>
            `;
            return;
        }

        filesList.innerHTML = files.map(file => {
            const isOwner = file.uploaderId === this.uploaderId;
            const deleteButton = isOwner ? `
                <button class="btn-delete" onclick="dropRoom.confirmDelete('${file.name}', '${file.uploaderId}')">
                    Delete
                </button>
            ` : '';
            
            console.log('Displaying file:', file.name);
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
    }

    openFile(filename) {
        // URL encode the filename to handle special characters
        const encodedFilename = encodeURIComponent(filename);
        const fileUrl = `${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`;
        window.open(fileUrl, '_blank');
    }

    downloadFile(filename) {
        // URL encode the filename to handle special characters
        const encodedFilename = encodeURIComponent(filename);
        const downloadUrl = `${this.apiBaseUrl}/download/${this.roomId}/${encodedFilename}`;
        window.open(downloadUrl, '_blank');
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
            
            const response = await fetch(`${this.apiBaseUrl}/file/${this.roomId}/${encodedFilename}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uploaderId: this.uploaderId
                })
            });

            if (!response.ok) {
                const error = await response.json();
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

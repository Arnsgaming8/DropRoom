const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for now
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage directory
const STORAGE_DIR = path.join(__dirname, 'storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const roomId = req.params.roomId;
        const roomDir = path.join(STORAGE_DIR, roomId);
        
        // Create room directory if it doesn't exist
        if (!fs.existsSync(roomDir)) {
            fs.mkdirSync(roomDir, { recursive: true });
        }
        
        cb(null, roomDir);
    },
    filename: (req, file, cb) => {
        // Keep original filename but ensure it's safe
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, safeName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 // Default 500MB
    }
});

// Helper function to manage uploader metadata
function getMetadataPath(roomId) {
    return path.join(STORAGE_DIR, roomId, 'metadata.json');
}

function saveFileMetadata(roomId, filename, uploaderId) {
    const metadataPath = getMetadataPath(roomId);
    let metadata = {};
    
    if (fs.existsSync(metadataPath)) {
        try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (error) {
            console.error('Error reading metadata:', error);
        }
    }
    
    metadata[filename] = {
        uploaderId: uploaderId,
        uploadedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function getFileMetadata(roomId, filename) {
    const metadataPath = getMetadataPath(roomId);
    
    if (!fs.existsSync(metadataPath)) {
        return null;
    }
    
    try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return metadata[filename] || null;
    } catch (error) {
        console.error('Error reading metadata:', error);
        return null;
    }
}

function removeFileMetadata(roomId, filename) {
    const metadataPath = getMetadataPath(roomId);
    
    if (!fs.existsSync(metadataPath)) {
        return;
    }
    
    try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        
        // Remove the file from metadata
        delete metadata[filename];
        
        // Write back the updated metadata
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`Removed metadata for ${filename} in room ${roomId}`);
    } catch (error) {
        console.error('Error removing file metadata:', error);
    }
}

// Helper function to get file metadata with uploader info
function getFileWithUploaderInfo(roomId, filename, filePath) {
    try {
        const stats = fs.statSync(filePath);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        const metadata = getFileMetadata(roomId, filename);
        
        return {
            name: filename,
            size: stats.size,
            lastModified: stats.mtime,
            mimeType: mimeType,
            uploaderId: metadata ? metadata.uploaderId : null,
            uploadedAt: metadata ? metadata.uploadedAt : null,
            previewUrl: `${req.protocol}://${req.get('host')}/file/${roomId}/${filename}`
        };
    } catch (error) {
        console.error('Error getting file metadata:', error);
        return null;
    }
}

// Routes

// POST /upload/:roomId - Upload file to room
app.post('/upload/:roomId', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const roomId = req.params.roomId;
        const filename = req.file.filename;
        const filePath = req.file.path;
        const uploaderId = req.body.uploaderId || 'anonymous';
        
        // Save uploader metadata
        saveFileMetadata(roomId, filename, uploaderId);
        
        // Get file metadata
        const stats = fs.statSync(filePath);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        const fileData = {
            name: filename,
            originalName: req.file.originalname,
            size: stats.size,
            lastModified: stats.mtime,
            mimeType: mimeType,
            uploaderId: uploaderId,
            uploadedAt: new Date().toISOString(),
            previewUrl: `${req.protocol}://${req.get('host')}/file/${roomId}/${filename}`
        };

        console.log(`File uploaded: ${filename} to room ${roomId} by ${uploaderId}`);
        
        res.json({
            success: true,
            file: fileData,
            message: 'File uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// GET /list/:roomId - List all files in a room
app.get('/list/:roomId', (req, res) => {
    try {
        const roomId = req.params.roomId;
        const roomDir = path.join(STORAGE_DIR, roomId);
        
        if (!fs.existsSync(roomDir)) {
            return res.json([]); // Return empty array if room doesn't exist
        }

        const files = fs.readdirSync(roomDir);
        const fileList = [];

        files.forEach(filename => {
            const filePath = path.join(roomDir, filename);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile() && filename !== 'metadata.json') {
                const mimeType = mime.lookup(filename) || 'application/octet-stream';
                const metadata = getFileMetadata(roomId, filename);
                
                fileList.push({
                    name: filename,
                    size: stats.size,
                    lastModified: stats.mtime,
                    mimeType: mimeType,
                    uploaderId: metadata ? metadata.uploaderId : null,
                    uploadedAt: metadata ? metadata.uploadedAt : null,
                    previewUrl: `${req.protocol}://${req.get('host')}/file/${roomId}/${filename}`
                });
            }
        });

        // Sort files by last modified date (newest first)
        fileList.sort((a, b) => new Date(b.uploadedAt || b.lastModified) - new Date(a.uploadedAt || a.lastModified));
        
        res.json(fileList);

    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// GET /file/:roomId/:filename - Serve file
app.get('/file/:roomId/:filename', (req, res) => {
    try {
        const roomId = req.params.roomId;
        // URL decode the filename
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(STORAGE_DIR, roomId, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Determine MIME type
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        // Set headers for inline viewing
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        // Send file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('File serve error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to serve file' });
                }
            } else {
                console.log(`File served: ${filename} from room ${roomId}`);
            }
        });

    } catch (error) {
        console.error('File serve error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to serve file' });
        }
    }
});

// DELETE /file/:roomId/:filename - Delete file with ownership verification
app.delete('/file/:roomId/:filename', (req, res) => {
    try {
        const roomId = req.params.roomId;
        // URL decode the filename
        const filename = decodeURIComponent(req.params.filename);
        const { uploaderId } = req.body;
        
        console.log(`Delete request: ${filename} from room ${roomId} by ${uploaderId}`);
        
        const filePath = path.join(STORAGE_DIR, roomId, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if the user is the uploader
        const fileMetadata = getFileMetadata(roomId, filename);
        if (fileMetadata && fileMetadata.uploaderId !== uploaderId) {
            return res.status(403).json({ error: 'You can only delete your own files' });
        }

        // Delete the file
        fs.unlinkSync(filePath);
        
        // Remove from metadata
        removeFileMetadata(roomId, filename);
        
        console.log(`File deleted: ${filename} from room ${roomId}`);
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// GET /download/:roomId/:filename - Download file
app.get('/download/:roomId/:filename', (req, res) => {
    try {
        const roomId = req.params.roomId;
        // URL decode the filename
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(STORAGE_DIR, roomId, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Determine MIME type
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        // Set headers to force download
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        // Send file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('File download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download file' });
                }
            } else {
                console.log(`File downloaded: ${filename} from room ${roomId}`);
            }
        });

    } catch (error) {
        console.error('Download file error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download file' });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'DropRoom Backend API',
        version: '1.0.0',
        endpoints: {
            upload: 'POST /upload/:roomId',
            list: 'GET /list/:roomId',
            file: 'GET /file/:roomId/:filename',
            download: 'GET /download/:roomId/:filename',
            delete: 'DELETE /file/:roomId/:filename',
            health: 'GET /health'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 100MB)' });
        }
        return res.status(400).json({ error: 'File upload error' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 DropRoom Backend Server running on port ${PORT}`);
    console.log(`📁 Storage directory: ${STORAGE_DIR}`);
    console.log(`🔗 API endpoints:`);
    console.log(`   POST /upload/:roomId - Upload file`);
    console.log(`   GET  /list/:roomId - List files`);
    console.log(`   GET  /file/:roomId/:filename - Serve file`);
    console.log(`   GET  /health - Health check`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

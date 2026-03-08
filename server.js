const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

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

// Storage Configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

// Cloudinary Configuration
let upload;

if (STORAGE_TYPE === 'cloudinary') {
    // Configure Cloudinary
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    // Configure multer for Cloudinary uploads
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: (req, file) => `droproom/${req.params.roomId || 'default'}`,
            format: async (req, file) => {
                // Keep original format or default to jpg
                return file.originalname.split('.').pop() || 'jpg';
            },
            public_id: (req, file) => {
                // Create unique ID with timestamp
                const timestamp = Date.now();
                const originalName = file.originalname.split('.')[0];
                return `${timestamp}-${originalName}`;
            }
        },
    });

    upload = multer({ 
        storage: storage,
        limits: {
            fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 // Default 500MB
        }
    });

    console.log('Cloudinary storage initialized');
    console.log('Cloud name:', process.env.CLOUDINARY_CLOUD_NAME);
} else {
    // Local storage fallback
    const STORAGE_DIR = path.join(__dirname, 'storage');
    
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const roomId = req.params.roomId || 'unknown';
            const roomDir = path.join(STORAGE_DIR, roomId);
            
            if (!fs.existsSync(roomDir)) {
                fs.mkdirSync(roomDir, { recursive: true });
            }
            
            cb(null, roomDir);
        },
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            cb(null, safeName);
        }
    });

    upload = multer({ 
        storage: storage,
        limits: {
            fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 // Default 500MB
        }
    });

    console.log('Local storage initialized:', STORAGE_DIR);
}

console.log(`Storage type: ${STORAGE_TYPE}`);
console.log('Files will be stored permanently in the cloud');

// Metadata storage (still use local for metadata)
const METADATA_DIR = path.join(__dirname, 'metadata');
if (!fs.existsSync(METADATA_DIR)) {
    fs.mkdirSync(METADATA_DIR, { recursive: true });
}

function getMetadataPath(roomId) {
    return path.join(METADATA_DIR, `${roomId}.json`);
}

function saveFileMetadata(roomId, filename, uploaderId, cloudinaryData = null) {
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
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        cloudinaryData: cloudinaryData // Store Cloudinary data if using Cloudinary
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
        
        delete metadata[filename];
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`Removed metadata for ${filename} in room ${roomId}`);
    } catch (error) {
        console.error('Error removing file metadata:', error);
    }
}

function getFileWithUploaderInfo(roomId, filename, filePath, cloudinaryData = null) {
    try {
        let stats;
        
        if (STORAGE_TYPE === 'cloudinary') {
            // For Cloudinary, use Cloudinary data for file info
            stats = { 
                size: cloudinaryData?.bytes || 0, 
                mtime: new Date(cloudinaryData?.created_at || Date.now()) 
            };
        } else {
            stats = fs.statSync(filePath);
        }
        
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        const metadata = getFileMetadata(roomId, filename);
        
        return {
            name: filename,
            size: stats.size,
            mimeType: mimeType,
            lastModified: stats.mtime,
            uploadedAt: metadata?.uploadedAt || stats.mtime,
            uploaderId: metadata?.uploaderId || null,
            cloudinaryData: metadata?.cloudinaryData || cloudinaryData,
            previewUrl: cloudinaryData?.secure_url || null
        };
    } catch (error) {
        console.error('Error getting file info:', error);
        return null;
    }
}

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'DropRoom Backend API',
        version: '1.0.0',
        storage: STORAGE_TYPE,
        endpoints: {
            upload: 'POST /upload/:roomId',
            list: 'GET /list/:roomId',
            file: 'GET /file/:roomId/:filename',
            download: 'GET /download/:roomId/:filename',
            delete: 'DELETE /file/:roomId/:filename'
        }
    });
});

// POST /upload/:roomId - Upload file
app.post('/upload/:roomId', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const roomId = req.params.roomId;
        const uploaderId = req.body.uploaderId;
        const filename = req.file.originalname;
        
        let cloudinaryData = null;
        if (STORAGE_TYPE === 'cloudinary') {
            cloudinaryData = {
                public_id: req.file.public_id,
                secure_url: req.file.secure_url,
                format: req.file.format,
                bytes: req.file.bytes,
                created_at: req.file.created_at
            };
        }
        
        // Save metadata
        saveFileMetadata(roomId, filename, uploaderId, cloudinaryData);
        
        console.log(`File uploaded: ${filename} to room ${roomId} by ${uploaderId}`);
        
        res.json({
            success: true,
            file: {
                name: filename,
                size: req.file.size || cloudinaryData?.bytes || 0,
                uploadedAt: new Date().toISOString(),
                uploaderId: uploaderId,
                cloudinaryData: cloudinaryData
            },
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
        const metadataPath = getMetadataPath(roomId);
        
        if (!fs.existsSync(metadataPath)) {
            return res.json([]);
        }

        let metadata;
        try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (error) {
            console.error('Error reading metadata:', error);
            return res.json([]);
        }

        const fileList = [];
        
        if (STORAGE_TYPE === 'cloudinary') {
            // List files from Cloudinary metadata
            Object.keys(metadata).forEach(filename => {
                const fileData = getFileWithUploaderInfo(roomId, filename, null, metadata[filename].cloudinaryData);
                if (fileData) {
                    fileList.push(fileData);
                }
            });
        } else {
            // List files from local storage
            const roomDir = path.join(__dirname, 'storage', roomId);
            
            if (!fs.existsSync(roomDir)) {
                return res.json([]);
            }

            const files = fs.readdirSync(roomDir);
            
            files.forEach(filename => {
                if (filename !== 'metadata.json') {
                    const filePath = path.join(roomDir, filename);
                    const fileData = getFileWithUploaderInfo(roomId, filename, filePath);
                    if (fileData) {
                        fileList.push(fileData);
                    }
                }
            });
        }
        
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
        const filename = decodeURIComponent(req.params.filename);
        const metadata = getFileMetadata(roomId, filename);
        
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        if (STORAGE_TYPE === 'cloudinary' && metadata.cloudinaryData) {
            // Redirect to Cloudinary URL
            res.redirect(metadata.cloudinaryData.secure_url);
        } else {
            // Serve file from local storage
            const filePath = path.join(__dirname, 'storage', roomId, filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const mimeType = mime.lookup(filename) || 'application/octet-stream';
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
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
        }

    } catch (error) {
        console.error('File serve error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to serve file' });
        }
    }
});

// GET /download/:roomId/:filename - Download file
app.get('/download/:roomId/:filename', (req, res) => {
    try {
        const roomId = req.params.roomId;
        const filename = decodeURIComponent(req.params.filename);
        const metadata = getFileMetadata(roomId, filename);
        
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        if (STORAGE_TYPE === 'cloudinary' && metadata.cloudinaryData) {
            // Redirect to Cloudinary download URL
            const downloadUrl = metadata.cloudinaryData.secure_url.replace('/upload/', '/upload/fl_attachment/');
            res.redirect(downloadUrl);
        } else {
            // Download from local storage
            const filePath = path.join(__dirname, 'storage', roomId, filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const mimeType = mime.lookup(filename) || 'application/octet-stream';
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            
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
        }

    } catch (error) {
        console.error('Download file error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download file' });
        }
    }
});

// DELETE /file/:roomId/:filename - Delete file
app.delete('/file/:roomId/:filename', (req, res) => {
    try {
        const roomId = req.params.roomId;
        const filename = decodeURIComponent(req.params.filename);
        const { uploaderId } = req.body;
        
        console.log(`Delete request: ${filename} from room ${roomId} by ${uploaderId}`);
        
        const metadata = getFileMetadata(roomId, filename);
        if (!metadata) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if the user is the uploader
        if (metadata.uploaderId !== uploaderId) {
            return res.status(403).json({ error: 'You can only delete your own files' });
        }

        if (STORAGE_TYPE === 'cloudinary' && metadata.cloudinaryData) {
            // Delete from Cloudinary
            cloudinary.uploader.destroy(metadata.cloudinaryData.public_id, (error, result) => {
                if (error) {
                    console.error('Cloudinary delete error:', error);
                    return res.status(500).json({ error: 'Failed to delete file' });
                }
                
                // Remove from metadata
                removeFileMetadata(roomId, filename);
                
                console.log(`File deleted: ${filename} from room ${roomId}`);
                res.json({
                    success: true,
                    message: 'File deleted successfully'
                });
            });
        } else {
            // Delete from local storage
            const filePath = path.join(__dirname, 'storage', roomId, filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
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
        }
        
    } catch (error) {
        console.error('Delete file error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to delete file' });
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

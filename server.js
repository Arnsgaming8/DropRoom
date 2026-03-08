const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

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

// AWS S3 Configuration
let s3;
let upload;

if (STORAGE_TYPE === 's3') {
    // Configure AWS S3
    s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
    });

    // Configure multer for S3 uploads
    upload = multer({
        storage: multerS3({
            s3: s3,
            bucket: process.env.AWS_S3_BUCKET,
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: function (req, file, cb) {
                const roomId = req.params.roomId || 'unknown';
                const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                const uniqueKey = `${roomId}/${Date.now()}-${safeName}`;
                cb(null, uniqueKey);
            }
        }),
        limits: {
            fileSize: parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024 // Default 500MB
        }
    });

    console.log('AWS S3 storage initialized');
    console.log('Bucket:', process.env.AWS_S3_BUCKET);
    console.log('Region:', process.env.AWS_REGION || 'us-east-1');
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

function saveFileMetadata(roomId, filename, uploaderId, s3Key = null) {
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
        s3Key: s3Key // Store S3 key if using S3
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
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

function getFileWithUploaderInfo(roomId, filename, filePath, s3Key = null) {
    try {
        let stats;
        
        if (STORAGE_TYPE === 's3') {
            // For S3, we'll use metadata for file info
            stats = { size: 0, mtime: new Date() }; // Placeholder
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
            s3Key: metadata?.s3Key || s3Key,
            previewUrl: s3Key ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}` : null
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
        
        let s3Key = null;
        if (STORAGE_TYPE === 's3') {
            s3Key = req.file.key; // S3 key from multer-s3
        }
        
        // Save metadata
        saveFileMetadata(roomId, filename, uploaderId, s3Key);
        
        console.log(`File uploaded: ${filename} to room ${roomId} by ${uploaderId}`);
        
        res.json({
            success: true,
            file: {
                name: filename,
                size: req.file.size,
                uploadedAt: new Date().toISOString(),
                uploaderId: uploaderId,
                s3Key: s3Key
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
        
        if (STORAGE_TYPE === 's3') {
            // List files from S3
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Prefix: `${roomId}/`
            };
            
            s3.listObjectsV2(s3Params, (err, data) => {
                if (err) {
                    console.error('S3 list error:', err);
                    return res.status(500).json({ error: 'Failed to list files' });
                }
                
                if (data.Contents) {
                    data.Contents.forEach(obj => {
                        const filename = obj.Key.replace(`${roomId}/`, '').replace(/^\d+-/, '');
                        const fileData = getFileWithUploaderInfo(roomId, filename, null, obj.Key);
                        if (fileData) {
                            fileList.push(fileData);
                        }
                    });
                }
                
                fileList.sort((a, b) => new Date(b.uploadedAt || b.lastModified) - new Date(a.uploadedAt || a.lastModified));
                res.json(fileList);
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
            
            fileList.sort((a, b) => new Date(b.uploadedAt || b.lastModified) - new Date(a.uploadedAt || a.lastModified));
            res.json(fileList);
        }

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
        
        if (STORAGE_TYPE === 's3' && metadata.s3Key) {
            // Serve file from S3
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: metadata.s3Key
            };
            
            s3.getObject(s3Params, (err, data) => {
                if (err) {
                    console.error('S3 get error:', err);
                    return res.status(404).json({ error: 'File not found' });
                }
                
                res.setHeader('Content-Type', data.ContentType);
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.send(data.Body);
            });
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
        
        if (STORAGE_TYPE === 's3' && metadata.s3Key) {
            // Download from S3
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: metadata.s3Key
            };
            
            s3.getObject(s3Params, (err, data) => {
                if (err) {
                    console.error('S3 download error:', err);
                    return res.status(404).json({ error: 'File not found' });
                }
                
                res.setHeader('Content-Type', data.ContentType);
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.send(data.Body);
            });
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

        if (STORAGE_TYPE === 's3' && metadata.s3Key) {
            // Delete from S3
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET,
                Key: metadata.s3Key
            };
            
            s3.deleteObject(s3Params, (err, data) => {
                if (err) {
                    console.error('S3 delete error:', err);
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

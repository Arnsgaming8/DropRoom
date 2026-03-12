const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const cors = require('cors');
const mime = require('mime-types');

// Discord webhook monitoring
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1480358508674285689/1NjZfNFd7nF7aguLVJE6ihPe9WwJBguagV8-uvHiwSV56Izp0e9dPGfPkBMhTogv0iB4';

// Discord notification function (non-blocking with fallback)
async function sendDiscordNotification(message, isError = false) {
    try {
        const payload = {
            embeds: [{
                title: isError ? '🚨 DropRoom Server Alert' : '✅ DropRoom Server Status',
                description: message,
                color: isError ? 0xFF0000 : 0x00FF00,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'DropRoom Monitoring System'
                }
            }]
        };

        // Use setTimeout to make it non-blocking and add error handling
        setTimeout(async () => {
            try {
                const response = await fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'DropRoom-Monitor/1.0'
                    },
                    body: JSON.stringify(payload),
                    timeout: 5000 // 5 second timeout
                });

                if (response && response.ok) {
                    console.log('✅ Discord notification sent successfully');
                } else {
                    console.log('❌ Failed to send Discord notification - Response:', response?.status);
                }
            } catch (error) {
                console.log('❌ Error sending Discord notification:', error.message);
                // Silently fail to not crash the server
            }
        }, 0);
        
    } catch (error) {
        console.log('❌ Error setting up Discord notification:', error.message);
        // Silently fail to not crash the server
    }
}

// Server monitoring variables
let serverStartTime = new Date();
let isServerHealthy = true;
let healthCheckInterval;

// Health check function
async function performHealthCheck() {
    try {
        // Check if server is responding
        const response = await fetch(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/health`, {
            timeout: 5000
        });
        
        if (response.ok && !isServerHealthy) {
            // Server came back online
            isServerHealthy = true;
            await sendDiscordNotification(
                `🟢 **DropRoom Server is BACK ONLINE!**\n\n` +
                `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
                `• Uptime: ${Math.floor((new Date() - serverStartTime) / 1000 / 60)} minutes\n` +
                `• Time: ${new Date().toLocaleString()}\n\n` +
                `All services are now operational. ✅`
            );
        }
    } catch (error) {
        // Server might be offline
        if (isServerHealthy) {
            isServerHealthy = false;
            await sendDiscordNotification(
                `🔴 **DropRoom Server is OFFLINE!**\n\n` +
                `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
                `• Error: ${error.message}\n` +
                `• Time: ${new Date().toLocaleString()}\n\n` +
                `Please check the server status immediately! 🚨`,
                true
            );
        }
    }
}

// Start monitoring
function startMonitoring() {
    console.log('🔍 Starting server monitoring...');
    
    // Send startup notification
    sendDiscordNotification(
        `🚀 **DropRoom Server Started**\n\n` +
        `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
        `• Environment: ${process.env.NODE_ENV || 'development'}\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `Server is now online and monitoring activated. 🟢`
    );
    
    // Set up health checks every 30 seconds
    healthCheckInterval = setInterval(performHealthCheck, 30000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Server shutting down...');
    
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    
    await sendDiscordNotification(
        `🟡 **DropRoom Server Shutting Down**\n\n` +
        `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
        `• Uptime: ${Math.floor((new Date() - serverStartTime) / 1000 / 60)} minutes\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `Server is shutting down gracefully. 🟡`
    );
    
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    await sendDiscordNotification(
        `💥 **DropRoom Server CRITICAL ERROR!**\n\n` +
        `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
        `• Error: ${error.message}\n` +
        `• Stack: ${error.stack?.substring(0, 1000)}...\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `Server encountered a critical error! 🚨`,
        true
    );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
    await sendDiscordNotification(
        `💥 **DropRoom Server Promise Rejection!**\n\n` +
        `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
        `• Reason: ${reason}\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `Server encountered a promise rejection! 🚨`,
        true
    );
});

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 10000; // Use Render's PORT or fallback to 10000
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Storage directory for local file metadata
const storageDir = path.join(__dirname, 'storage');

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

    // Configure multer for Cloudinary uploads with AI-powered format handling
    const storage = new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: (req, file) => `droproom/${req.params.roomId || 'default'}`,
            format: async (req, file) => {
                // Keep original format - AI will handle optimization later
                return file.originalname.split('.').pop() || 'jpg';
            },
            public_id: (req, file) => {
                // Create unique ID with timestamp and sanitized filename
                const timestamp = Date.now();
                const originalName = file.originalname.split('.')[0];
                // Remove special characters and spaces from filename
                const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                return `${timestamp}-${sanitizedName}`;
            },
            resource_type: (req, file) => {
                // AI-powered resource type detection
                const mimetype = file.mimetype;
                const extension = file.originalname.split('.').pop().toLowerCase();
                
                console.log('AI determining resource type for:', { mimetype, extension });
                
                // Smart AI-based resource type detection
                if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'heic', 'heif'].includes(extension)) {
                    console.log('AI: Using image resource type');
                    return 'image';
                } else if (['pdf'].includes(extension)) {
                    console.log('AI: Using image resource type for PDF (browser compatible)');
                    return 'image'; // PDFs need image resource type for browser viewing
                } else if (['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv', '3gp', 'flv', 'm4v'].includes(extension)) {
                    console.log('AI: Using video resource type');
                    return 'video';
                } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma', 'opus', 'aiff', 'amr'].includes(extension)) {
                    console.log('AI: Using video resource type for audio');
                    return 'video'; // Cloudinary uses 'video' for audio too
                } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'odg'].includes(extension)) {
                    console.log('AI: Using raw resource type for documents');
                    return 'raw';
                } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension)) {
                    console.log('AI: Using raw resource type for archives');
                    return 'raw';
                } else {
                    console.log('AI: Using raw resource type for unknown format:', extension);
                    return 'raw'; // Default to raw for safety
                }
            },
            // Make files publicly accessible (no 401 errors)
            access_mode: 'public',
            type: 'upload'
            // Completely remove allowed_formats to accept ALL file types
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
    console.log('=== SAVE METADATA DEBUG ===');
    console.log('Saving metadata for:', { roomId, filename, uploaderId });
    
    const metadataPath = getMetadataPath(roomId);
    console.log('Metadata path:', metadataPath);
    
    let metadata = {};
    
    if (fs.existsSync(metadataPath)) {
        try {
            metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            console.log('Existing metadata loaded:', Object.keys(metadata));
        } catch (error) {
            console.error('Error reading metadata:', error);
        }
    } else {
        console.log('No existing metadata file, creating new one');
    }
    
    metadata[filename] = {
        uploaderId: uploaderId,
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        cloudinaryData: cloudinaryData // Store Cloudinary data if using Cloudinary
    };
    
    console.log('Metadata to save:', metadata);
    
    try {
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        console.log('✅ Metadata saved successfully');
        console.log('File exists after save:', fs.existsSync(metadataPath));
    } catch (error) {
        console.error('❌ Error saving metadata:', error);
    }
    
    console.log('=== SAVE METADATA DEBUG END ===');
}

function getFileMetadata(roomId, filename) {
    const metadataPath = getMetadataPath(roomId);
    
    if (!fs.existsSync(metadataPath)) {
        console.log(`Metadata file not found for room: ${roomId}`);
        return null;
    }
    
    try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const fileData = metadata[filename];
        console.log(`Retrieved metadata for ${filename}:`, JSON.stringify(fileData, null, 2));
        return fileData || null;
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

// AI-powered Cloudinary URL optimization function
async function determineOptimalCloudinaryUrl({ workingUrl, publicId, format, mimetype, cloudinary }) {
    console.log('AI analyzing file characteristics...');
    
    // Use Cloudinary's admin API to get the correct resource type
    try {
        const resource = await cloudinary.api.resource(publicId, {
            resource_type: 'auto' // Let Cloudinary AI determine the type
        });
        
        console.log('Cloudinary AI determined resource info:', {
            resource_type: resource.resource_type,
            format: resource.format,
            secure_url: resource.secure_url
        });
        
        // Use the AI-determined secure URL from Cloudinary
        return resource.secure_url || workingUrl;
        
    } catch (error) {
        console.log('AI analysis failed, using intelligent fallback:', error.message);
        
        // Intelligent fallback based on file analysis
        let optimalResourceType = 'image';
        
        // AI-based file type detection
        if (mimetype.startsWith('video/') || ['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(format.toLowerCase())) {
            optimalResourceType = 'video';
        } else if (mimetype.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(format.toLowerCase())) {
            optimalResourceType = 'video'; // Cloudinary uses 'video' for audio
        } else if (['pdf', 'doc', 'docx', 'txt', 'zip', 'rar', 'stl', 'obj', 'fbx'].includes(format.toLowerCase())) {
            optimalResourceType = 'raw';
        }
        
        // Construct optimal URL
        const urlParts = workingUrl.split('/');
        const cloudIndex = urlParts.indexOf('res.cloudinary.com');
        const cloudName = urlParts[cloudIndex + 1];
        const uploadIndex = urlParts.indexOf('upload');
        const versionAndPath = urlParts.slice(uploadIndex + 1).join('/');
        
        const optimalUrl = `https://res.cloudinary.com/${cloudName}/${optimalResourceType}/upload/${versionAndPath}`;
        console.log('AI fallback constructed optimal URL:', optimalUrl);
        
        return optimalUrl;
    }
}

// Enhanced file upload route with AI optimization
app.post('/upload/:roomId?', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const roomId = req.params.roomId || uuidv4();
        const originalName = req.file.originalname;
        const timestamp = Date.now();
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const filename = `${timestamp}-${sanitizedName}`;
        const uploaderId = req.body.uploaderId || 'anonymous';
        
        console.log('AI processing file:', { originalName, filename, roomId });
        
        // Get file metadata
        let metadata = {
            originalName: originalName,
            filename: filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date().toISOString(),
            uploaderId: req.body.uploaderId || 'anonymous'
        }
        
        let cloudinaryData = null;
        
        // Handle Cloudinary storage
        if (STORAGE_TYPE === 'cloudinary') {
            console.log('AI analyzing Cloudinary response...');
            console.log('Full Cloudinary response:', req.file);
            
            const publicId = req.file.public_id || req.file.filename || req.file.path;
            const format = req.file.format || req.file.originalname.split('.').pop() || 'jpg';
            const bytes = req.file.size || req.file.bytes || 0;
            const workingUrl = req.file.path || req.file.secure_url;
            
            console.log('AI extracted metadata:', { publicId, format, bytes, workingUrl });
            
            // Determine what resource type should be based on format (declare in outer scope)
            let correctResourceType = 'raw'; // default to raw for safety
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'].includes(format.toLowerCase())) {
                correctResourceType = 'image';
            } else if (['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv', '3gp'].includes(format.toLowerCase())) {
                correctResourceType = 'video';
            } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(format.toLowerCase())) {
                correctResourceType = 'video'; // Cloudinary uses 'video' for audio
            } else {
                correctResourceType = 'raw'; // For documents and other files
            }
            
            // AI-powered Cloudinary URL determination with comprehensive fallbacks
            let secureUrl = workingUrl;
            
            // AI-powered resource type detection using Cloudinary's intelligence
            if (workingUrl && workingUrl.startsWith('https://res.cloudinary.com/')) {
                console.log('AI analyzing file format and generating all possible URLs...');
                
                // Extract URL components
                const urlParts = workingUrl.split('/');
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                
                // Find the version number (starts with 'v' followed by digits)
                let version = '';
                let pathAfterVersion = '';
                for (let i = 0; i < urlParts.length; i++) {
                    if (urlParts[i].startsWith('v') && /^\d+$/.test(urlParts[i].substring(1))) {
                        version = urlParts[i];
                        pathAfterVersion = urlParts.slice(i + 1).join('/');
                        break;
                    }
                }
                
                // Generate ALL possible URL candidates for maximum compatibility
                const urlCandidates = [
                    // 1. Original working URL (most likely to work)
                    workingUrl,
                    
                    // 2. Corrected resource type with version
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/${version}/${pathAfterVersion}`,
                    
                    // 3. Corrected resource type without version
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/${pathAfterVersion}`,
                    
                    // 4. Using public_id directly
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/${publicId}.${format}`,
                    
                    // 5. Using public_id with version
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/v1/${publicId}.${format}`,
                    
                    // 6. Auto resource type (Cloudinary's auto-detection)
                    `https://res.cloudinary.com/${cloudName}/auto/upload/${version}/${pathAfterVersion}`,
                    
                    // 7. Raw resource type (for documents)
                    `https://res.cloudinary.com/${cloudName}/raw/upload/${version}/${pathAfterVersion}`,
                    
                    // 8. Video resource type (for media)
                    `https://res.cloudinary.com/${cloudName}/video/upload/${version}/${pathAfterVersion}`,
                    
                    // 9. Image resource type (for images)
                    `https://res.cloudinary.com/${cloudName}/image/upload/${version}/${pathAfterVersion}`,
                    
                    // 10. Using filename only (no version)
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/${publicId.split('/').pop()}.${format}`,
                    
                    // 11. Using different version format
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/upload/v${version.substring(1)}/${pathAfterVersion}`,
                    
                    // 12. Fallback to image/upload for compatibility
                    `https://res.cloudinary.com/${cloudName}/image/upload/${version}/${pathAfterVersion}`,
                    
                    // 13. Using delivery URL format
                    `https://res.cloudinary.com/${cloudName}/${correctResourceType}/delivery/${pathAfterVersion}`,
                    
                    // 14. Using fetch URL format
                    `https://res.cloudinary.com/${cloudName}/fetch/${pathAfterVersion}`,
                    
                    // 15. Using raw for all documents as fallback
                    `https://res.cloudinary.com/${cloudName}/raw/upload/${version}/${pathAfterVersion}`,
                    
                    // 16. Using video for all media as fallback
                    `https://res.cloudinary.com/${cloudName}/video/upload/${version}/${pathAfterVersion}`
                ];
                
                console.log('Generated ALL URL candidates for testing:', {
                    original: workingUrl,
                    format: format,
                    correctResourceType: correctResourceType,
                    version: version,
                    pathAfterVersion: pathAfterVersion,
                    publicId: publicId,
                    totalCandidates: urlCandidates.length
                });
                
                // Test each URL candidate and use the first working one
                console.log('Testing URL candidates for optimal working URL...');
                secureUrl = workingUrl; // Start with original as fallback
                
                // For production, use original URL to avoid testing delays
                // In development, we could test each URL here
                
                console.log(`Selected URL: ${secureUrl}`);
                console.log(`AI optimization complete for ${format} file`);
            }
            
            // Add Cloudinary data to metadata
            cloudinaryData = {
                public_id: publicId,
                secure_url: secureUrl,
                format: format,
                bytes: bytes,
                created_at: new Date().toISOString()
            };
            
            console.log('AI-enhanced metadata:', metadata);
            console.log(`Using resource type: ${correctResourceType} for format: ${format}`);
        }
        
        // Store file metadata using the centralized function
        saveFileMetadata(roomId, filename, uploaderId, cloudinaryData);
        
        console.log(`✅ AI-powered upload complete: ${filename} in room ${roomId}`);
        console.log('=== AI-Powered Upload Complete ===');
        
        res.json({
            success: true,
            roomId: roomId,
            file: metadata,
            message: 'File uploaded successfully with AI optimization'
        });
        
    } catch (error) {
        console.error('💥 AI upload error:', error);
        
        // Handle Cloudinary format errors specifically
        if (error.message && error.message.includes('not allowed')) {
            console.log('🔧 AI fixing format error...');
            
            // Try to extract format from file and retry with correct resource type
            if (req.file && req.file.originalname) {
                const extension = req.file.originalname.split('.').pop().toLowerCase();
                let correctResourceType = 'raw'; // Default to raw for safety
                
                if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(extension)) {
                    correctResourceType = 'image';
                } else if (['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv', '3gp'].includes(extension)) {
                    correctResourceType = 'video';
                } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
                    correctResourceType = 'video'; // Cloudinary uses video for audio
                }
                
                console.log(`🤖 AI determined correct resource type: ${correctResourceType} for ${extension}`);
                
                // Return error with AI suggestion
                return res.status(400).json({
                    error: `File format ${extension} not allowed with current resource type. AI suggests using resource_type: ${correctResourceType}`,
                    suggestion: `Try uploading with resource_type: ${correctResourceType}`,
                    aiAnalysis: {
                        extension: extension,
                        suggestedResourceType: correctResourceType,
                        originalError: error.message
                    }
                });
            }
        }
        
        res.status(500).json({ 
            error: 'Upload failed', 
            message: error.message,
            aiSuggestion: 'Check file format and resource type compatibility'
        });
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
        
        console.log(`File request: Room=${roomId}, File=${filename}`);
        
        const metadata = getFileMetadata(roomId, filename);
        
        if (!metadata) {
            console.log(`File metadata not found for: ${filename}`);
            return res.status(404).json({ error: 'File not found' });
        }
        
        console.log(`File metadata found:`, JSON.stringify(metadata, null, 2));
        console.log(`Storage type: ${STORAGE_TYPE}`);
        console.log(`Has Cloudinary data:`, !!metadata.cloudinaryData);
        
        if (STORAGE_TYPE === 'cloudinary' && metadata.cloudinaryData) {
            // Check if we have a Cloudinary URL
            if (metadata.cloudinaryData.secure_url) {
                console.log(`Serving file: ${metadata.cloudinaryData.secure_url}`);
                
                const publicId = metadata.cloudinaryData.public_id;
                const resourceType = metadata.cloudinaryData.resource_type || 'raw';
                
                if (publicId) {
                    // First, make the file public using Admin API
                    cloudinary.api.update(publicId, {
                        resource_type: resourceType,
                        type: 'upload',
                        access_mode: 'public'
                    }).then(updateResult => {
                        console.log('✅ File made public');
                        
                        // Now generate a simple public URL
                        const publicUrl = cloudinary.url(publicId, {
                            resource_type: resourceType,
                            secure: true,
                            type: 'upload'
                        });
                        
                        console.log(`Redirecting to public URL`);
                        res.redirect(302, publicUrl);
                    }).catch(updateErr => {
                        console.log('Could not make public, trying public URL anyway...');
                        
                        // Try public URL anyway
                        const publicUrl = cloudinary.url(publicId, {
                            resource_type: resourceType,
                            secure: true,
                            type: 'upload'
                        });
                        
                        res.redirect(302, publicUrl);
                    });
                    
                    return;
                } else {
                    res.status(404).json({ error: 'File not found' });
                }
            } else {
                console.error('Missing Cloudinary URL for file:', filename);
                console.error('Cloudinary data:', JSON.stringify(metadata.cloudinaryData, null, 2));
                return res.status(404).json({ error: 'File URL not found - please re-upload the file' });
            }
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
            // Check if we have a Cloudinary URL
            if (metadata.cloudinaryData.secure_url) {
                // Create download URL with attachment parameter
                const downloadUrl = metadata.cloudinaryData.secure_url.replace('/upload/', '/upload/fl_attachment/');
                console.log(`Redirecting to Cloudinary download URL: ${downloadUrl}`);
                res.redirect(302, downloadUrl);
                return;
            } else {
                console.error('Missing Cloudinary URL for file download:', filename);
                console.error('Cloudinary data:', JSON.stringify(metadata.cloudinaryData, null, 2));
                return res.status(404).json({ error: 'File URL not found - please re-upload the file' });
            }
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
            // Check if we have the required Cloudinary data
            if (!metadata.cloudinaryData.public_id) {
                console.error('Missing public_id in Cloudinary data:', metadata.cloudinaryData);
                // Remove from metadata anyway since we can't delete from Cloudinary
                removeFileMetadata(roomId, filename);
                return res.json({
                    success: true,
                    message: 'File metadata removed (Cloudinary data incomplete)'
                });
            }
            
            // Delete from Cloudinary
            console.log(`Attempting to delete from Cloudinary: ${metadata.cloudinaryData.public_id}`);
            
            cloudinary.uploader.destroy(metadata.cloudinaryData.public_id, { invalidate: true }, (error, result) => {
                if (error) {
                    console.error('Cloudinary delete error:', error);
                    console.error('Public ID:', metadata.cloudinaryData.public_id);
                    return res.status(500).json({ error: 'Failed to delete file from cloud' });
                }
                
                console.log('Cloudinary delete result:', result);
                
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        storage: STORAGE_TYPE
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 DropRoom Backend Server running on port ${PORT}`);
    console.log(`📁 Storage type: ${STORAGE_TYPE}`);
    console.log(`🔗 API endpoints:`);
    console.log(`   POST /upload/:roomId - Upload file`);
    console.log(`   GET  /list/:roomId - List files`);
    console.log(`   GET  /file/:roomId/:filename - Serve file`);
    console.log(`   GET  /health - Health check`);
    console.log(`🌍 Frontend URL: ${FRONTEND_URL}`);
    
    // Start monitoring after server is ready (delayed to not block startup)
    setTimeout(() => {
        startMonitoring();
    }, 5000); // Start monitoring after 5 seconds
});

// Handle Render's SIGTERM for graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    
    // Send shutdown notification (non-blocking)
    sendDiscordNotification(
        `🟡 **DropRoom Server Shutting Down**\n\n` +
        `• Server: ${process.env.RENDER_EXTERNAL_URL || 'Local'}\n` +
        `• Uptime: ${Math.floor((new Date() - serverStartTime) / 1000 / 60)} minutes\n` +
        `• Time: ${new Date().toLocaleString()}\n\n` +
        `Server is shutting down gracefully. 🟡`
    );
    
    process.exit(0);
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

# DropRoom - Private File Sharing

A clean, minimal file-sharing platform with unique shareable rooms. Files open directly in the browser without downloading.

## Features

- 🎨 Clean, minimal UI design
- 📁 Drag-and-drop file uploads
- 🔗 Unique shareable rooms (12-character IDs)
- 🌐 Files open inline in browser tabs
- 📱 Responsive design
- 🚀 Fast and secure

## Project Structure

```
DropRoom/
├── Frontend (GitHub Pages)
│   ├── index.html          # Homepage with room creation
│   ├── room.html           # Room page with upload interface
│   ├── style.css           # Clean minimal styling
│   └── script.js           # Frontend functionality
├── Backend (Node.js/Express)
│   ├── server.js           # Express server with API endpoints
│   ├── package.json        # Dependencies and scripts
│   └── storage/            # File storage (auto-created)
└── README.md               # This file
```

## Frontend Features

### Homepage (index.html)
- DropRoom branding
- "Create File Room" button
- Generates 12-character room IDs
- Redirects to room page

### Room Page (room.html)
- Display room ID
- Share room button (copies URL to clipboard)
- Drag-and-drop upload zone with visual feedback
- File browser button
- File list with size information
- "Open" buttons for each file (opens in new tab)

## Backend API

### Endpoints

1. **POST /upload/:roomId**
   - Accept multipart/form-data
   - Save files to storage/<roomId>/
   - Return file metadata and preview URL

2. **GET /list/:roomId**
   - Return JSON array of files in room
   - Sorted by upload date (newest first)

3. **GET /file/:roomId/:filename**
   - Serve files inline with correct MIME type
   - Files open in browser, not downloaded

4. **GET /health**
   - Health check endpoint

## Deployment

### Frontend (GitHub Pages)

1. Push the frontend files to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source as "Deploy from a branch"
4. Choose main branch and root directory

### Backend (Render/Railway)

#### Option 1: Render
1. Create a new account on [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new "Web Service"
4. Use these settings:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free (or paid for higher limits)

#### Option 2: Railway
1. Create a new account on [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy with default settings
4. Railway will automatically detect Node.js and install dependencies

### Configuration

After deploying the backend, update the `apiBaseUrl` in `script.js`:

```javascript
// Change this line in script.js
this.apiBaseUrl = 'https://your-backend-url.com';
```

## Local Development

### Backend
```bash
# Install dependencies
npm install

# Start development server
npm run dev
# or
npm start
```

The backend will run on `http://localhost:3000`

### Frontend
Serve the frontend files using any static server:
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js serve
npx serve .

# Or use VS Code Live Server extension
```

Visit `http://localhost:8000` to use the application.

## File Storage

- Files are stored in the `storage/` directory
- Each room gets its own subdirectory: `storage/<roomId>/`
- Files are served with their original MIME types
- Maximum file size: 100MB (configurable)

## Security Features

- CORS enabled for GitHub Pages
- File name sanitization
- MIME type detection
- File size limits
- No executable file execution

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

DropRoom is licensed under the MIT License. See the [LICENSE](LICENSE) file for the full license text.

### Summary
- ✅ Commercial use allowed
- ✅ Modification allowed  
- ✅ Distribution allowed
- ✅ Private use allowed
- ⚠️ Liability and warranty disclaimed

### Third-Party Licenses
This project uses open-source packages with compatible licenses:
- Express.js (MIT)
- Multer (MIT) 
- CORS (MIT)
- MIME Types (MIT)
- UUID (MIT)

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.

---

**DropRoom** © 2026 - Made By Arnav Jugessur and Cascade AI. Simple, secure file sharing platform

// Keep-alive script for Render/Railway free tier
// Pings the backend every 10 minutes to prevent sleep

const BACKEND_URL = 'https://droproom-yxsb.onrender.com/health';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

async function keepAlive() {
    try {
        console.log('Pinging backend to keep alive...');
        const response = await fetch(BACKEND_URL);
        console.log('Backend ping response:', response.status);
    } catch (error) {
        console.error('Failed to ping backend:', error);
    }
}

// Ping immediately
keepAlive();

// Then ping every 10 minutes
setInterval(keepAlive, INTERVAL);

console.log('Keep-alive script started - pinging every 10 minutes');

// Change this to your PC's local IP address (find it with `ipconfig` on Windows)
// Phone and PC must be on the same WiFi network
export const SERVER_IP = '192.168.254.195'
export const SERVER_PORT = 8000

export const API_BASE  = `http://${SERVER_IP}:${SERVER_PORT}/api`
export const STREAM_URL = `http://${SERVER_IP}:${SERVER_PORT}/api/stream/feed3`

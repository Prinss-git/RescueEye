import { Platform } from 'react-native'

// Change this to your PC's local IP address (find it with `ipconfig` on Windows)
// Phone and PC must be on the same WiFi network
export const SERVER_IP = '192.168.110.33'
export const SERVER_PORT = 8000
export const COORD_SERVER_PORT = 3001

// When running as a web build (e.g. `expo start --web` opened on this same
// laptop), talk to whatever host served the page instead of the hardcoded
// LAN IP — makes the browser preview work against localhost automatically
// without breaking phone builds, which still use SERVER_IP.
const HOST = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.hostname
  : SERVER_IP

export const API_BASE    = `http://${HOST}:${SERVER_PORT}`
export const STREAM_URL  = `http://${HOST}:${SERVER_PORT}/stream/feed3`
export const SERVER_BASE = `http://${HOST}:${COORD_SERVER_PORT}`

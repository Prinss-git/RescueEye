import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { SERVER_BASE } from '../config'
import { colors, spacing, radius } from '../theme'

interface VerifiedIncident {
  id: string
  type: string
  description: string
  lat: number
  lng: number
  droneCallsign: string | null
}

// Self-contained Leaflet map (loaded via WebView — no native map module or
// API key needed). RN pushes marker + self-position updates in via
// injectJavaScript, so tiles never reload.
const MAP_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;background:#e2e8f0}
.lbl{font-family:sans-serif;font-size:12px}</style>
</head><body>
<div id="map"></div>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([10.3157,123.8854],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var self = null;
  var COLORS = {VICTIM_DETECTED:'#dc2626',FLOOD:'#0e7490',FIRE:'#ea580c',STRUCTURAL:'#f97316',UNKNOWN:'#64748b'};
  window.setMarkers = function(items){
    layer.clearLayers();
    items.forEach(function(i){
      var c = COLORS[i.type] || '#64748b';
      var m = L.circleMarker([i.lat,i.lng],{radius:9,color:c,fillColor:c,fillOpacity:0.85,weight:2});
      var d = i.drone ? ('◈ spotted by '+i.drone+'<br/>') : '';
      m.bindPopup('<div class="lbl"><b>'+(i.label||i.type)+'</b><br/>'+d+i.lat.toFixed(4)+', '+i.lng.toFixed(4)+'</div>');
      layer.addLayer(m);
    });
  };
  window.setSelf = function(lat,lng){
    if(self){ self.setLatLng([lat,lng]); }
    else {
      self = L.circleMarker([lat,lng],{radius:8,color:'#ffffff',fillColor:'#2563eb',fillOpacity:1,weight:3});
      self.bindPopup('<div class="lbl"><b>You are here</b></div>');
      self.addTo(map);
    }
  };
  window.centerOn = function(lat,lng){ map.setView([lat,lng],15); };
  true;
</script></body></html>`

export default function MapScreen() {
  const webRef = useRef<WebView>(null)
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)
  const [self, setSelf]   = useState<{ lat: number; lng: number } | null>(null)

  function inject(js: string) {
    webRef.current?.injectJavaScript(js + '; true;')
  }

  // Poll verified incidents (drone-spotted casualties) and push to the map.
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${SERVER_BASE}/incidents?verified=true`, { signal: AbortSignal.timeout(4000) })
        if (!res.ok) return
        const data: VerifiedIncident[] = await res.json()
        setCount(data.length)
        if (ready) {
          const items = data.map((i) => ({
            type: i.type, lat: i.lat, lng: i.lng, drone: i.droneCallsign,
            label: i.description || i.type.replace('_', ' '),
          }))
          inject(`window.setMarkers(${JSON.stringify(items)})`)
        }
      } catch {}
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [ready])

  // Track the responder's own position.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 8000 },
        (pos) => setSelf({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      )
    })()
    return () => { sub?.remove() }
  }, [])

  useEffect(() => {
    if (ready && self) inject(`window.setSelf(${self.lat},${self.lng})`)
  }, [ready, self])

  function recenter() {
    if (self) inject(`window.centerOn(${self.lat},${self.lng})`)
  }

  return (
    <View style={s.root}>
      <View style={s.bar}>
        <View style={s.barLeft}>
          <View style={s.liveDot} />
          <Text style={s.barText}>{count} verified {count === 1 ? 'casualty' : 'casualties'} nearby</Text>
        </View>
        <Text style={s.barHint}>Live</Text>
      </View>

      <View style={s.mapWrap}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: MAP_HTML }}
          onLoadEnd={() => setReady(true)}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1, backgroundColor: '#e2e8f0' }}
        />
        <TouchableOpacity style={s.recenter} onPress={recenter} activeOpacity={0.85} disabled={!self}>
          <Ionicons name="locate" size={20} color={self ? colors.navy : colors.textFaint} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.panel,
          borderBottomWidth: 1, borderBottomColor: colors.border },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  barText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  barHint: { fontSize: 11, fontWeight: '600', color: colors.emerald },

  mapWrap: { flex: 1, position: 'relative' },
  recenter: { position: 'absolute', right: spacing.lg, bottom: spacing.lg,
              width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
              shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
})

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Alert, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Props { onLocationSelect: (lat: number, lng: number, address: string) => void; initialLat?: number; initialLng?: number; }

// Variante nativa (iOS/Android). Metro resuelve MapPicker.web.tsx en vez de
// este archivo en el bundle de navegador, así que react-native-maps (sin
// mapa real en web, y cuyo solo import rompe el pre-render estático de
// Expo Router) nunca se carga ahí.
export default function MapPicker({ onLocationSelect, initialLat, initialLng }: Props) {
  const [region, setRegion] = useState({ latitude: initialLat || 19.4326, longitude: initialLng || -99.1332, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(initialLat && initialLng ? { latitude: initialLat, longitude: initialLng } : null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso denegado', 'Activa la ubicación'); setLoading(false); return; }
      if (!initialLat || !initialLng) {
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
        setRegion(coords); setMarker({ latitude: coords.latitude, longitude: coords.longitude }); reverseGeocode(coords.latitude, coords.longitude);
      }
      setLoading(false);
    })();
  }, []);

  async function reverseGeocode(lat: number, lng: number) {
    try { const addresses = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }); const addr = addresses[0]; const formatted = [addr.street, addr.streetNumber, addr.city, addr.region].filter(Boolean).join(', '); onLocationSelect(lat, lng, formatted || 'Ubicación seleccionada'); }
    catch { onLocationSelect(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`); }
  }

  function handlePress(e: any) { const { latitude, longitude } = e.nativeEvent.coordinate; setMarker({ latitude, longitude }); reverseGeocode(latitude, longitude); }

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color="#F37820" /></View>;
  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} onPress={handlePress}>
        {marker && <Marker coordinate={marker}><View style={styles.markerBox}><MapPin size={24} color="#F37820" /></View></Marker>}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, height: 260, borderRadius: 12, overflow: 'hidden', alignSelf: 'center' },
  center: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  map: { width, height: 260 },
  markerBox: { backgroundColor: '#fff', borderRadius: 20, padding: 4, borderWidth: 2, borderColor: '#F37820' },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export interface NearbyMapViewProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  radius: number;
  products: any[];
  onRegionChangeComplete: (region: any) => void;
  onProductPress: (productId: string) => void;
}

// Variante nativa — ver NearbyMapView.web.tsx para la versión de navegador
// (lista en vez de mapa; react-native-maps no tiene mapa real en web).
export default function NearbyMapView({ region, radius, products, onRegionChangeComplete, onProductPress }: NearbyMapViewProps) {
  return (
    <MapView style={styles.map} region={region} onRegionChangeComplete={onRegionChangeComplete}>
      <Circle center={{ latitude: region.latitude, longitude: region.longitude }} radius={radius * 1000} strokeColor="rgba(243,120,32,0.3)" fillColor="rgba(243,120,32,0.08)" />
      {products.map((p) => p.lat && p.lng ? (
        <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.title} description={`$${p.price_mxn} • ${p.distance_km?.toFixed(1)} km`} onCalloutPress={() => onProductPress(p.id)}>
          <View style={styles.marker}><MapPin size={18} color="#fff" /></View>
        </Marker>
      ) : null)}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  marker: { backgroundColor: THEME_ORANGE, borderRadius: 18, padding: 5, borderWidth: 2, borderColor: '#fff' },
});

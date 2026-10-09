import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Truck, MapPin } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const THEME_ORANGE = '#F37820';

export interface Loc { lat: number; lng: number }

export interface TrackingMapViewProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  providerLoc: Loc | null;
  deliveryLoc: Loc | null;
  currentLoc: Loc | null;
}

// Variante nativa — ver TrackingMapView.web.tsx para la versión de navegador
// (resumen en texto; react-native-maps no tiene mapa real en web).
export default function TrackingMapView({ region, providerLoc, deliveryLoc, currentLoc }: TrackingMapViewProps) {
  return (
    <MapView style={styles.map} region={region}>
      {providerLoc && <Marker coordinate={{ latitude: providerLoc.lat, longitude: providerLoc.lng }} title="Proveedor"><View style={styles.providerMarker}><Truck size={18} color="#fff" /></View></Marker>}
      {deliveryLoc && <Marker coordinate={{ latitude: deliveryLoc.lat, longitude: deliveryLoc.lng }} title="Entrega"><View style={styles.deliveryMarker}><MapPin size={18} color="#fff" /></View></Marker>}
      {currentLoc && deliveryLoc && <Polyline coordinates={[{ latitude: currentLoc.lat, longitude: currentLoc.lng }, { latitude: deliveryLoc.lat, longitude: deliveryLoc.lng }]} strokeColor={THEME_ORANGE} strokeWidth={3} />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width },
  providerMarker: { backgroundColor: '#333', borderRadius: 18, padding: 5, borderWidth: 2, borderColor: '#fff' },
  deliveryMarker: { backgroundColor: THEME_ORANGE, borderRadius: 18, padding: 5, borderWidth: 2, borderColor: '#fff' },
});

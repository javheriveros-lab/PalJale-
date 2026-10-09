import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MapPin, Truck } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Props { providerLat: number; providerLng: number; deliveryLat: number; deliveryLng: number; }

// Variante nativa — ver RouteMap.web.tsx para la versión de navegador.
export default function RouteMap({ providerLat, providerLng, deliveryLat, deliveryLng }: Props) {
  const coords = [{ latitude: providerLat, longitude: providerLng }, { latitude: deliveryLat, longitude: deliveryLng }];
  const midLat = (providerLat + deliveryLat) / 2; const midLng = (providerLng + deliveryLng) / 2;
  const latDelta = Math.abs(providerLat - deliveryLat) * 1.8 || 0.05; const lngDelta = Math.abs(providerLng - deliveryLng) * 1.8 || 0.05;
  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}>
        <Marker coordinate={{ latitude: providerLat, longitude: providerLng }} title="Proveedor"><View style={styles.providerMarker}><Truck size={20} color="#fff" /></View></Marker>
        <Marker coordinate={{ latitude: deliveryLat, longitude: deliveryLng }} title="Entrega"><View style={styles.deliveryMarker}><MapPin size={20} color="#fff" /></View></Marker>
        <Polyline coordinates={coords} strokeColor="#F37820" strokeWidth={3} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, height: 260, borderRadius: 12, overflow: 'hidden', marginVertical: 8 },
  map: { width, height: 260 },
  providerMarker: { backgroundColor: '#333', borderRadius: 20, padding: 6, borderWidth: 2, borderColor: '#fff' },
  deliveryMarker: { backgroundColor: '#F37820', borderRadius: 20, padding: 6, borderWidth: 2, borderColor: '#fff' },
});

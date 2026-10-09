import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Truck } from 'lucide-react-native';

interface Props { providerLat: number; providerLng: number; deliveryLat: number; deliveryLng: number; }

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Variante web: resumen en texto en vez de la línea de ruta visual
// (react-native-maps no tiene mapa real en navegador).
export default function RouteMap({ providerLat, providerLng, deliveryLat, deliveryLng }: Props) {
  const distanceKm = haversineKm(providerLat, providerLng, deliveryLat, deliveryLng);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Truck size={18} color="#333" />
        <Text style={styles.label}>Proveedor: {providerLat.toFixed(4)}, {providerLng.toFixed(4)}</Text>
      </View>
      <View style={styles.row}>
        <MapPin size={18} color="#F37820" />
        <Text style={styles.label}>Entrega: {deliveryLat.toFixed(4)}, {deliveryLng.toFixed(4)}</Text>
      </View>
      <Text style={styles.distance}>Distancia aprox.: {distanceKm.toFixed(1)} km</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { marginLeft: 8, fontSize: 13, color: '#333' },
  distance: { fontSize: 12, color: '#888', marginTop: 4 },
});

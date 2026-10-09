import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Truck, MapPin } from 'lucide-react-native';
import type { TrackingMapViewProps } from './TrackingMapView';

// Variante web: estado en texto en vez del mapa de tracking en vivo
// (react-native-maps no tiene mapa real en navegador).
export default function TrackingMapView({ providerLoc, deliveryLoc }: TrackingMapViewProps) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Truck size={20} color="#333" />
        <Text style={styles.label}>Proveedor: {providerLoc ? `${providerLoc.lat.toFixed(4)}, ${providerLoc.lng.toFixed(4)}` : 'ubicación no disponible todavía'}</Text>
      </View>
      <View style={styles.row}>
        <MapPin size={20} color="#F37820" />
        <Text style={styles.label}>Entrega: {deliveryLoc ? `${deliveryLoc.lat.toFixed(4)}, ${deliveryLoc.lng.toFixed(4)}` : 'dirección no disponible'}</Text>
      </View>
      <Text style={styles.hint}>El mapa de tracking en vivo está disponible en la app móvil de Pal Jale.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  label: { marginLeft: 10, fontSize: 14, color: '#333', fontWeight: '600' },
  hint: { fontSize: 12, color: '#888', marginTop: 10 },
});

import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { NearbyMapViewProps } from './NearbyMapView';

// Variante web: lista de productos ordenada por cercanía en vez de mapa
// (react-native-maps no tiene mapa real en navegador).
export default function NearbyMapView({ products, onProductPress }: NearbyMapViewProps) {
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={products}
      keyExtractor={(p) => p.id}
      ListEmptyComponent={<Text style={styles.emptyText}>No hay equipos cerca en este radio.</Text>}
      renderItem={({ item: p }) => (
        <TouchableOpacity style={styles.card} onPress={() => onProductPress(p.id)}>
          {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.cardImage} /> : <View style={[styles.cardImage, styles.cardImagePlaceholder]}><MapPin size={20} color="#bbb" /></View>}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
            <Text style={styles.cardMeta}>${p.price_mxn?.toLocaleString()} MXN{p.distance_km != null ? ` • ${p.distance_km.toFixed(1)} km` : ''}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10, alignItems: 'center' },
  cardImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eee' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardMeta: { fontSize: 13, color: '#666', marginTop: 4 },
});

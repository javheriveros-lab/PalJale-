import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyProducts } from '../../src/api/products';
import { useRouter } from 'expo-router';
import { SlidersHorizontal, Navigation } from 'lucide-react-native';
import NearbyMapView from '../../src/components/NearbyMapView';

const THEME_ORANGE = '#F37820';

export default function MapScreen() {
  const router = useRouter();
  const [region, setRegion] = useState({ latitude: 19.4326, longitude: -99.1332, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
  const [radius, setRadius] = useState(10);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = ['maquinaria', 'herramientas', 'materiales', 'personal'];

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Activa la ubicación'); return; }
    const loc = await Location.getCurrentPositionAsync({});
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
    setRegion(coords); loadProducts(coords.latitude, coords.longitude);
  };

  const loadProducts = useCallback(async (lat: number, lng: number) => {
    try { setLoading(true); const res = await getNearbyProducts({ lat, lng, max_km: radius, category: selectedCategory || undefined, limit: 50 }); setProducts(res.items || []); }
    catch (err: any) { Alert.alert('Error', err.message); } finally { setLoading(false); }
  }, [radius, selectedCategory]);

  useEffect(() => { loadProducts(region.latitude, region.longitude); }, [loadProducts]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipos cercanos</Text>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.locBtn}><Navigation size={20} color="#fff" /></TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.filterChip, !selectedCategory && styles.filterActive]} onPress={() => setSelectedCategory(null)}><Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>Todos</Text></TouchableOpacity>
        {categories.map((c) => <TouchableOpacity key={c} style={[styles.filterChip, selectedCategory === c && styles.filterActive]} onPress={() => setSelectedCategory(c)}><Text style={[styles.filterText, selectedCategory === c && styles.filterTextActive]}>{c}</Text></TouchableOpacity>)}
      </ScrollView>
      <View style={styles.radiusRow}>
        <SlidersHorizontal size={16} color="#666" /><Text style={styles.radiusLabel}>Radio: {radius} km</Text>
        {[5, 10, 20, 50].map((r) => <TouchableOpacity key={r} style={[styles.radiusChip, radius === r && styles.radiusActive]} onPress={() => setRadius(r)}><Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>{r} km</Text></TouchableOpacity>)}
      </View>
      <NearbyMapView
        region={region}
        radius={radius}
        products={products}
        onRegionChangeComplete={setRegion}
        onProductPress={(id) => router.push(`/product/${id}`)}
      />
      {loading && <View style={styles.overlayLoading}><ActivityIndicator color={THEME_ORANGE} /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  locBtn: { backgroundColor: THEME_ORANGE, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterBar: { maxHeight: 50, backgroundColor: '#fff', paddingVertical: 6 },
  filterContent: { paddingHorizontal: 12 },
  filterChip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  filterActive: { backgroundColor: THEME_ORANGE },
  filterText: { fontSize: 12, fontWeight: '600', color: '#555', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  radiusRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  radiusLabel: { fontSize: 13, color: '#666', marginLeft: 6, marginRight: 10 },
  radiusChip: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  radiusActive: { backgroundColor: '#333' },
  radiusText: { fontSize: 11, color: '#555', fontWeight: '600' },
  radiusTextActive: { color: '#fff' },
  overlayLoading: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
});

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Product, Category, TransactionType } from '../../src/types/models';
import { Search, SlidersHorizontal } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';
const CATEGORIES: Category[] = ['maquinaria', 'herramientas', 'materiales', 'personal'];
const TRANSACTIONS: TransactionType[] = ['venta', 'renta'];

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (q) qs.append('q', q);
      if (category) qs.append('category', category);
      if (transactionType) qs.append('transaction_type', transactionType);
      const res = await apiClient(`/api/products?${qs.toString()}`);
      setProducts(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar productos');
    } finally {
      setLoading(false);
    }
  }, [q, category, transactionType]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function renderItem({ item }: { item: Product }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
        <Image source={{ uri: item.image_url }} style={styles.image} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardType}>{item.transaction_type} • {item.category}</Text>
          <Text style={styles.cardPrice}>${item.price_mxn.toLocaleString()} MXN</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catálogo</Text>
      </View>
      <View style={styles.searchBox}>
        <Search size={18} color="#999" />
        <TextInput style={styles.searchInput} placeholder="Buscar equipos..." value={q} onChangeText={setQ} />
      </View>
      <View style={styles.filterRow}>
        <SlidersHorizontal size={16} color="#666" />
        <TouchableOpacity style={[styles.filterChip, !category && styles.filterActive]} onPress={() => setCategory(null)}><Text style={[styles.filterText, !category && styles.filterTextActive]}>Todas</Text></TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.filterChip, category === c && styles.filterActive]} onPress={() => setCategory(c)}>
            <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.typeRow}>
        {TRANSACTIONS.map((t) => (
          <TouchableOpacity key={t} style={[styles.typeChip, transactionType === t && styles.typeActive]} onPress={() => setTransactionType(transactionType === t ? null : t)}>
            <Text style={[styles.typeText, transactionType === t && styles.typeTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={THEME_ORANGE} /> : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No se encontraron productos</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e0e0e0' },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, marginHorizontal: 16, borderRadius: 12 },
  filterChip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  filterActive: { backgroundColor: THEME_ORANGE },
  filterText: { fontSize: 12, fontWeight: '600', color: '#555', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  typeRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8 },
  typeChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8 },
  typeActive: { backgroundColor: '#333', borderColor: '#333' },
  typeText: { fontSize: 12, fontWeight: '600', color: '#555', textTransform: 'capitalize' },
  typeTextActive: { color: '#fff' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  image: { width: 100, height: 100, backgroundColor: '#e0e0e0' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardType: { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'capitalize' },
  cardPrice: { fontSize: 15, fontWeight: '700', color: THEME_ORANGE, marginTop: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});

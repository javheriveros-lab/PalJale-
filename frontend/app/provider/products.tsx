import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Product } from '../../src/types/models';
import { ArrowLeft, Trash2, Plus, Pencil } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function ProviderProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient('/api/my/products');
      setProducts(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function handleDelete(id: string) {
    Alert.alert('Eliminar producto', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient(`/api/products/${id}`, { method: 'DELETE' });
            setProducts((prev) => prev.filter((p) => p.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }

  function renderItem({ item }: { item: Product }) {
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.image_url }} style={styles.image} />
        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.category} • {item.transaction_type}</Text>
          <Text style={styles.price}>${item.price_mxn.toLocaleString()} MXN</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/provider/edit/${item.id}`)}>
            <Pencil size={20} color={THEME_ORANGE} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Mis productos</Text>
        <TouchableOpacity onPress={() => router.push('/provider/new')} style={styles.backBtn}><Plus size={24} color={THEME_ORANGE} /></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={THEME_ORANGE} style={styles.loader} /> : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadProducts}
          ListEmptyComponent={<Text style={styles.empty}>No tienes productos</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  image: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#e0e0e0' },
  body: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  meta: { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'capitalize' },
  price: { fontSize: 14, fontWeight: '700', color: THEME_ORANGE, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 10, marginLeft: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});

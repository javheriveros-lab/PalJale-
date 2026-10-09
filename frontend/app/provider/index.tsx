import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Product, Order } from '../../src/types/models';
import { Plus, Package, ClipboardList, ChevronRight, Crown, Wallet } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function ProviderPanelScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pRes, oRes] = await Promise.all([
        apiClient('/api/my/products'),
        apiClient('/api/my/orders/provider'),
      ]);
      setProducts(Array.isArray(pRes) ? pRes : pRes.items || []);
      setOrders(Array.isArray(oRes) ? oRes : oRes.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Panel proveedor</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/provider/new')}>
            <Plus size={22} color="#fff" /><Text style={styles.actionText}>Nuevo producto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => router.push('/provider/products')}>
            <Package size={22} color="#fff" /><Text style={styles.actionText}>Mis productos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => router.push('/provider/orders')}>
            <ClipboardList size={22} color="#fff" /><Text style={styles.actionText}>Órdenes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionPro]} onPress={() => router.push('/provider/subscription')}>
            <Crown size={22} color="#1a1a1a" /><Text style={[styles.actionText, styles.actionTextPro]}>Suscripción Pro</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={() => router.push('/provider/connect')}>
            <Wallet size={22} color="#fff" /><Text style={styles.actionText}>Cuenta de pagos</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis productos</Text>
          <TouchableOpacity onPress={() => router.push('/provider/products')}><ChevronRight size={20} color="#999" /></TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={THEME_ORANGE} style={styles.loader} /> : (
          products.length === 0 ? <Text style={styles.empty}>No tienes productos publicados</Text> : (
            <FlatList
              data={products.slice(0, 5)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.productCard}>
                  <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.productPrice}>${item.price_mxn.toLocaleString()}</Text>
                </View>
              )}
            />
          )
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Órdenes recibidas</Text>
          <TouchableOpacity onPress={() => router.push('/provider/orders')}><ChevronRight size={20} color="#999" /></TouchableOpacity>
        </View>
        {loading ? null : (
          orders.length === 0 ? <Text style={styles.empty}>Sin órdenes recibidas</Text> : (
            orders.slice(0, 5).map((o) => (
              <TouchableOpacity key={o.id} style={styles.orderRow} onPress={() => router.push(`/provider/orders`)}>
                <View>
                  <Text style={styles.orderTitle}>{o.product_title}</Text>
                  <Text style={styles.orderMeta}>#{String(o.id).slice(-6)} • {o.status}</Text>
                </View>
                <Text style={styles.orderPrice}>${o.total_mxn.toLocaleString()}</Text>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME_ORANGE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  actionSecondary: { backgroundColor: '#333' },
  actionPro: { backgroundColor: '#FFD700' },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  actionTextPro: { color: '#1a1a1a' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  loader: { marginVertical: 20 },
  empty: { color: '#888', marginBottom: 20 },
  productCard: { width: 140, backgroundColor: '#fff', borderRadius: 12, padding: 10, marginRight: 12 },
  productImage: { width: 120, height: 100, borderRadius: 10, backgroundColor: '#e0e0e0' },
  productTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 8 },
  productPrice: { fontSize: 13, color: THEME_ORANGE, marginTop: 4 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  orderTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  orderMeta: { fontSize: 12, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  orderPrice: { fontSize: 14, fontWeight: '700', color: THEME_ORANGE },
});

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { useAuth } from '../../src/contexts/AuthContext';
import { Order } from '../../src/types/models';
import { Package, Store, MessageCircle, CreditCard, RefreshCw } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient('/api/orders/me');
      setOrders(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar órdenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) loadOrders(); }, [loadOrders, user]);

  const isProviderLike = user?.role === 'proveedor' || user?.role === 'profesional';

  async function handlePay(orderId: string) {
    try {
      const checkout = await apiClient('/api/payments/checkout-session', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId }),
      });
      if (checkout.url) router.push(checkout.url as any);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar el pago');
    }
  }

  function renderItem({ item }: { item: Order }) {
    const canPay = item.payment_status === 'unpaid' || item.payment_status === 'pending';
    const isDelivered = item.status === 'entregada' || item.status === 'devuelta';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Package size={20} color={THEME_ORANGE} />
          <Text style={styles.orderId}>#{String(item.id).slice(-6)}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.productTitle}>{item.product_title}</Text>
        <Text style={styles.detail}>Total: ${item.total_mxn.toLocaleString()} MXN</Text>
        <Text style={styles.detail}>Tipo: {item.transaction_type} • Entrega: {item.delivery_method}</Text>
        {item.start_date && item.end_date && (
          <Text style={styles.detail}>Fechas: {item.start_date} → {item.end_date}</Text>
        )}


        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.chatBtn} onPress={() => router.push(`/chat/${item.id}`)}>
            <MessageCircle size={18} color="#fff" />
            <Text style={styles.chatText}>Chat</Text>
          </TouchableOpacity>

          {canPay && (
            <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(item.id)}>
              <CreditCard size={18} color="#fff" />
              <Text style={styles.payText}>Pagar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.trackBtn} onPress={() => router.push(`/dropoff/${item.id}`)}>
            <RefreshCw size={18} color="#333" />
            <Text style={styles.trackText}>Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Inicia sesión para ver tus órdenes</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.btnText}>Ir a login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis órdenes</Text>
        {isProviderLike && (
          <TouchableOpacity style={styles.providerBtn} onPress={() => router.push('/provider')}>
            <Store size={18} color="#fff" /><Text style={styles.providerBtnText}>Proveedor</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading && orders.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={THEME_ORANGE} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadOrders}
          ListEmptyComponent={<Text style={styles.empty}>Aún no tienes órdenes</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function statusColor(status: Order['status']) {
  switch (status) {
    case 'entregada':
    case 'devuelta': return '#22c55e';
    case 'cancelada':
    case 'rechazada': return '#ef4444';
    case 'en_transito': return '#3b82f6';
    case 'aceptada': return '#f59e0b';
    default: return '#9ca3af';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  providerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  providerBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginLeft: 8, flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  detail: { fontSize: 13, color: '#666', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 14 },
  payment: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
  paymentPending: { color: THEME_ORANGE, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 10, paddingVertical: 12 },
  chatText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_ORANGE, borderRadius: 10, paddingVertical: 12 },
  payText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  trackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, paddingVertical: 12 },
  trackText: { color: '#333', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { color: '#666', fontSize: 15, marginBottom: 16 },
  btn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700' },
});

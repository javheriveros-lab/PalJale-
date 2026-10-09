import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Order, OrderStatus } from '../../src/types/models';
import { ArrowLeft, ClipboardList, Truck, DollarSign } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  creada: ['aceptada', 'rechazada', 'cancelada'],
  aceptada: ['pickup_listo', 'cancelada'],
  pickup_listo: ['en_transito'],
  en_transito: ['entregada'],
  entregada: ['devuelta'],
  devuelta: [],
  rechazada: [],
  cancelada: [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  creada: 'Creada',
  aceptada: 'Aceptar',
  rechazada: 'Rechazar',
  pickup_listo: 'Listo para pickup',
  en_transito: 'En tránsito',
  entregada: 'Entregada',
  devuelta: 'Devuelta',
  cancelada: 'Cancelar',
};

export default function ProviderOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient('/api/my/orders/provider');
      setOrders(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar órdenes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function updateStatus(id: string, status: OrderStatus) {
    try {
      await apiClient(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function releaseFunds(id: string) {
    try {
      const res = await apiClient(`/api/payments/orders/${id}/release-funds`, { method: 'POST' });
      Alert.alert('Éxito', res.message || 'Fondos liberados');
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, provider_payout_status: 'transferred' } : o)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron liberar los fondos');
    }
  }

  function confirmStatusChange(id: string, status: OrderStatus) {
    const label = STATUS_LABELS[status];
    Alert.alert(
      'Cambiar estado',
      `¿Marcar esta orden como "${label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => updateStatus(id, status) },
      ]
    );
  }

  function renderItem({ item }: { item: Order }) {
    const validNext = STATUS_FLOW[item.status] || [];
    const canRelease = item.status === 'devuelta' && !item.return_checklist?.report_damage && item.provider_payout_status !== 'transferred';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ClipboardList size={20} color={THEME_ORANGE} />
          <Text style={styles.orderId}>#{String(item.id).slice(-6)}</Text>
          <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.productTitle}>{item.product_title}</Text>
        <Text style={styles.detail}>Total: ${item.total_mxn.toLocaleString()} MXN</Text>
        <Text style={styles.detail}>Tipo: {item.transaction_type} • Entrega: {item.delivery_method}</Text>
        {item.start_date && item.end_date && (
          <Text style={styles.detail}>Fechas: {item.start_date} → {item.end_date}</Text>
        )}

        {validNext.length > 0 && (
          <View style={styles.statusRow}>
            {validNext.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.statusChip}
                onPress={() => confirmStatusChange(item.id, s)}
              >
                <Text style={styles.statusText}>{STATUS_LABELS[s]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.checkBtn} onPress={() => router.push(`/provider/checklist/${item.id}`)}>
          <Truck size={18} color="#fff" />
          <Text style={styles.checkText}>Checklist entrega / devolución</Text>
        </TouchableOpacity>

        {canRelease && (
          <TouchableOpacity style={styles.releaseBtn} onPress={() => releaseFunds(item.id)}>
            <DollarSign size={18} color="#fff" />
            <Text style={styles.releaseText}>Liberar fondos</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Órdenes recibidas</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && orders.length === 0 ? <ActivityIndicator color={THEME_ORANGE} style={styles.loader} /> : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={loadOrders}
          ListEmptyComponent={<Text style={styles.empty}>Sin órdenes recibidas</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'aceptada':
    case 'entregada':
    case 'devuelta': return '#16a34a';
    case 'rechazada':
    case 'cancelada': return '#ef4444';
    case 'en_transito': return '#2563eb';
    default: return '#f59e0b';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginLeft: 8, flex: 1 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700', textTransform: 'capitalize' },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  detail: { fontSize: 13, color: '#666', marginBottom: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statusChip: { backgroundColor: THEME_ORANGE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  statusText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  checkBtn: { marginTop: 14, backgroundColor: '#333', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 },
  releaseBtn: { marginTop: 10, backgroundColor: '#16a34a', borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  releaseText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});

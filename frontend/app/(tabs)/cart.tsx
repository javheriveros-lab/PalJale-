import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { getCart, removeCartItem, updateCartItem, checkoutCart, CartItem } from '../../src/api/cart';
import { ArrowLeft, Trash2, ShoppingCart, CreditCard, Calendar } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function CartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ payment?: string }>();
  const [cart, setCart] = useState<{ items: CartItem[]; total_mxn: number; platform_fee_mxn: number; grand_total_mxn: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadCart = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCart();
      setCart(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el carrito');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCart(); }, [loadCart]);

  useEffect(() => {
    if (params.payment === 'success') {
      Alert.alert('¡Pago exitoso!', 'Tu pago se procesó correctamente. Revisa tus órdenes.');
      router.replace('/(tabs)/orders');
    } else if (params.payment === 'canceled') {
      Alert.alert('Pago cancelado', 'Tus órdenes se crearon pero siguen pendientes de pago.');
      router.replace('/(tabs)/orders');
    }
  }, [params.payment, router]);

  async function handleRemove(itemId: string) {
    try {
      await removeCartItem(itemId);
      loadCart();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function updateQuantity(item: CartItem, delta: number) {
    const newQty = Math.max(1, item.quantity + delta);
    try {
      await updateCartItem(item.id, { quantity: newQty });
      loadCart();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function updateDates(item: CartItem, startDate: string, endDate: string) {
    if (!startDate || !endDate) return;
    try {
      await updateCartItem(item.id, { start_date: startDate, end_date: endDate });
      loadCart();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleCheckout() {
    if (!cart?.items.length) return;
    try {
      setCheckingOut(true);
      const result = await checkoutCart();
      await WebBrowser.openBrowserAsync(result.checkout_url);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo completar el checkout');
    } finally {
      setCheckingOut(false);
    }
  }

  function renderItem({ item }: { item: CartItem }) {
    const [startDate, setStartDate] = useState(item.start_date || '');
    const [endDate, setEndDate] = useState(item.end_date || '');

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: item.image_url }} style={styles.image} />
          <View style={styles.body}>
            <Text style={styles.title}>{item.product_title}</Text>
            <Text style={styles.meta}>{item.transaction_type} • ${item.price_mxn.toLocaleString()}/día</Text>
            <Text style={styles.subtotal}>Subtotal: ${item.subtotal_mxn.toLocaleString()} MXN</Text>
            {item.deposit_mxn > 0 && <Text style={styles.deposit}>Depósito: ${item.deposit_mxn.toLocaleString()} MXN</Text>}
          </View>
          <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.deleteBtn}>
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.quantityRow}>
          <Text style={styles.label}>Cantidad:</Text>
          <View style={styles.qtyControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.transaction_type === 'renta' && (
          <View style={styles.datesRow}>
            <Calendar size={18} color={THEME_ORANGE} />
            <View style={styles.dateInputs}>
              <TextInput
                style={styles.dateInput}
                placeholder="Inicio YYYY-MM-DD"
                value={startDate}
                onChangeText={setStartDate}
                onBlur={() => updateDates(item, startDate, endDate)}
              />
              <Text style={styles.dateArrow}>→</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="Fin YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
                onBlur={() => updateDates(item, startDate, endDate)}
              />
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Carrito</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !cart ? (
        <ActivityIndicator color={THEME_ORANGE} style={styles.loader} />
      ) : !cart?.items.length ? (
        <View style={styles.emptyContainer}>
          <ShoppingCart size={48} color="#ccc" />
          <Text style={styles.emptyText}>Tu carrito está vacío</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.browseBtnText}>Explorar catálogo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshing={loading}
            onRefresh={loadCart}
          />
          <View style={styles.footer}>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${cart.total_mxn.toLocaleString()} MXN</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Comisión plataforma (5%)</Text>
                <Text style={styles.totalValue}>${cart.platform_fee_mxn.toLocaleString()} MXN</Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total estimado</Text>
                <Text style={styles.grandTotalValue}>${cart.grand_total_mxn.toLocaleString()} MXN</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.checkoutBtn, checkingOut && styles.checkoutBtnDisabled]} onPress={handleCheckout} disabled={checkingOut}>
              {checkingOut ? <ActivityIndicator color="#fff" /> : <><CreditCard size={20} color="#fff" /><Text style={styles.checkoutText}> Crear órdenes y pagar</Text></>}
            </TouchableOpacity>
          </View>
        </>
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
  list: { padding: 16, paddingBottom: 20 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 16, marginBottom: 20 },
  browseBtn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  browseBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  image: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#e0e0e0' },
  body: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  meta: { fontSize: 12, color: '#888', marginTop: 4, textTransform: 'capitalize' },
  subtotal: { fontSize: 14, fontWeight: '700', color: THEME_ORANGE, marginTop: 6 },
  deposit: { fontSize: 12, color: '#666', marginTop: 2 },
  deleteBtn: { padding: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  label: { fontSize: 13, color: '#555', fontWeight: '600', flex: 1 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { backgroundColor: '#f0f0f0', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: '#333' },
  qtyText: { fontSize: 16, fontWeight: '700', marginHorizontal: 14, color: '#1a1a1a' },
  datesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  dateInputs: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 10 },
  dateInput: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff' },
  dateArrow: { marginHorizontal: 8, color: '#888' },
  footer: { backgroundColor: '#fff', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  totals: { marginBottom: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel: { fontSize: 14, color: '#555' },
  totalValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  grandTotalRow: { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  grandTotalLabel: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  grandTotalValue: { fontSize: 16, fontWeight: '800', color: THEME_ORANGE },
  checkoutBtn: { backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

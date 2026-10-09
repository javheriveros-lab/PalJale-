import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { calculateDeliveryFee } from '../../src/api/products';
import MapPicker from '../../src/components/MapPicker';
import RouteMap from '../../src/components/RouteMap';
import { Product, User } from '../../src/types/models';
import { CreditCard, MapPin } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try { const [p, me] = await Promise.all([apiClient(`/api/products/${id}`), apiClient('/api/auth/me')]); setProduct(p); setUser(me); }
    catch (err: any) { Alert.alert('Error', err.message); } finally { setLoading(false); }
  }

  async function handleLocationSelect(lat: number, lng: number, address: string) {
    setDeliveryLat(lat); setDeliveryLng(lng); setDeliveryAddress(address);
    if (!product?.lat || !product?.lng) return;
    const R = 6371; const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat - product.lat); const dLng = toRad(lng - product.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(product.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(parseFloat(dist.toFixed(2))); setDeliveryFee(parseFloat((150 + dist * 12).toFixed(2)));
  }

  async function handleOrder() {
    if (!user) return;
    if (user.verification_status !== 'verificado') { Alert.alert('Verificación requerida', 'Completa tu KYC', [{ text: 'Ir a verificar', onPress: () => router.push('/(auth)/verify') }]); return; }
    if (!deliveryLat || !deliveryLng) { Alert.alert('Ubicación requerida', 'Selecciona la ubicación de entrega'); return; }
    try {
      setCreating(true);
      const order = await apiClient('/api/orders', { method: 'POST', body: JSON.stringify({ product_id: id, delivery_method: 'dropoff', delivery_address: deliveryAddress, delivery_lat: deliveryLat, delivery_lng: deliveryLng }) });
      await calculateDeliveryFee(order.id, deliveryLat, deliveryLng);
      const checkout = await apiClient('/api/payments/checkout-session', { method: 'POST', body: JSON.stringify({ order_id: order.id }) });
      if (checkout.url) router.push(checkout.url as any);
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setCreating(false); }
  }

  if (loading || !product) return <View style={styles.center}><ActivityIndicator size="large" color={THEME_ORANGE} /></View>;
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: product.image_url }} style={styles.image} />
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.price}>${product.price_mxn.toLocaleString()} MXN</Text>
        <Text style={styles.desc}>{product.description}</Text>
        {product.lat && product.lng && <RouteMap providerLat={product.lat} providerLng={product.lng} deliveryLat={deliveryLat || product.lat} deliveryLng={deliveryLng || product.lng} />}
        <Text style={styles.sectionTitle}>Ubicación de tu obra / entrega</Text>
        <MapPicker onLocationSelect={handleLocationSelect} initialLat={deliveryLat || undefined} initialLng={deliveryLng || undefined} />
        {deliveryAddress ? <Text style={styles.address}>{deliveryAddress}</Text> : null}
        {distance > 0 ? <View style={styles.feeCard}><MapPin size={18} color={THEME_ORANGE} /><View style={{ marginLeft: 10, flex: 1 }}><Text style={styles.feeLabel}>Flete estimado</Text><Text style={styles.feeValue}>${deliveryFee.toLocaleString()} MXN ({distance} km)</Text></View></View> : null}
        <TouchableOpacity style={[styles.orderBtn, creating && styles.orderBtnDisabled]} onPress={handleOrder} disabled={creating}>
          {creating ? <ActivityIndicator color="#fff" /> : <><CreditCard size={18} color="#fff" /><Text style={styles.orderText}> Solicitar y pagar</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  image: { width: '100%', height: 240, backgroundColor: '#e0e0e0' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', margin: 16, marginBottom: 4 },
  price: { fontSize: 20, fontWeight: '700', color: THEME_ORANGE, marginHorizontal: 16 },
  desc: { fontSize: 14, color: '#555', marginHorizontal: 16, marginTop: 12, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  address: { fontSize: 13, color: '#555', marginHorizontal: 16, marginTop: 8 },
  feeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: THEME_ORANGE },
  feeLabel: { fontSize: 12, color: '#888' },
  feeValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 2 },
  orderBtn: { marginHorizontal: 16, marginTop: 24, backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  orderBtnDisabled: { opacity: 0.6 },
  orderText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

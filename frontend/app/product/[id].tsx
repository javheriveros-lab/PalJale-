import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import { calculateDeliveryFee } from '../../src/api/products';
import MapPicker from '../../src/components/MapPicker';
import RouteMap from '../../src/components/RouteMap';
import Button from '../../src/components/ui/Button';
import { Product, User } from '../../src/types/models';
import { Star, Truck, ShieldCheck } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../../src/theme';

const IS_WEB = Platform.OS === 'web';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    try {
      const p = await apiClient(`/api/products/${id}`);
      setProduct(p);
    } catch (err: any) {
      notify('Error', err.message || 'No se pudo cargar el producto');
      console.error('Error al cargar producto:', err);
    } finally {
      setLoading(false);
    }
    // El visitante puede no tener sesión — eso es válido (puede ver el
    // producto sin cuenta), así que esta llamada va separada y su error
    // (401) se ignora en silencio en vez de bloquear la página completa.
    try {
      const me = await apiClient('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    }
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
    if (!product) return;
    setError('');
    if (!user) {
      notify('Inicia sesión', 'Crea una cuenta o inicia sesión para solicitar este producto.');
      router.push('/(auth)/login');
      return;
    }
    if (user.verification_status !== 'verificado') {
      notify('Verificación requerida', 'Completa tu verificación de identidad antes de solicitar.');
      router.push('/(auth)/verify');
      return;
    }
    if (!deliveryLat || !deliveryLng) {
      setError('Selecciona la ubicación de entrega en el mapa antes de continuar.');
      notify('Ubicación requerida', 'Selecciona la ubicación de entrega en el mapa.');
      return;
    }
    try {
      setCreating(true);
      const order = await apiClient('/api/orders', { method: 'POST', body: JSON.stringify({ product_id: id, delivery_method: 'dropoff', delivery_address: deliveryAddress, delivery_lat: deliveryLat, delivery_lng: deliveryLng }) });
      await calculateDeliveryFee(order.id, deliveryLat, deliveryLng);
      const checkout = await apiClient('/api/payments/checkout-session', { method: 'POST', body: JSON.stringify({ order_id: order.id }) });
      if (checkout.url) router.push(checkout.url as any);
    } catch (err: any) {
      const msg = err.message || 'No se pudo crear la solicitud';
      setError(msg);
      notify('Error', msg);
      console.error('Error al crear orden:', err);
    } finally {
      setCreating(false);
    }
  }

  if (loading || !product) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const media = (
    <View style={styles.mediaCol}>
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <Text style={styles.desc}>{product.description}</Text>
      {product.lat && product.lng && (
        <RouteMap providerLat={product.lat} providerLng={product.lng} deliveryLat={deliveryLat || product.lat} deliveryLng={deliveryLng || product.lng} />
      )}
      <Text style={styles.sectionTitle}>Ubicación de tu obra / entrega</Text>
      <MapPicker onLocationSelect={handleLocationSelect} initialLat={deliveryLat || undefined} initialLng={deliveryLng || undefined} />
      {deliveryAddress ? <Text style={styles.address}>{deliveryAddress}</Text> : null}
    </View>
  );

  const buyBox = (
    <View style={styles.buyBox}>
      <View style={styles.badgeRow}>
        <View style={styles.typePill}><Text style={styles.typePillText}>{product.transaction_type}</Text></View>
        <Text style={styles.category}>{product.category}</Text>
      </View>
      <Text style={styles.title}>{product.title}</Text>
      {product.rating > 0 && (
        <View style={styles.ratingRow}>
          <Star size={15} color={colors.warning} fill={colors.warning} />
          <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
        </View>
      )}
      <Text style={styles.price}>${product.price_mxn.toLocaleString()} MXN</Text>
      {!!product.deposit_mxn && (
        <View style={styles.infoRow}>
          <ShieldCheck size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>Incluye depósito reembolsable de ${product.deposit_mxn.toLocaleString()} MXN</Text>
        </View>
      )}
      {distance > 0 && (
        <View style={styles.infoRow}>
          <Truck size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>Flete estimado ${deliveryFee.toLocaleString()} MXN ({distance} km)</Text>
        </View>
      )}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <Button title="Solicitar y pagar" onPress={handleOrder} loading={creating} style={styles.orderBtn} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {IS_WEB ? (
          <View style={styles.webLayout}>
            {media}
            {buyBox}
          </View>
        ) : (
          <>
            {buyBox}
            {media}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxxl * 2 },
  webLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xxl,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
    padding: spacing.xxl,
  },
  mediaCol: { flex: 1.4, minWidth: 0 },
  image: { width: '100%', height: 320, borderRadius: radii.lg, backgroundColor: colors.cardMuted },
  imagePlaceholder: {},
  desc: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.lg, lineHeight: 21 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.xl, marginBottom: spacing.sm },
  address: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  buyBox: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: '100%',
    maxWidth: IS_WEB ? 320 : undefined,
    marginHorizontal: IS_WEB ? 0 : spacing.lg,
    marginTop: IS_WEB ? 0 : spacing.lg,
    ...shadows.sm,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  typePill: { backgroundColor: colors.primarySoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.sm },
  typePillText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.3 },
  category: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
  title: { fontSize: 19, fontWeight: '800', color: colors.textPrimary, lineHeight: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  ratingText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  price: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  infoText: { fontSize: 13, color: colors.textMuted, flex: 1, lineHeight: 18 },
  errorText: { fontSize: 13, color: colors.danger, backgroundColor: colors.dangerBg, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.lg },
  orderBtn: { marginTop: spacing.xl },
});

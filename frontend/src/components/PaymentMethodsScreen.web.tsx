import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listPaymentMethods, deletePaymentMethod, PaymentMethodCard } from '../api/payment-methods';
import { CreditCard, Trash2, ArrowLeft, Smartphone } from 'lucide-react-native';

// Versión web: no importa @stripe/stripe-react-native (sin soporte web).
// Puede listar/eliminar tarjetas ya guardadas (son llamadas REST normales),
// pero agregar una tarjeta nueva requiere el formulario nativo, así que esa
// acción se hace desde la app móvil por ahora.

const THEME_ORANGE = '#F37820';

export default function PaymentMethodsWebScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PaymentMethodCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listPaymentMethods();
      setItems(res.items);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar tus tarjetas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMethods(); }, [loadMethods]);

  function handleDelete(pm: PaymentMethodCard) {
    Alert.alert(
      'Eliminar tarjeta',
      `¿Eliminar la tarjeta ${pm.brand.toUpperCase()} terminación ${pm.last4}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(pm.id);
              await deletePaymentMethod(pm.id);
              setItems((prev) => prev.filter((i) => i.id !== pm.id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo eliminar la tarjeta');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#333" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Métodos de pago</Text>
        <Text style={styles.subtitle}>Administra las tarjetas guardadas para pagos con un toque.</Text>

        {loading ? (
          <ActivityIndicator color={THEME_ORANGE} style={styles.loader} />
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tus tarjetas</Text>
            {items.length === 0 && <Text style={styles.emptyText}>Todavía no tienes tarjetas guardadas.</Text>}
            {items.map((pm) => (
              <View key={pm.id} style={styles.cardRow}>
                <CreditCard size={22} color={THEME_ORANGE} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardBrand}>{pm.brand.toUpperCase()} •••• {pm.last4}</Text>
                  <Text style={styles.cardExp}>Vence {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}</Text>
                </View>
                {pm.is_default && <Text style={styles.defaultBadge}>Predeterminada</Text>}
                <TouchableOpacity onPress={() => handleDelete(pm)} disabled={deletingId === pm.id}>
                  {deletingId === pm.id ? <ActivityIndicator color="#ef4444" /> : <Trash2 size={20} color="#ef4444" />}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.noticeCard}>
          <Smartphone size={22} color={THEME_ORANGE} />
          <Text style={styles.noticeText}>
            Para agregar una tarjeta nueva, usa la app móvil de Pal Jale — el formulario seguro de
            tarjeta todavía no está disponible en la versión web. Para pagar una orden desde aquí,
            usa el botón de pago del carrito, que te lleva a una página segura de Stripe.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 520, width: '100%', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { marginLeft: 6, color: '#333', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 20 },
  loader: { marginVertical: 40 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14, color: '#1a1a1a' },
  emptyText: { color: '#888', fontSize: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardBrand: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardExp: { fontSize: 12, color: '#888', marginTop: 2 },
  defaultBadge: { fontSize: 11, color: THEME_ORANGE, fontWeight: '700', marginRight: 12 },
  noticeCard: { flexDirection: 'row', backgroundColor: '#fff7ed', borderRadius: 16, padding: 18, alignItems: 'flex-start' },
  noticeText: { flex: 1, marginLeft: 12, fontSize: 13, color: '#9a5b1f', lineHeight: 19 },
});

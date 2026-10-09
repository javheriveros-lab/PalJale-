import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import {
  createSetupIntent,
  listPaymentMethods,
  deletePaymentMethod,
  PaymentMethodCard,
} from '../api/payment-methods';
import { CreditCard, Trash2, ArrowLeft, PlusCircle } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { confirmSetupIntent } = useStripe();
  const [items, setItems] = useState<PaymentMethodCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  const [adding, setAdding] = useState(false);
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

  async function handleAddCard() {
    if (!cardComplete) {
      Alert.alert('Datos incompletos', 'Completa los datos de la tarjeta');
      return;
    }
    try {
      setAdding(true);
      const { client_secret } = await createSetupIntent();
      const { error } = await confirmSetupIntent(client_secret, { paymentMethodType: 'Card' });
      if (error) {
        Alert.alert('No se pudo guardar la tarjeta', error.message);
        return;
      }
      Alert.alert('Listo', 'Tu tarjeta se guardó correctamente');
      await loadMethods();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la tarjeta');
    } finally {
      setAdding(false);
    }
  }

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agregar nueva tarjeta</Text>
          <CardField
            postalCodeEnabled={false}
            placeholders={{ number: '4242 4242 4242 4242' }}
            style={styles.cardField}
            onCardChange={(details) => setCardComplete(details.complete)}
          />
          <TouchableOpacity
            style={[styles.actionBtn, (adding || !cardComplete) && styles.disabledBtn]}
            onPress={handleAddCard}
            disabled={adding || !cardComplete}
          >
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <PlusCircle size={20} color="#fff" />
                <Text style={styles.actionText}>Guardar tarjeta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
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
  cardField: { width: '100%', height: 50, marginBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 14 },
  disabledBtn: { opacity: 0.6 },
  actionText: { color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 15 },
});

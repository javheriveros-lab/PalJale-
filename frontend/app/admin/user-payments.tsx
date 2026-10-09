import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserPaymentMethodsSummary, PaymentMethodsSummary } from '../../src/api/payment-methods';
import { ArrowLeft, Search, CreditCard, Eye } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function AdminUserPaymentsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [summary, setSummary] = useState<PaymentMethodsSummary | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (!userId.trim()) {
      Alert.alert('Falta el ID', 'Ingresa el ID de usuario a consultar');
      return;
    }
    try {
      setLoading(true);
      setSummary(null);
      const res = await getUserPaymentMethodsSummary(userId.trim());
      setSummary(res);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo consultar al usuario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#333" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Eye size={22} color={THEME_ORANGE} />
          <Text style={styles.title}>Métodos de pago (solo lectura)</Text>
        </View>
        <Text style={styles.subtitle}>
          Consulta cuántas tarjetas tiene guardadas un usuario para soporte. Nunca se muestran números
          completos ni se puede eliminar tarjetas ajenas desde aquí.
        </Text>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="ID de usuario"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Search size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{summary.count} tarjeta(s) guardada(s)</Text>
            {summary.cards.map((c, idx) => (
              <View key={idx} style={styles.cardRow}>
                <CreditCard size={20} color={THEME_ORANGE} />
                <Text style={styles.cardText}>{c.brand.toUpperCase()} •••• {c.last4}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { marginLeft: 6, color: '#333', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginLeft: 8 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 19 },
  searchRow: { flexDirection: 'row', marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginRight: 10 },
  searchBtn: { backgroundColor: THEME_ORANGE, borderRadius: 12, width: 48, alignItems: 'center', justifyContent: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  cardText: { marginLeft: 10, fontSize: 14, color: '#333', fontWeight: '600' },
});

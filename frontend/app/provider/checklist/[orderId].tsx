import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../../src/api/client';
import S3MultiImagePicker from '../../../src/components/S3MultiImagePicker';
import { ArrowLeft, Save } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

type ChecklistMode = 'delivery' | 'return';

export default function ChecklistScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<ChecklistMode>('delivery');
  const [status, setStatus] = useState('');
  const [mileage, setMileage] = useState('');
  const [notes, setNotes] = useState('');
  const [reportDamage, setReportDamage] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    try {
      setLoading(true);
      await apiClient(`/api/orders/${orderId}/checklist/${mode}`, {
        method: 'POST',
        body: JSON.stringify({
          estado: status || undefined,
          kilometraje: mileage ? parseInt(mileage, 10) : undefined,
          notas: notes,
          report_damage: reportDamage,
          fotos_b64: images,
        }),
      });
      Alert.alert('Éxito', 'Checklist guardado', [{ text: 'OK', onPress: () => router.replace('/provider/orders') }]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el checklist');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.title}>Checklist</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeChip, mode === 'delivery' && styles.modeActive]} onPress={() => setMode('delivery')}>
            <Text style={[styles.modeText, mode === 'delivery' && styles.modeTextActive]}>Entrega</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeChip, mode === 'return' && styles.modeActive]} onPress={() => setMode('return')}>
            <Text style={[styles.modeText, mode === 'return' && styles.modeTextActive]}>Devolución</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Estado / condición</Text>
        <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="Ej. Buen estado, completo" />
        <Text style={styles.label}>Kilometraje</Text>
        <TextInput style={styles.input} value={mileage} onChangeText={setMileage} keyboardType="number-pad" placeholder="0" />
        <Text style={styles.label}>Notas</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Observaciones" multiline />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Reportar daño</Text>
          <Switch value={reportDamage} onValueChange={setReportDamage} trackColor={{ false: '#e0e0e0', true: THEME_ORANGE }} />
        </View>
        <Text style={styles.label}>Fotos</Text>
        <S3MultiImagePicker folder="checklists" images={images} onChange={setImages} max={6} />
        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <><Save size={18} color="#fff" /><Text style={styles.btnText}> Guardar checklist</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeChip: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
  modeActive: { backgroundColor: THEME_ORANGE, borderColor: THEME_ORANGE },
  modeText: { fontWeight: '700', color: '#555' },
  modeTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  btn: { marginTop: 28, backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

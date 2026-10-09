import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../src/api/client';
import S3ImagePicker from '../../src/components/S3ImagePicker';
import { ArrowLeft, Save } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';

export default function NewProductScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('maquinaria');
  const [transactionType, setTransactionType] = useState<'venta' | 'renta'>('renta');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title || !price || !imageUrl) { Alert.alert('Error', 'Completa todos los campos e incluye una imagen'); return; }
    try { setSaving(true); await apiClient('/api/products/', { method: 'POST', body: JSON.stringify({ title, description, category, transaction_type: transactionType, price_mxn: parseFloat(price), image_url: imageUrl }) }); Alert.alert('Éxito', 'Producto publicado', [{ text: 'OK', onPress: () => router.back() }]); }
    catch (err: any) { Alert.alert('Error', err.message); } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity><Text style={styles.title}>Nuevo producto</Text><View style={{ width: 40 }} /></View>
        <Text style={styles.label}>Foto principal</Text><S3ImagePicker folder="products" onUploaded={setImageUrl} />
        <Text style={styles.label}>Título</Text><TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej. Revolvedora 1 bag" />
        <Text style={styles.label}>Descripción</Text><TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Detalles del equipo" multiline />
        <Text style={styles.label}>Categoría</Text><View style={styles.chipRow}>{['maquinaria', 'herramientas', 'materiales', 'personal'].map((c) => <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}><Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}</View>
        <Text style={styles.label}>Tipo de transacción</Text><View style={styles.chipRow}><TouchableOpacity style={[styles.chip, transactionType === 'renta' && styles.chipActive]} onPress={() => setTransactionType('renta')}><Text style={[styles.chipText, transactionType === 'renta' && styles.chipTextActive]}>Renta</Text></TouchableOpacity><TouchableOpacity style={[styles.chip, transactionType === 'venta' && styles.chipActive]} onPress={() => setTransactionType('venta')}><Text style={[styles.chipText, transactionType === 'venta' && styles.chipTextActive]}>Venta</Text></TouchableOpacity></View>
        <Text style={styles.label}>Precio (MXN)</Text><TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}><Save size={18} color="#fff" /><Text style={styles.saveText}> Publicar producto</Text></TouchableOpacity>
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
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: THEME_ORANGE, borderColor: THEME_ORANGE },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff' },
  saveBtn: { marginTop: 28, backgroundColor: THEME_ORANGE, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
});

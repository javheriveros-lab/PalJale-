import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../../src/api/client';
import { useAuth } from '../../../src/contexts/AuthContext';
import S3ImagePicker from '../../../src/components/S3ImagePicker';
import MapPicker from '../../../src/components/MapPicker';
import { ArrowLeft, Save } from 'lucide-react-native';

const THEME_ORANGE = '#F37820';
const CATEGORIES = ['maquinaria', 'herramientas', 'materiales', 'personal'] as const;
const CONDITIONS = ['nuevo', 'usado', 'na'] as const;

export default function EditProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('maquinaria');
  const [transactionType, setTransactionType] = useState<'venta' | 'renta'>('renta');
  const [condition, setCondition] = useState<typeof CONDITIONS[number]>('usado');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [profession, setProfession] = useState('');
  const [experienceYears, setExperienceYears] = useState('');

  const isProviderLike = user?.role === 'proveedor' || user?.role === 'profesional';
  const isRenta = transactionType === 'renta';

  useEffect(() => {
    async function loadProduct() {
      try {
        const product = await apiClient(`/api/products/${id}`);
        setTitle(product.title || '');
        setDescription(product.description || '');
        setCategory(product.category || 'maquinaria');
        setTransactionType(product.transaction_type || 'renta');
        setCondition(product.condition || 'usado');
        setPrice(product.price_mxn ? String(product.price_mxn) : '');
        setDeposit(product.deposit_mxn ? String(product.deposit_mxn) : '');
        setLocationCity(product.location_city || '');
        setLat(product.lat || null);
        setLng(product.lng || null);
        setImageUrl(product.image_url || '');
        setProfession(product.profession || '');
        setExperienceYears(product.experience_years ? String(product.experience_years) : '');
      } catch (err: any) {
        Alert.alert('Error', err.message || 'No se pudo cargar el producto');
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  function handleLocationSelect(selectedLat: number, selectedLng: number, address: string) {
    setLat(selectedLat);
    setLng(selectedLng);
    setLocationCity(address);
  }

  async function handleSave() {
    if (!title || !price || !imageUrl || !lat || !lng) {
      Alert.alert('Error', 'Completa título, precio, imagen y ubicación'); return;
    }
    const body: any = {
      title,
      description,
      category,
      transaction_type: transactionType,
      condition,
      price_mxn: parseFloat(price),
      location_city: locationCity,
      lat,
      lng,
      image_url: imageUrl,
    };
    if (isRenta && deposit) body.deposit_mxn = parseFloat(deposit);
    if (isProviderLike) {
      if (profession) body.profession = profession;
      if (experienceYears) body.experience_years = parseInt(experienceYears, 10);
    }
    try {
      setSaving(true);
      await apiClient(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      Alert.alert('Éxito', 'Producto actualizado', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) { Alert.alert('Error', err.message); } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={THEME_ORANGE} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} color="#333" /></TouchableOpacity>
          <Text style={styles.title}>Editar producto</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.label}>Foto principal</Text>
        <S3ImagePicker folder="products" onUploaded={setImageUrl} existingUrl={imageUrl} />

        <Text style={styles.label}>Título</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej. Revolvedora 1 bag" />

        <Text style={styles.label}>Descripción</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Detalles del equipo" multiline />

        <Text style={styles.label}>Categoría</Text>
        <View style={styles.chipRow}>{CATEGORIES.map((c) => <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}><Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}</View>

        <Text style={styles.label}>Tipo de transacción</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity style={[styles.chip, transactionType === 'renta' && styles.chipActive]} onPress={() => setTransactionType('renta')}><Text style={[styles.chipText, transactionType === 'renta' && styles.chipTextActive]}>Renta</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.chip, transactionType === 'venta' && styles.chipActive]} onPress={() => setTransactionType('venta')}><Text style={[styles.chipText, transactionType === 'venta' && styles.chipTextActive]}>Venta</Text></TouchableOpacity>
        </View>

        <Text style={styles.label}>Condición</Text>
        <View style={styles.chipRow}>{CONDITIONS.map((c) => <TouchableOpacity key={c} style={[styles.chip, condition === c && styles.chipActive]} onPress={() => setCondition(c)}><Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c}</Text></TouchableOpacity>)}</View>

        <Text style={styles.label}>Precio (MXN)</Text>
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />

        {isRenta && <><Text style={styles.label}>Depósito (MXN)</Text><TextInput style={styles.input} value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="0.00" /></>}

        <Text style={styles.label}>Ubicación</Text>
        <MapPicker onLocationSelect={handleLocationSelect} initialLat={lat || undefined} initialLng={lng || undefined} />
        <TextInput style={[styles.input, { marginTop: 12 }]} value={locationCity} onChangeText={setLocationCity} placeholder="Ciudad / dirección" />

        {isProviderLike && (
          <>
            <Text style={styles.label}>Profesión / Especialidad</Text>
            <TextInput style={styles.input} value={profession} onChangeText={setProfession} placeholder="Ej. Albañil" />
            <Text style={styles.label}>Años de experiencia</Text>
            <TextInput style={styles.input} value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" placeholder="0" />
          </>
        )}

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <><Save size={18} color="#fff" /><Text style={styles.saveText}> Guardar cambios</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { justifyContent: 'center', alignItems: 'center' },
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

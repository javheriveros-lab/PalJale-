import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Product, Category, TransactionType } from '../../src/types/models';
import { Search, SlidersHorizontal, Package } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../../src/theme';

const CATEGORIES: Category[] = ['maquinaria', 'herramientas', 'materiales', 'personal'];
const TRANSACTIONS: TransactionType[] = ['venta', 'renta'];
const IS_WEB = Platform.OS === 'web';

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (q) qs.append('q', q);
      if (category) qs.append('category', category);
      if (transactionType) qs.append('transaction_type', transactionType);
      const res = await apiClient(`/api/products?${qs.toString()}`);
      setProducts(Array.isArray(res) ? res : res.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar productos');
    } finally {
      setLoading(false);
    }
  }, [q, category, transactionType]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function renderItem({ item }: { item: Product }) {
    return (
      <TouchableOpacity style={[styles.card, IS_WEB && styles.cardWeb]} onPress={() => router.push(`/product/${item.id}`)}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={[styles.image, IS_WEB && styles.imageWeb]} />
        ) : (
          <View style={[styles.image, IS_WEB && styles.imageWeb, styles.imagePlaceholder]}><Package size={22} color={colors.textPlaceholder} /></View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.cardType}>{item.transaction_type} • {item.category}</Text>
          <Text style={styles.cardPrice}>${item.price_mxn.toLocaleString()} MXN</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!IS_WEB && (
        <View style={styles.header}>
          <Text style={styles.title}>Catálogo</Text>
        </View>
      )}
      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Buscar equipos..." placeholderTextColor={colors.textPlaceholder} value={q} onChangeText={setQ} />
      </View>
      <View style={styles.filterRow}>
        <SlidersHorizontal size={16} color={colors.textMuted} />
        <TouchableOpacity style={[styles.filterChip, !category && styles.filterActive]} onPress={() => setCategory(null)}>
          <Text style={[styles.filterText, !category && styles.filterTextActive]}>Todas</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.filterChip, category === c && styles.filterActive]} onPress={() => setCategory(c)}>
            <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.typeRow}>
        {TRANSACTIONS.map((t) => (
          <TouchableOpacity key={t} style={[styles.typeChip, transactionType === t && styles.typeActive]} onPress={() => setTransactionType(transactionType === t ? null : t)}>
            <Text style={[styles.typeText, transactionType === t && styles.typeTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={IS_WEB ? 3 : 1}
          key={IS_WEB ? 'web-grid' : 'mobile-list'}
          columnWrapperStyle={IS_WEB ? styles.row : undefined}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No se encontraron productos</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.card },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: spacing.md, fontSize: 15, color: colors.textPrimary },
  filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.sm, marginHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  filterChip: { backgroundColor: colors.cardMuted, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginLeft: spacing.sm },
  filterActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  filterTextActive: { color: colors.white },
  typeRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  typeChip: { backgroundColor: colors.card, borderRadius: radii.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  typeActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  typeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'capitalize' },
  typeTextActive: { color: colors.white },
  loader: { marginTop: 40 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  row: { gap: spacing.md },
  card: { flex: 1, flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.md, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  cardWeb: { flexDirection: 'column', ...shadows.sm },
  image: { width: 100, height: 100, backgroundColor: colors.cardMuted },
  imageWeb: { width: '100%', height: 140 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardType: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'capitalize' },
  cardPrice: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: spacing.sm },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});

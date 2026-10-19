import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Image, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../../src/api/client';
import { Product, Category, TransactionType } from '../../src/types/models';
import { Search, SlidersHorizontal, Package, Star } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../../src/theme';

const CATEGORIES: Category[] = ['maquinaria', 'herramientas', 'materiales', 'personal'];
const TRANSACTIONS: TransactionType[] = ['venta', 'renta'];
const IS_WEB = Platform.OS === 'web';
const CARD_MIN_WIDTH = 230;

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);

  const numColumns = IS_WEB ? Math.max(2, Math.min(6, Math.floor(width / CARD_MIN_WIDTH))) : 1;

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
      notify('Error', err.message || 'No se pudieron cargar productos');
      console.error('Error al cargar productos:', err);
    } finally {
      setLoading(false);
    }
  }, [q, category, transactionType]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function renderItem({ item }: { item: Product }) {
    return (
      <Pressable
        onPress={() => router.push(`/product/${item.id}`)}
        style={({ hovered }: any) => [styles.card, IS_WEB && styles.cardWeb, IS_WEB && hovered && styles.cardHovered]}
      >
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={[styles.image, IS_WEB && styles.imageWeb]} />
        ) : (
          <View style={[styles.image, IS_WEB && styles.imageWeb, styles.imagePlaceholder]}><Package size={22} color={colors.textPlaceholder} /></View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardBadgeRow}>
            <View style={styles.typePill}><Text style={styles.typePillText}>{item.transaction_type}</Text></View>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardPrice}>${item.price_mxn.toLocaleString()} MXN</Text>
          {item.rating > 0 && (
            <View style={styles.ratingRow}>
              <Star size={13} color={colors.warning} fill={colors.warning} />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </Pressable>
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
        <Pressable style={({ hovered }: any) => [styles.filterChip, !category && styles.filterActive, IS_WEB && hovered && !!category && styles.filterChipHovered]} onPress={() => setCategory(null)}>
          <Text style={[styles.filterText, !category && styles.filterTextActive]}>Todas</Text>
        </Pressable>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={({ hovered }: any) => [styles.filterChip, category === c && styles.filterActive, IS_WEB && hovered && category !== c && styles.filterChipHovered]} onPress={() => setCategory(c)}>
            <Text style={[styles.filterText, category === c && styles.filterTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.typeRow}>
        {TRANSACTIONS.map((t) => (
          <Pressable key={t} style={({ hovered }: any) => [styles.typeChip, transactionType === t && styles.typeActive, IS_WEB && hovered && transactionType !== t && styles.filterChipHovered]} onPress={() => setTransactionType(transactionType === t ? null : t)}>
            <Text style={[styles.typeText, transactionType === t && styles.typeTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={numColumns}
          key={`grid-${numColumns}`}
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
  filterChipHovered: { backgroundColor: colors.border },
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
  cardWeb: {
    flexDirection: 'column',
    ...shadows.sm,
    transitionProperty: 'transform, box-shadow',
    transitionDuration: '160ms',
    transitionTimingFunction: 'ease-out',
  } as any,
  cardHovered: { transform: [{ translateY: -3 }], borderColor: colors.borderStrong, ...shadows.md },
  image: { width: 100, height: 100, backgroundColor: colors.cardMuted },
  imageWeb: { width: '100%', height: 140 },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  typePill: { backgroundColor: colors.primarySoft, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.sm },
  typePillText: { fontSize: 10, fontWeight: '700', color: colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.3 },
  cardCategory: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 18 },
  cardPrice: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: spacing.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});

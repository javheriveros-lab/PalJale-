import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, MapPin, ClipboardList, User, ShoppingCart } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../theme';
import Logo from './ui/Logo';

const NAV_ITEMS = [
  { href: '/', label: 'Catálogo', icon: Home, match: ['/', '/index'] },
  { href: '/cart', label: 'Carrito', icon: ShoppingCart, match: ['/cart'] },
  { href: '/map', label: 'Mapa', icon: MapPin, match: ['/map'] },
  { href: '/orders', label: 'Órdenes', icon: ClipboardList, match: ['/orders'] },
  { href: '/profile', label: 'Perfil', icon: User, match: ['/profile'] },
] as const;

export default function WebAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.root}>
      <View style={styles.navbar}>
        <View style={styles.navInner}>
          <TouchableOpacity style={styles.brand} onPress={() => router.push('/')}>
            <Logo variant="mark" size={32} />
            <Text style={styles.brandText}>Pal Jale</Text>
          </TouchableOpacity>
          <View style={styles.links}>
            {NAV_ITEMS.map((item) => {
              const active = (item.match as readonly string[]).includes(pathname);
              const Icon = item.icon;
              return (
                <TouchableOpacity key={item.href} style={[styles.link, active && styles.linkActive]} onPress={() => router.push(item.href as any)}>
                  <Icon size={17} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.linkText, active && styles.linkTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  navbar: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadows.sm },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1120,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandText: { marginLeft: spacing.sm, fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md },
  linkActive: { backgroundColor: colors.primarySoft },
  linkText: { marginLeft: spacing.sm, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  linkTextActive: { color: colors.primaryDark },
  content: { flex: 1 },
  contentInner: { maxWidth: 1120, width: '100%', alignSelf: 'center', paddingVertical: spacing.xxl },
});

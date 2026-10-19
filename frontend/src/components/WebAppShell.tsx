import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, MapPin, ClipboardList, User, ShoppingCart, LogIn } from 'lucide-react-native';
import { colors, spacing, radii, shadows } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import Logo from './ui/Logo';

const PUBLIC_NAV_ITEMS = [
  { href: '/', label: 'Catálogo', icon: Home, match: ['/', '/index'] },
  { href: '/map', label: 'Mapa', icon: MapPin, match: ['/map'] },
] as const;

const SESSION_NAV_ITEMS = [
  { href: '/cart', label: 'Carrito', icon: ShoppingCart, match: ['/cart'] },
  { href: '/orders', label: 'Órdenes', icon: ClipboardList, match: ['/orders'] },
  { href: '/profile', label: 'Perfil', icon: User, match: ['/profile'] },
] as const;

export default function WebAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Catálogo y Mapa son navegación pública; Carrito/Órdenes/Perfil solo
  // tienen sentido con sesión, así que a un visitante sin cuenta se le
  // muestra un botón de "Iniciar sesión" en su lugar en vez de enlaces
  // que lo mandarían a login de todos modos.
  const navItems = user ? [...PUBLIC_NAV_ITEMS, ...SESSION_NAV_ITEMS] : PUBLIC_NAV_ITEMS;

  return (
    <View style={styles.root}>
      <View style={styles.navbar}>
        <View style={styles.navInner}>
          <Pressable style={styles.brand} onPress={() => router.push('/')}>
            <Logo variant="mark" size={32} />
            <Text style={styles.brandText}>Pal Jale</Text>
          </Pressable>
          <View style={styles.links}>
            {navItems.map((item) => {
              const active = (item.match as readonly string[]).includes(pathname);
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.href}
                  style={({ hovered }: any) => [styles.link, active && styles.linkActive, hovered && !active && styles.linkHovered]}
                  onPress={() => router.push(item.href as any)}
                >
                  <Icon size={17} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.linkText, active && styles.linkTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
            {!user && (
              <Pressable
                style={({ hovered }: any) => [styles.loginBtn, hovered && styles.loginBtnHovered]}
                onPress={() => router.push('/(auth)/login')}
              >
                <LogIn size={16} color={colors.white} />
                <Text style={styles.loginBtnText}>Iniciar sesión</Text>
              </Pressable>
            )}
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
  linkHovered: { backgroundColor: colors.cardMuted },
  linkText: { marginLeft: spacing.sm, fontSize: 14, fontWeight: '600', color: colors.textMuted },
  linkTextActive: { color: colors.primaryDark },
  loginBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, marginLeft: spacing.sm, ...shadows.sm },
  loginBtnHovered: { backgroundColor: colors.primaryDark },
  loginBtnText: { marginLeft: spacing.sm, fontSize: 14, fontWeight: '700', color: colors.white },
  content: { flex: 1 },
  contentInner: { maxWidth: 1120, width: '100%', alignSelf: 'center', paddingVertical: spacing.xxl },
});

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link, Redirect } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import TextField from '../../src/components/ui/TextField';
import Button from '../../src/components/ui/Button';
import Logo from '../../src/components/ui/Logo';
import { colors, spacing, radii, shadows } from '../../src/theme';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const { user, login } = useAuth();

  if (user?.verification_status === 'verificado') {
    return <Redirect href="/(tabs)" />;
  }
  if (user) {
    return <Redirect href="/(auth)/verify" />;
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      const msg = 'Ingresa email y contraseña';
      setError(msg);
      notify('Error', msg);
      return;
    }
    try {
      setLoading(true);
      await login(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err.message || 'No se pudo iniciar sesión';
      setError(msg);
      notify('Error', msg);
      console.error('Error al iniciar sesión:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Logo variant="mark" size={56} />
        </View>
        <Text style={styles.title}>Pal Jale</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TextField
          label="Email"
          placeholder="correo@ejemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          leftIcon={<Mail size={18} color={colors.textMuted} />}
        />
        <TextField
          label="Contraseña"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          leftIcon={<Lock size={18} color={colors.textMuted} />}
        />

        <Button title="Iniciar sesión" onPress={handleLogin} loading={loading} style={styles.submitBtn} />

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkBtn}>
            <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Regístrate</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xxl, justifyContent: 'center' },
  card: Platform.select({
    web: { maxWidth: 420, width: '100%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.xxxl, borderWidth: 1, borderColor: colors.border, ...shadows.lg },
    default: {},
  }) as object,
  logoBox: { alignSelf: 'center', marginBottom: spacing.lg, backgroundColor: colors.card, borderRadius: radii.xl, padding: spacing.lg, ...shadows.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xxl, marginTop: spacing.xs },
  errorText: { fontSize: 14, color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.lg },
  submitBtn: { marginTop: spacing.sm },
  linkBtn: { marginTop: spacing.xl, alignSelf: 'center' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkBold: { color: colors.primary, fontWeight: '700' },
});

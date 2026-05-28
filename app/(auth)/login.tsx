import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { ArenaLogo, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { isSupabaseConfigured } from '@/lib/supabase';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
}

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(undefined);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      router.replace('/');
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center">
        <View className="mb-10">
          <ArenaLogo />
          <Text
            className="mt-6 text-base font-semibold text-white/65"
            style={{ letterSpacing: 0.3 }}>
            Sign in. Build your slate. Stack profit.
          </Text>
        </View>

        <View>
          <Card>
            <View className="gap-5">
              <View>
                <Text
                  className="text-[11px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 3 }}>
                  Player Login
                </Text>
                <Text
                  className="mt-1 text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Welcome Back
                </Text>
              </View>

              {!isSupabaseConfigured ? (
                <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 p-3">
                  <Text className="text-sm font-semibold text-coral-red">
                    Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable auth.
                  </Text>
                </View>
              ) : null}

              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                textContentType="emailAddress"
                value={email}
              />
              <TextInput
                autoCapitalize="none"
                label="Password"
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                showPasswordToggle
                textContentType="password"
                value={password}
              />

              <View className="-mt-2 items-end">
                <Link href="/forgot-password" asChild>
                  <Pressable hitSlop={8}>
                    <Text className="text-sm font-black text-electric-green">Forgot password?</Text>
                  </Pressable>
                </Link>
              </View>

              {error ? (
                <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 px-3 py-2">
                  <Text className="text-sm font-semibold text-coral-red">{error}</Text>
                </View>
              ) : null}

              <Button loading={isSubmitting} onPress={handleLogin} title="Log In" />

              <View className="flex-row items-center justify-center gap-2 pt-1">
                <Text className="text-sm font-semibold text-white/55">New to the Arena?</Text>
                <Link href="/signup" asChild>
                  <Pressable hitSlop={8}>
                    <Text
                      className="text-sm font-black uppercase text-electric-green"
                      style={{ letterSpacing: 1.5 }}>
                      Sign Up
                    </Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

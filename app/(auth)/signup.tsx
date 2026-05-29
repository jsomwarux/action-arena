import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { ArenaLogo, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { isSupabaseConfigured } from '@/lib/supabase';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to create your account. Please try again.';
}

export default function SignupScreen() {
  const router = useRouter();
  const { signUpWithPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    setError(undefined);
    setNotice(undefined);

    if (!displayName.trim() || !email.trim() || password.length < 6) {
      setError('Enter a display name, email, and a password with at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await signUpWithPassword(email.trim(), password, displayName.trim());
      if (session) {
        router.replace('/');
      } else {
        setNotice('Account created. Check your email to confirm your signup before logging in.');
      }
    } catch (signupError) {
      setError(getErrorMessage(signupError));
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
          <ArenaLogo eyebrow="JOIN · THE · ARENA" />
          <Text
            className="mt-6 text-base font-semibold text-white/65"
            style={{ letterSpacing: 0.3 }}>
            Build your team identity. Compete every week.
          </Text>
        </View>

        <View>
          <Card>
            <View className="gap-5">
              <View>
                <Text
                  className="text-[11px] font-black uppercase text-electric-green"
                  style={{ letterSpacing: 3 }}>
                  Create Account
                </Text>
                <Text
                  className="mt-1 text-2xl font-black uppercase text-white"
                  style={{ letterSpacing: -0.4 }}>
                  Get Drafted In
                </Text>
              </View>

              {!isSupabaseConfigured ? (
                <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 p-3">
                  <Text className="text-sm font-semibold text-coral-red">
                    Account services are unavailable right now. Please try again later.
                  </Text>
                </View>
              ) : null}

              <TextInput
                autoCapitalize="words"
                label="Display name"
                onChangeText={setDisplayName}
                placeholder="Sunday Strategist"
                textContentType="nickname"
                value={displayName}
              />
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
                placeholder="At least 6 characters"
                secureTextEntry
                showPasswordToggle
                textContentType="newPassword"
                value={password}
              />

              {error ? (
                <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 px-3 py-2">
                  <Text className="text-sm font-semibold text-coral-red">{error}</Text>
                </View>
              ) : null}

              {notice ? (
                <View className="rounded-xl border border-electric-green/40 bg-electric-green/10 px-3 py-2">
                  <Text className="text-sm font-semibold text-electric-green">{notice}</Text>
                </View>
              ) : null}

              <Text
                className="text-center text-xs font-semibold leading-5 text-white/55"
                style={{ letterSpacing: 0.3 }}>
                By creating an account, you agree to our{' '}
                <Text
                  accessibilityRole="link"
                  className="font-black text-electric-green"
                  onPress={() => router.push('/terms')}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  accessibilityRole="link"
                  className="font-black text-electric-green"
                  onPress={() => router.push('/privacy')}>
                  Privacy Policy
                </Text>
                .
              </Text>

              <Button loading={isSubmitting} onPress={handleSignup} title="Create Account" />

              <View className="flex-row items-center justify-center gap-2 pt-1">
                <Text className="text-sm font-semibold text-white/55">Already a player?</Text>
                <Link href="/login" asChild>
                  <Pressable hitSlop={8}>
                    <Text
                      className="text-sm font-black uppercase text-electric-green"
                      style={{ letterSpacing: 1.5 }}>
                      Log In
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

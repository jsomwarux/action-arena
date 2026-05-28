import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { ArenaLogo, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { isSupabaseConfigured } from '@/lib/supabase';

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to send a reset email. Please try again.';
}

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestReset = async () => {
    const trimmedEmail = email.trim();
    setError(undefined);
    setNotice(undefined);

    if (!trimmedEmail) {
      setError('Enter the email on your Action Arena account.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setNotice('Check your email for a reset link. It will open Action Arena to set a new password.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
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
          <ArenaLogo eyebrow="ACCOUNT · RECOVERY" />
          <Text className="mt-6 text-base font-semibold text-white/65">
            Get back in and keep your picks alive.
          </Text>
        </View>

        <Card>
          <View className="gap-5">
            <View>
              <Text
                className="text-[11px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 3 }}>
                Password Reset
              </Text>
              <Text className="mt-1 text-2xl font-black uppercase text-white">Send Reset Link</Text>
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
              onSubmitEditing={handleRequestReset}
              placeholder="you@example.com"
              returnKeyType="send"
              textContentType="emailAddress"
              value={email}
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

            <Button loading={isSubmitting} onPress={handleRequestReset} title="Send Reset Link" />

            <View className="flex-row items-center justify-center gap-2 pt-1">
              <Text className="text-sm font-semibold text-white/55">Remembered it?</Text>
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
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

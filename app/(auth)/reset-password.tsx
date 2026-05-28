import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { ArenaLogo, Button, Card, ScreenWrapper, TextInput } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { isSupabaseConfigured } from '@/lib/supabase';

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to reset your password. Please request a new link and try again.';
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const recoveryUrl = Linking.useLinkingURL();
  const { completePasswordReset, createPasswordRecoverySession, session } = useAuth();
  const processedUrlRef = useRef<string | null>(null);
  const [email, setEmail] = useState(session?.user.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [isRecovering, setIsRecovering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setEmail(session.user.email);
      setIsRecovering(false);
    }
  }, [session]);

  useEffect(() => {
    if (!recoveryUrl || processedUrlRef.current === recoveryUrl || session) {
      return;
    }

    processedUrlRef.current = recoveryUrl;
    setError(undefined);
    setNotice(undefined);
    setIsRecovering(true);

    createPasswordRecoverySession(recoveryUrl)
      .then((result) => {
        setEmail(result.email);
        setNotice('Recovery confirmed. Choose a new password to finish.');
      })
      .catch((recoveryError) => {
        setError(getErrorMessage(recoveryError));
      })
      .finally(() => {
        setIsRecovering(false);
      });
  }, [createPasswordRecoverySession, recoveryUrl, session]);

  const handleCompleteReset = async () => {
    setError(undefined);
    setNotice(undefined);

    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The password fields need to match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await completePasswordReset(password);
      router.replace('/');
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(session) && !isRecovering;

  return (
    <ScreenWrapper scroll>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center">
        <View className="mb-10">
          <ArenaLogo eyebrow="RESET · PASSWORD" />
          <Text className="mt-6 text-base font-semibold text-white/65">
            Lock in new credentials and get back to the board.
          </Text>
        </View>

        <Card>
          <View className="gap-5">
            <View>
              <Text
                className="text-[11px] font-black uppercase text-electric-green"
                style={{ letterSpacing: 3 }}>
                Account Recovery
              </Text>
              <Text className="mt-1 text-2xl font-black uppercase text-white">New Password</Text>
            </View>

            {!isSupabaseConfigured ? (
              <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 p-3">
                <Text className="text-sm font-semibold text-coral-red">
                  Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable auth.
                </Text>
              </View>
            ) : null}

            {email ? (
              <View className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <Text className="text-xs font-black uppercase text-white/45">Resetting</Text>
                <Text className="mt-1 text-sm font-semibold text-white">{email}</Text>
              </View>
            ) : null}

            <TextInput
              autoCapitalize="none"
              editable={canSubmit}
              label="New password"
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              textContentType="newPassword"
              value={password}
            />
            <TextInput
              autoCapitalize="none"
              editable={canSubmit}
              label="Confirm password"
              onChangeText={setConfirmPassword}
              onSubmitEditing={handleCompleteReset}
              placeholder="Repeat new password"
              returnKeyType="done"
              secureTextEntry
              textContentType="newPassword"
              value={confirmPassword}
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

            {!canSubmit && !isRecovering ? (
              <View className="rounded-xl border border-coral-red/40 bg-coral-red/10 px-3 py-2">
                <Text className="text-sm font-semibold text-coral-red">
                  Open the reset link from your email to choose a new password.
                </Text>
              </View>
            ) : null}

            <Button
              disabled={!canSubmit}
              loading={isRecovering || isSubmitting}
              onPress={handleCompleteReset}
              title={isRecovering ? 'Verifying Link' : 'Update Password'}
            />

            <View className="flex-row items-center justify-center gap-2 pt-1">
              <Text className="text-sm font-semibold text-white/55">Need another link?</Text>
              <Link href="/forgot-password" asChild>
                <Pressable hitSlop={8}>
                  <Text
                    className="text-sm font-black uppercase text-electric-green"
                    style={{ letterSpacing: 1.5 }}>
                    Send Again
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

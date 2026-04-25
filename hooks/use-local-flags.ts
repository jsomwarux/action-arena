import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const LOCAL_FLAG_KEYS = {
  betBoardTourComplete: 'action-arena.bet-board-tour-complete',
  onboardingComplete: 'action-arena.onboarding-complete',
} as const;

export function useLocalFlag(key: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [value, setValue] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(key)
      .then((storedValue) => {
        if (mounted) {
          setValue(storedValue === 'true');
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [key]);

  const markComplete = async () => {
    setValue(true);
    await AsyncStorage.setItem(key, 'true');
  };

  return {
    isLoading,
    markComplete,
    value,
  };
}

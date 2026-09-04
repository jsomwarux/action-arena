import { USE_MOCK_DATA } from '@/lib/env';

export const MOCK_DATA_ENV_VAR = 'VITE_USE_MOCK_DATA';

type MockDataSafetyOptions = {
  isDev?: boolean;
  useMockData?: string;
};

export function assertProductionMockDataDisabled({
  isDev = __DEV__,
  useMockData = USE_MOCK_DATA ? 'true' : 'false',
}: MockDataSafetyOptions = {}) {
  if (!isDev && useMockData === 'true') {
    throw new Error(
      `Production build cannot start with ${MOCK_DATA_ENV_VAR}=true. Disable mock data before releasing Action Arena.`,
    );
  }
}

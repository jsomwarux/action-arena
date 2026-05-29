import Constants from 'expo-constants';

const fallbackIosBundleIdentifier = 'com.actionarena.app';

const configuredIosBundleIdentifier = Constants.expoConfig?.ios?.bundleIdentifier;

export const IOS_BUNDLE_IDENTIFIER =
  typeof configuredIosBundleIdentifier === 'string' && configuredIosBundleIdentifier.length > 0
    ? configuredIosBundleIdentifier
    : fallbackIosBundleIdentifier;

export const SEASON_PASS_PRODUCT_ID = `${IOS_BUNDLE_IDENTIFIER}.seasonpass.s1`;

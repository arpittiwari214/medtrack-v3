/**
 * Build-time configuration on top of app.json.
 *
 * The only thing that changes per build is where the API lives. Development
 * finds it automatically (see src/api-url.ts); a build that will be installed
 * on other people's phones must point at the deployed API, set through
 * MEDTRACK_API_URL in eas.json.
 */

import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    extra: {
      ...config.extra,
      apiUrl: process.env['MEDTRACK_API_URL'] ?? config.extra?.['apiUrl'],
    },
  }) as ExpoConfig;

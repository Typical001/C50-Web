import { GoogleAuth } from 'google-auth-library';

// Read-only deployment diagnostic. Never print credentials, provider bodies or errors.
try {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  await client.request({
    url: 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.carrier50.c50academy/inappproducts',
    params: { maxResults: 1, fields: 'inappproduct' },
    timeout: 15000,
  });
  console.log('Google Play read-only provider authentication: PASSED');
} catch {
  console.error('Google Play read-only provider authentication: FAILED');
  process.exitCode = 1;
}

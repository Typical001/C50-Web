import { GoogleAuth } from 'google-auth-library';
import { existsSync, readFileSync } from 'node:fs';

// Read-only deployment diagnostic. Never print credentials, provider bodies or errors.
try {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.error('Google Play credential file: MISSING');
    process.exit(1);
  }
  const credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  if (credentials.client_email !== 'c50-play-verifier@c50-play-billing-20261115.iam.gserviceaccount.com' || credentials.project_id !== 'c50-play-billing-20261115') {
    console.error('Google Play verifier identity: DOES NOT MATCH CONFIGURED ACCOUNT');
    process.exit(1);
  }
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  const client = await auth.getClient();
  await client.request({
    url: 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.carrier50.c50academy/purchases/voidedpurchases',
    params: { maxResults: 1, fields: 'tokenPagination' },
    timeout: 15000,
  });
  console.log('Google Play read-only provider authentication: PASSED');
} catch (error) {
  console.error('Google Play read-only provider authentication: FAILED');
  // Only a bounded HTTP status or generic category; never output the error object.
  const status = Number(error?.response?.status);
  console.error(Number.isInteger(status) && status >= 400 && status <= 599
    ? `Provider HTTP status: ${status}` : 'Credential loading or network request failed');
  const reasons = [...(error?.response?.data?.error?.errors || []), ...(error?.response?.data?.error?.details || [])].map(item => item.reason);
  for (const reason of ['SERVICE_DISABLED', 'BILLING_DISABLED', 'accessNotConfigured', 'permissionDenied', 'forbidden']) {
    if (reasons.includes(reason)) console.error(`Provider reason: ${reason}`);
  }
  process.exitCode = 1;
}

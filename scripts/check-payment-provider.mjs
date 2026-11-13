// Read-only release diagnostic. Never logs credentials or provider response bodies.
import 'dotenv/config';
const key = process.env.RAZORPAY_KEY_ID || '';
const secret = process.env.RAZORPAY_KEY_SECRET || '';
const receipt = process.argv[2];
if (!/^rzp_test_[A-Za-z0-9]+$/.test(key) || !secret) {
  console.error('Razorpay diagnostic refused: matching Test-mode credentials required.');
  process.exitCode = 1;
} else if (receipt && !/^[0-9a-f-]{36}$/i.test(receipt)) {
  console.error('Razorpay diagnostic refused: invalid receipt.'); process.exitCode = 1;
} else {
  try {
    const query = receipt ? `receipt=${encodeURIComponent(receipt)}&count=100` : 'count=1';
    const response = await fetch(`https://api.razorpay.com/v1/orders?${query}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`Razorpay read-only Test authentication FAILED (HTTP ${response.status}).`);
      await response.body?.cancel(); process.exitCode = 1;
    } else {
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('Unexpected response');
      console.log('Razorpay read-only Test authentication PASSED. No payment/order created.');
      if (receipt) console.log(`Matching provider orders for inspected receipt: ${data.items.filter(order => order.receipt === receipt).length}. No records changed.`);
    }
  } catch {
    console.error('Razorpay read-only diagnostic failed: network or response error.'); process.exitCode = 1;
  }
}

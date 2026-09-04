import React, { useState } from 'react';
import { 
  X, CreditCard, Shield, Landmark, PhoneCall, Sparkles, 
  ChevronRight, ArrowRight, CheckCircle, Loader2
} from 'lucide-react';
import { Batch } from '../types';

interface PaymentModalProps {
  batch: Batch;
  userId: string;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({ batch, userId, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [paymentStep, setPaymentStep] = useState<'methods' | 'cardForm' | 'upiForm' | 'processing' | 'success'>('methods');
  const [cardNo, setCardNo] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [upiId, setUpiId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form input triggers
  const formatCardNo = (val: string) => {
    const raw = val.replace(/\s?/g, '').replace(/[^0-9]/g, '');
    const groups = raw.match(/.{1,4}/g);
    return groups ? groups.join(' ').substring(0, 19) : raw;
  };

  const handleCardNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCardNo(formatCardNo(e.target.value));
  };

  const formatExpiry = (val: string) => {
    const raw = val.replace(/\//g, '').replace(/[^0-9]/g, '');
    if (raw.length >= 2) {
      return raw.substring(0, 2) + '/' + raw.substring(2, 4);
    }
    return raw;
  };

  // Payment Verification API call
  const triggerPaymentVerification = async () => {
    setPaymentStep('processing');
    setErrorMessage('');

    try {
      const token = localStorage.getItem('aura_session_token');
      
      // Step 1: Create Razorpay Order ID on server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: batch.id,
          amount: batch.discountPrice
        })
      });
      const orderData = await orderRes.json();
      const razorpayOrderId = orderData.id;

      // Step 2: Simulate Razorpay Gateway transaction delay (1.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 3: Verify simulated signature on backend to process enrollment
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          batchId: batch.id,
          amount: batch.discountPrice,
          razorpayOrderId,
          razorpayPaymentId: 'pay_rzp_mock_' + Math.random().toString(36).substr(2, 10),
          signature: 'sig_hmac_sha256_mock_hash_verification_success'
        })
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        setPaymentStep('success');
        // Let user see success modal briefly, then invoke callback
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 1800);
      } else {
        setPaymentStep('methods');
        setErrorMessage(verifyData.error || 'Signature verification failed.');
      }
    } catch (err) {
      console.error('Error verifying payments transaction:', err);
      setPaymentStep('methods');
      setErrorMessage('Server-side verification crashed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Razorpay UI Wrapper */}
      <div className="relative w-full max-w-md bg-[#1d1d1f] rounded-3xl overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col text-white">
        
        {/* Modal Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer outline-none z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Razorpay Header banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 flex items-center gap-3 border-b border-white/5">
          <div className="p-2.5 bg-white/10 rounded-2xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-blue-200">SECURE BILLING</span>
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <h3 className="text-base font-bold tracking-tight">Razorpay Secure Checkout</h3>
          </div>
        </div>

        {/* Course Details summary in Modal */}
        <div className="bg-white/5 px-6 py-4 border-b border-white/5 text-xs flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-400">ENROLLING IN</p>
            <p className="font-bold text-white max-w-[200px] truncate mt-0.5">{batch.title}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-400">TOTAL COST</p>
            <p className="text-base font-extrabold text-blue-400 mt-0.5">₹{batch.discountPrice}</p>
          </div>
        </div>

        {/* Error State */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dynamic Step Content */}
        <div className="p-6 flex-grow min-h-[250px]">
          
          {/* STEP 1: SELECT METHOD */}
          {paymentStep === 'methods' && (
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Select Payment Mode</h4>

              <div className="space-y-3.5">
                {/* Method Card */}
                <button
                  id="pay-card-select-btn"
                  onClick={() => setPaymentStep('cardForm')}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-blue-500/15 text-blue-400 rounded-xl">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Credit or Debit Card</p>
                      <p className="text-[10px] text-gray-400">Visa, MasterCard, RuPay, Maestro</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* Method UPI */}
                <button
                  id="pay-upi-select-btn"
                  onClick={() => setPaymentStep('upiForm')}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">UPI Instant Transfer</p>
                      <p className="text-[10px] text-gray-400">Google Pay, PhonePe, Paytm, bhim</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* Method NetBanking Simulator */}
                <button
                  id="pay-netbank-select-btn"
                  onClick={triggerPaymentVerification}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/50 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-amber-500/15 text-amber-400 rounded-xl">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Express NetBanking Simulator</p>
                      <p className="text-[10px] text-gray-400">Direct simulated checkout click</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CREDIT CARD DETAILS */}
          {paymentStep === 'cardForm' && (
            <div className="space-y-5 animate-slideIn">
              <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Card Details</h4>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-400">Cardholder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Arjun Kumar"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-gray-400">Card Number</label>
                  <input
                    type="text"
                    required
                    value={cardNo}
                    onChange={handleCardNoChange}
                    placeholder="4111 2222 3333 4444"
                    maxLength={19}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-400">Expiry MM/YY</label>
                    <input
                      type="text"
                      required
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="12/28"
                      maxLength={5}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-gray-400">CVV Pin</label>
                    <input
                      type="password"
                      required
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/[^0-9]/g, '').substring(0, 3))}
                      placeholder="•••"
                      maxLength={3}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setPaymentStep('methods')}
                    className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={triggerPaymentVerification}
                    disabled={!cardNo || !cardExpiry || !cardCvv}
                    className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-blue-500/10 flex items-center justify-center gap-1"
                  >
                    Pay ₹{batch.discountPrice}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: UPI ID FORM */}
          {paymentStep === 'upiForm' && (
            <div className="space-y-5 animate-slideIn">
              <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">UPI ID Transfer</h4>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-gray-400">Virtual Payment Address (VPA)</label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="arjun@okaxis"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-blue-500 text-white font-mono"
                  />
                  <p className="text-[10px] text-gray-400">We will trigger a payment request on your UPI client application.</p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setPaymentStep('methods')}
                    className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={triggerPaymentVerification}
                    disabled={!upiId}
                    className="w-1/2 py-2.5 bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl text-xs cursor-pointer shadow-lg flex items-center justify-center gap-1"
                  >
                    Verify & Pay
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PROCESSING PAYLOAD LOADER */}
          {paymentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center min-h-[220px] text-center space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div>
                <p className="text-sm font-bold text-white">Validating Signature...</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[250px] mx-auto">
                  Contacting Razorpay Gateway server. Do not press back or refresh the frame.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS MODAL */}
          {paymentStep === 'success' && (
            <div className="flex flex-col items-center justify-center min-h-[220px] text-center space-y-4 animate-scaleUp">
              <CheckCircle className="w-14 h-14 text-emerald-500 fill-emerald-500/10" />
              <div>
                <h4 className="text-base font-bold text-white">Payment Verified Successfully</h4>
                <p className="text-[10px] text-gray-400 mt-1">
                  Enrolled! Redirecting to student classroom...
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Secure Trust Badges footer */}
        <div className="bg-white/[0.02] py-4 px-6 border-t border-white/5 text-[10px] text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            PCI-DSS Compliant Server
          </span>
          <span>128-bit SSL Encryption</span>
        </div>
      </div>
    </div>
  );
}

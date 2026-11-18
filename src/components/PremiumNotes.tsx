import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionFetch } from '../lib/sessionTransport';
import { type NoteProduct, type NoteRequest, notesPrice, notesStatus } from '../lib/premiumNotes';

const button = 'rounded-full bg-[#6C5CFF] text-white px-6 py-3 font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
export default function PremiumNotes({ userId, onLogin }: { userId?: string; onLogin: () => void }) {
  const [products, setProducts] = useState<NoteProduct[]>([]), [requests, setRequests] = useState<NoteRequest[]>([]);
  const [selectedId, setSelectedId] = useState(''), [loading, setLoading] = useState(true), [ready, setReady] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [launchUrl, setLaunchUrl] = useState('');
  const alive = useRef(true), lock = useRef(false), loadingLock = useRef(false), popup = useRef<Window | null>(null);
  const read = async (url: string, body?: unknown) => {
    const r = await sessionFetch(url, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not load notes.'); return data;
  };
  const load = useCallback(async () => {
    if (loadingLock.current || lock.current) return; loadingLock.current = true; setLoading(true); setError('');
    try {
      const [p, r] = await Promise.all([read('/api/premium-notes'), userId ? read('/api/premium-notes/mine') : Promise.resolve([])]);
      if (alive.current) { setProducts(p); setRequests(r); setReady(true); }
    } catch (e) { if (alive.current) { setError((e as Error).message); setReady(false); } }
    finally { loadingLock.current = false; if (alive.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    alive.current = true; void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { alive.current = false; popup.current?.close(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); clearInterval(timer); };
  }, [load]);
  const catalog = [...products, ...requests.filter(r => r.product && !products.some(p => p.id === r.product_id)).map(r => r.product!)];
  const selected = catalog.find(p => p.id === selectedId), request = requests.find(r => r.product_id === selectedId);
  const buy = async () => {
    if (!userId) { onLogin(); return; }
    if (!selected || lock.current || !ready || loading) return;
    lock.current = true; setBusy(true); setError(''); setLaunchUrl('');
    const tab = window.open('about:blank', '_blank');
    if (tab) { tab.opener = null; const meta = tab.document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; tab.document.head.appendChild(meta); }
    popup.current = tab;
    try {
      const result = await read(`/api/premium-notes/${selected.id}/request`, {});
      if (!alive.current) { tab?.close(); return; }
      setRequests(old => [...old.filter(r => r.product_id !== selected.id), { ...result.request, product: selected }]);
      if (result.request.status === 'purchased') { tab?.close(); return; }
      const url = new URL(result.checkout_url);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('The purchase link is invalid. Contact support.');
      if (tab && !tab.closed) { tab.location.replace(url.href); popup.current = null; }
      else setLaunchUrl(url.href);
    } catch (e) { tab?.close(); if (alive.current) setError((e as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
    <div className="flex flex-wrap justify-between gap-4 items-center"><h1 className="text-3xl font-bold">Premium Notes</h1><button disabled={loading || busy} className="border rounded-full px-5 py-3" onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-4">{error} <button onClick={() => void load()} className="underline">Retry</button></p>}
    {loading && !ready && <p role="status">Loading notes…</p>}
    {!selectedId && <><p className="text-gray-600">Explore individual PDFs and notes bundles. Payment and delivery are handled externally; purchases are verified manually.</p>
      {ready && !catalog.length && <div className="border rounded-3xl p-12 text-center">Premium notes will appear here when available.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{catalog.map(p => <article key={p.id} className="border rounded-3xl p-6 bg-white space-y-4">
        {!!p.cover_url && <img src={p.cover_url} alt="" className="w-full h-48 object-cover rounded-2xl" />}
        <p className="text-sm text-violet-700">{p.kind === 'bundle' ? 'PDF bundle' : 'PDF notes'}</p><h2 className="text-xl font-bold">{p.title}</h2><p className="text-xl font-bold">{notesPrice(p.price_paise)}</p>
        <p>{notesStatus(requests.find(r => r.product_id === p.id))}</p><button className={button} onClick={() => { setSelectedId(p.id); setLaunchUrl(''); }}>View details</button>
      </article>)}</div></>}
    {selectedId && <button className="underline text-violet-700" disabled={busy} onClick={() => { setSelectedId(''); setLaunchUrl(''); }}>← All premium notes</button>}
    {selected && <article className="max-w-3xl mx-auto border rounded-3xl bg-white p-6 sm:p-10 space-y-6">
      {!!selected.cover_url && <img src={selected.cover_url} alt="" className="w-full max-h-80 object-contain rounded-2xl" />}
      <h2 className="text-3xl font-bold">{selected.title}</h2><p className="text-2xl font-bold">{notesPrice(selected.price_paise)}</p><p className="whitespace-pre-wrap">{selected.description}</p>
      {!!selected.contents && <div><h3 className="font-bold">Included notes</h3><p className="whitespace-pre-wrap">{selected.contents}</p></div>}
      {request && <div className="rounded-xl bg-violet-50 p-4 space-y-2"><strong>{notesStatus(request)}</strong><p className="break-all text-sm">Request reference: {request.id}</p><p>Recorded price: {notesPrice(request.price_paise)}</p></div>}
      {request?.status === 'purchased' ? <><button className={button} disabled>Purchased</button><p>Delivery: {request.delivery_status === 'delivered' ? 'Delivered' : 'Pending with the seller'}. Payment was manually verified.</p><p className="whitespace-pre-wrap">{request.product?.delivery_instructions || 'The seller handles PDF delivery. Contact support if you need help accessing your notes.'}</p></> : <>
        <p className="text-gray-600">Buy opens an external website or Google Form. Use your C50 account email and copy your request reference into the form. Returning here does not confirm submission or payment.</p>
        {request?.status === 'pending' && <p>Pending verification. Admin will check your payment before marking this Purchased.</p>}
        {request?.status === 'rejected' && <p>Payment could not be verified. Check your submission or contact support before trying again.</p>}
        <button className={button} disabled={busy || loading || !ready || !selected.published || request?.status === 'pending'} onClick={() => void buy()}>{busy ? 'Opening…' : request?.status === 'pending' ? 'Pending verification' : !selected.published ? 'Currently unavailable' : !userId ? 'Sign in to buy' : 'Buy'}</button>
        {request?.status === 'pending' && selected.published && <button className="ml-4 underline text-violet-700" disabled={busy || loading || !ready} onClick={() => void buy()}>Reopen form</button>}
        {launchUrl && <p>Your browser blocked the new tab. <a href={launchUrl} target="_blank" rel="noopener noreferrer" className="underline text-violet-700">Open purchase form</a></p>}
      </>}
    </article>}
    {selectedId && ready && !selected && <p>These notes are unavailable.</p>}
  </section>;
}

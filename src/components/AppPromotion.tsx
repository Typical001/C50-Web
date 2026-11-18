import { Smartphone } from 'lucide-react';
import type { AppPromotion as Settings } from '../lib/appPromotion';

export default function AppPromotion({ settings }: { settings: Settings }) {
  if (!settings.visible) return null;
  return <section aria-label="Mobile app" className="max-w-7xl mx-auto px-6">
    <div className="apple-card p-6 sm:p-10 bg-gradient-to-br from-zinc-900 to-black text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none" aria-hidden="true"><Smartphone className="w-64 h-64" /></div>
      <div className="text-left space-y-4 max-w-xl min-w-0 relative z-10 break-words">
        <span className="text-xs uppercase font-extrabold tracking-widest bg-white/15 px-3 py-1 rounded-full">{settings.badge}</span>
        <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">{settings.heading}</h3>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{settings.description}</p>
        <div className="flex flex-wrap gap-4 pt-2">
          {(['google_play', 'app_store'] as const).map(key => {
            const store = settings[key];
            const label = key === 'google_play' ? 'Google Play' : 'App Store';
            if (store.status === 'hidden') return null;
            return store.status === 'available'
              ? <a key={key} href={store.url} target="_blank" rel="noopener noreferrer" className="bg-white text-black font-bold text-sm px-5 py-3 rounded-xl hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{label}<span className="sr-only"> (opens in a new tab)</span></a>
              : <span key={key} className="bg-white/10 text-gray-300 font-bold text-sm px-5 py-3 rounded-xl">{label} (Coming Soon)</span>;
          })}
        </div>
      </div>
      <div className="w-full max-w-[280px] shrink-0 relative z-10 bg-zinc-800 p-3 rounded-[32px] border border-zinc-700 shadow-2xl">
        <div className="aspect-[9/19] bg-zinc-950 rounded-[24px] overflow-hidden flex flex-col items-center justify-center p-6 border border-zinc-800 text-center break-words">
          <div className="w-10 h-10 bg-[#6D5DF6] rounded-full flex items-center justify-center font-extrabold text-sm mb-3" aria-hidden="true">C</div>
          <p className="text-sm font-bold w-full">{settings.phone_name}</p>
          <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest w-full">{settings.phone_caption}</p>
        </div>
      </div>
    </div>
  </section>;
}

import { BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { Batch } from '../types';
import { isTestSeries } from '../lib/testSeries';
import BatchCard from './BatchCard';

type Filter = 'all' | 'free' | 'paid';
type Props = Pick<ComponentProps<typeof BatchCard>, 'onEnrollFree' | 'onPurchaseClick' | 'onViewLectures'> & {
  batches: Batch[]; enrolledBatchIds: string[];
  filter: Filter; onFilterChange: (filter: Filter) => void;
  loading: boolean; error: string; onRefresh: () => void;
};
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D5DF6] focus-visible:ring-offset-2';

export default function TestSeriesCatalog({ batches, enrolledBatchIds, filter, onFilterChange, loading, error, onRefresh, ...actions }: Props) {
  const series = batches.filter(batch => batch.catalogVisible !== false && isTestSeries(batch));
  const visible = series.filter(batch => filter === 'all' || (filter === 'free' ? batch.isFree : !batch.isFree));
  const initialLoading = loading && batches.length === 0;
  return (
    <section aria-labelledby="test-series-title" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8 min-h-[460px]">
      <header className="space-y-3 max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-widest text-[#6D5DF6]">MPPSC preparation</span>
        <h1 id="test-series-title" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1d1d1f]">Test Series</h1>
        <p className="text-sm sm:text-base leading-relaxed text-gray-500">Explore free and paid preparation series and their study content, all in one place.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter test series" className="flex flex-wrap gap-1 rounded-2xl bg-[#f0eefb] p-1.5">
          {(['all', 'free', 'paid'] as const).map(value => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => onFilterChange(value)}
              className={`min-h-11 rounded-xl px-4 sm:px-5 py-2 text-sm font-semibold transition-colors ${focus} ${filter === value ? 'bg-[#6D5DF6] text-white shadow-sm' : 'text-gray-600 hover:bg-white/80 hover:text-[#6D5DF6]'}`}>
              {value === 'all' ? 'All series' : value === 'free' ? 'Free' : 'Paid'}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-[#6D5DF6]/40 hover:text-[#6D5DF6] disabled:opacity-60 disabled:cursor-wait ${focus}`}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
        <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
        <p className="flex-1 min-w-40">{error}{visible.length > 0 && ' Previously loaded series are shown below.'}</p>
        <button type="button" onClick={onRefresh} disabled={loading} className={`min-h-11 rounded-lg px-3 font-semibold underline underline-offset-4 disabled:opacity-50 ${focus}`}>Retry</button>
      </div>}

      <div role="status" className="sr-only">{loading ? 'Refreshing test series.' : error ? '' : `${visible.length} series shown.`}</div>
      {initialLoading ? <div aria-hidden="true" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[0, 1, 2].map(index => <div key={index} className="overflow-hidden rounded-3xl border border-gray-100 bg-white motion-safe:animate-pulse">
          <div className="aspect-video bg-gray-100" /><div className="p-6 space-y-4"><div className="h-5 w-3/4 rounded bg-gray-100" /><div className="h-4 w-full rounded bg-gray-100" /><div className="h-11 rounded-xl bg-gray-100" /></div>
        </div>)}
      </div> : visible.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {visible.map(batch => <BatchCard key={batch.id} batch={batch} isEnrolled={enrolledBatchIds.includes(batch.id)} {...actions} />)}
      </div> : !loading && !error ? <div className="rounded-3xl border border-gray-100 bg-white px-6 py-14 sm:py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6D5DF6]/10 text-[#6D5DF6]"><BookOpen aria-hidden="true" className="h-7 w-7" /></div>
        <h2 className="text-xl font-bold tracking-tight text-gray-900">{filter === 'all' ? 'Test series are on the way' : `No ${filter} test series yet`}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500">{filter === 'all' ? 'Published preparation series will appear here. Check back soon for new study content.' : 'Try viewing all series, or check back later for new additions.'}</p>
        {filter !== 'all' && <button type="button" onClick={() => onFilterChange('all')} className={`mt-6 min-h-11 rounded-full bg-[#6D5DF6] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7C4DFF] ${focus}`}>Show all series</button>}
      </div> : null}
    </section>
  );
}

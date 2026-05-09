export default function LoadingPage() {
  return (
    <div className="space-y-5 max-w-5xl animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-48 bg-slate-200 rounded-lg" />
      <div className="h-4 w-72 bg-slate-100 rounded" />

      {/* Cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-card p-5 space-y-3">
            <div className="w-11 h-11 bg-slate-200 rounded-xl" />
            <div className="h-8 w-16 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-[230px] bg-slate-100 rounded-xl" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-[160px] bg-slate-100 rounded-xl" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-20 bg-slate-100 rounded" />
                <div className="h-3 w-8 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

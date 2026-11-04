import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const SkeletonBox: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
);

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] animate-pulse flex flex-col justify-between ${className}`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="w-8 h-8 rounded-xl bg-slate-100" />
      <div className="w-16 h-4 rounded-md bg-slate-100" />
    </div>
    <div>
      <div className="w-24 h-3.5 rounded bg-slate-100 mb-2" />
      <div className="w-36 h-7 rounded bg-slate-100 mb-2" />
      <div className="w-28 h-3 rounded bg-slate-100" />
    </div>
  </div>
);

/**
 * Full Overview Dashboard Skeleton Placeholder
 * Perfectly matches the 3-column top grid and 2-column bottom table grid
 * Zero Cumulative Layout Shift (CLS)!
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="relative space-y-4 sm:space-y-5 animate-in fade-in duration-150">
      {/* 1. TOP STATS ROW (3 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Col 1: Total Revenue Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] animate-pulse flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-slate-100" />
                <div className="w-24 h-4 rounded bg-slate-100" />
              </div>
              <div className="w-16 h-5 rounded-full bg-slate-100" />
            </div>
            <div className="w-32 h-3.5 rounded bg-slate-100 mb-2" />
            <div className="w-48 h-8 rounded bg-slate-100 mb-4" />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
          </div>
        </div>

        {/* Col 2: 2x2 Square Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#E5E1F0] p-3 sm:p-3.5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] animate-pulse flex flex-col justify-between min-h-[105px]"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 mb-2" />
              <div>
                <div className="w-16 h-3 rounded bg-slate-100 mb-1.5" />
                <div className="w-20 h-5 rounded bg-slate-100 mb-1" />
                <div className="w-12 h-2.5 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Col 3: Monthly Trends Graph Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] animate-pulse flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-slate-100" />
              <div className="w-28 h-4 rounded bg-slate-100" />
            </div>
            <div className="w-20 h-4 rounded bg-slate-100" />
          </div>
          <div className="flex items-end justify-between gap-3 h-28 px-3 pb-2 border-b border-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-1 items-end w-12">
                <div className="w-5 bg-slate-100 rounded-t-sm" style={{ height: `${30 + i * 15}%` }} />
                <div className="w-5 bg-slate-100 rounded-t-sm" style={{ height: `${20 + i * 10}%` }} />
              </div>
            ))}
          </div>
          <div className="pt-2 flex justify-between">
            <div className="w-20 h-3 rounded bg-slate-100" />
            <div className="w-20 h-3 rounded bg-slate-100" />
          </div>
        </div>
      </div>

      {/* 2. LOWER SECTION: TWO MASTER TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {[1, 2].map((tableIdx) => (
          <div
            key={tableIdx}
            className="lg:col-span-6 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] animate-pulse min-h-[260px]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-slate-100" />
                <div className="w-36 h-4 rounded bg-slate-100" />
              </div>
              <div className="w-20 h-5 rounded-full bg-slate-100" />
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5].map((rowIdx) => (
                <div key={rowIdx} className="h-8 rounded-lg bg-slate-100/70 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

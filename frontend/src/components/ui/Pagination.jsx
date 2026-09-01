import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onPageChange, total }) {
    if (totalPages <= 1) return null;

    const canPrev = page > 1;
    const canNext = page < totalPages;

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-100 bg-white">
            <p className="text-xs sm:text-sm text-gray-500">
                Page <span className="font-semibold text-gray-800">{page}</span> of{' '}
                <span className="font-semibold text-gray-800">{totalPages}</span>
                {total !== undefined && <span className="text-gray-400 ml-1.5 hidden xs:inline">({total} items)</span>}
            </p>
            <div className="flex gap-1.5 sm:gap-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={!canPrev}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
                >
                    <ChevronLeft size={15} />
                    <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={!canNext}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 border border-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    );
}
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: Dispatch<SetStateAction<number>>;
  onPageSizeChange: (pageSize: number) => void;
};

export function usePagination<T>(items: readonly T[], initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, items, pageSize],
  );

  return {
    page: currentPage,
    pageCount,
    pageItems,
    pageSize,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    total: items.length,
  };
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="pagination-controls flex flex-wrap items-center justify-between gap-3 border-t theme-border px-4 py-3 text-sm theme-text-soft">
      <div className="flex items-center gap-2">
        <span>
          {firstItem}–{lastItem} de {total}
        </span>
        <label className="flex items-center gap-2">
          <span>Por página</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-lg border theme-border bg-[var(--bg)] px-2 py-1 theme-text"
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange((current) => Math.max(1, current - 1))}
          className="rounded-lg border theme-border px-3 py-1.5 disabled:opacity-40"
        >
          Anterior
        </button>
        <span>
          Página {page} de {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() =>
            onPageChange((current) => Math.min(pageCount, current + 1))
          }
          className="rounded-lg border theme-border px-3 py-1.5 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default PaginationControls;

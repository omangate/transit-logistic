'use client';

import { useMemo, useState, type ReactNode } from 'react';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  mobileLabel?: string;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  pageSize?: number;
  exportFileName?: string;
  mobileCardTitle?: (row: T) => string;
  mobileCardSubtitle?: (row: T) => string;
};

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results.',
  pageSize = 10,
  exportFileName = 'export.csv',
  mobileCardTitle,
  mobileCardSubtitle,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const visibleColumns = columns.filter((col) => !hiddenColumns.has(col.id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = rows;
    if (q) {
      result = rows.filter((row) =>
        columns.some((col) => String(col.accessor(row) ?? '').toLowerCase().includes(q)),
      );
    }
    if (sortColumn) {
      const col = columns.find((c) => c.id === sortColumn);
      if (col) {
        result = [...result].sort((a, b) => {
          const av = col.accessor(a) ?? '';
          const bv = col.accessor(b) ?? '';
          const cmp = compareValues(av, bv);
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return result;
  }, [rows, search, sortColumn, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCsv = () => {
    const header = visibleColumns.map((c) => c.header).join(',');
    const body = filtered
      .map((row) =>
        visibleColumns
          .map((col) => `"${String(col.accessor(row) ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="data-table-premium">
      <div className="data-table-premium__toolbar">
        <input
          type="search"
          className="data-table-premium__search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <div className="data-table-premium__toolbar-actions">
          <details className="data-table-premium__columns">
            <summary>Columns</summary>
            <div className="data-table-premium__columns-list">
              {columns.map((col) => (
                <label key={col.id}>
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col.id)}
                    onChange={() => {
                      setHiddenColumns((current) => {
                        const next = new Set(current);
                        if (next.has(col.id)) next.delete(col.id);
                        else next.add(col.id);
                        return next;
                      });
                    }}
                  />
                  {col.header}
                </label>
              ))}
            </div>
          </details>
          <button type="button" className="portal-button portal-button--ghost" onClick={exportCsv}>
            Export
          </button>
        </div>
      </div>

      <div className="data-table-premium__desktop table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.id}>
                  {col.sortable !== false ? (
                    <button
                      type="button"
                      className="data-table-premium__sort"
                      onClick={() => {
                        if (sortColumn === col.id) {
                          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setSortColumn(col.id);
                          setSortDir('asc');
                        }
                      }}
                    >
                      {col.header}
                      {sortColumn === col.id ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length}>{emptyMessage}</td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr key={row.id}>
                  {visibleColumns.map((col) => (
                    <td key={col.id}>{col.render ? col.render(row) : col.accessor(row) ?? '—'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-table-premium__mobile">
        {paged.length === 0 ? (
          <p className="muted-text">{emptyMessage}</p>
        ) : (
          paged.map((row) => (
            <article key={row.id} className="data-table-premium__card">
              <header>
                <strong>{mobileCardTitle?.(row)}</strong>
                {mobileCardSubtitle ? <p className="muted-text">{mobileCardSubtitle(row)}</p> : null}
              </header>
              {visibleColumns.map((col) => (
                <div key={col.id} className="data-table-premium__card-row">
                  <span>{col.mobileLabel ?? col.header}</span>
                  <span>{col.render ? col.render(row) : col.accessor(row) ?? '—'}</span>
                </div>
              ))}
            </article>
          ))
        )}
      </div>

      {filtered.length > pageSize ? (
        <div className="data-table-premium__pagination">
          <button
            type="button"
            className="portal-button portal-button--ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="portal-button portal-button--ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

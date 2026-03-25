/**
 * Component: components\DataTable.tsx
 * Purpose: Defines UI structure and behavior for this view/component.
 */
import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  emptyText?: string;
}

function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  loading = false,
  emptyText = 'No records found.',
}: DataTableProps<T>) {
  return (
    <div className="saas-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length}>
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, index) => (
                <tr key={keyExtractor(row, index)} className="border-b border-slate-100 hover:bg-slate-50/80">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 align-top text-slate-700 ${column.className || ''}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;


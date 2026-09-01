export default function Table({ columns, data, onRowClick }) {
    return (
        <div className="w-full overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[540px] sm:min-w-full">
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/75">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-3 py-2.5 sm:px-4 sm:py-3 text-left text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                                style={{ width: col.width }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((row, idx) => (
                        <tr
                            key={row._id || idx}
                            onClick={() => onRowClick?.(row)}
                            className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50/80 active:bg-gray-100/80' : ''} transition`}
                        >
                            {columns.map((col) => (
                                <td key={col.key} className="px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-900 align-middle">
                                    {col.render ? col.render(row) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
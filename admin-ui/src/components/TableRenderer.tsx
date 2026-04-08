type TableData = {
  type: "table";
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

export default function TableRenderer({ data }: { data: TableData }) {
  if (!data.columns?.length) {
    return <div style={{ marginTop: 20 }}>Không có dữ liệu bảng.</div>;
  }

  return (
    <div style={{ marginTop: 20, overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          background: "#111",
          color: "#fff",
        }}
      >
        <thead>
          <tr>
            {data.columns.map((col) => (
              <th
                key={col}
                style={{
                  border: "1px solid #333",
                  padding: "10px",
                  textAlign: "left",
                  background: "#1b1b1b",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {data.columns.map((col) => (
                <td
                  key={col}
                  style={{
                    border: "1px solid #333",
                    padding: "10px",
                    verticalAlign: "top",
                  }}
                >
                  {String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
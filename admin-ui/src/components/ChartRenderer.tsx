import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type XYSeries = {
  name: string;
  data: Array<number | string>;
};

type PieItem = {
  name: string;
  value: number;
};

type ChartData = {
  type: "chart";
  chart: "line" | "bar" | "pie";
  title?: string;
  x?: Array<string | number>;
  series: XYSeries[] | PieItem[];
};

function buildCartesianData(data: ChartData) {
  if (!data.x || !Array.isArray(data.series)) return [];

  const cartesianSeries = data.series as XYSeries[];

  return data.x.map((xValue, index) => {
    const row: Record<string, string | number> = { x: xValue };

    for (const series of cartesianSeries) {
      row[series.name] = series.data[index] ?? 0;
    }

    return row;
  });
}

const palette = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F"];

export default function ChartRenderer({ data }: { data: ChartData }) {
  if (data.chart === "pie") {
    const pieData = data.series as PieItem[];

    return (
      <div style={{ width: "100%", height: 360, marginTop: 20 }}>
        {data.title ? <h4 style={{ marginBottom: 12 }}>{data.title}</h4> : null}
        <ResponsiveContainer>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={120}
              label
            >
              {pieData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={palette[index % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const chartData = buildCartesianData(data);
  const series = data.series as XYSeries[];

  if (data.chart === "bar") {
    return (
      <div style={{ width: "100%", height: 360, marginTop: 20 }}>
        {data.title ? <h4 style={{ marginBottom: 12 }}>{data.title}</h4> : null}
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip />
            <Legend />
            {series.map((s, index) => (
              <Bar key={s.name} dataKey={s.name} fill={palette[index % palette.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 360, marginTop: 20 }}>
      {data.title ? <h4 style={{ marginBottom: 12 }}>{data.title}</h4> : null}
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip />
          <Legend />
          {series.map((s, index) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={palette[index % palette.length]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
import { useMemo } from 'react';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
  filled?: boolean;
}

export default function SparklineChart({
  data,
  color = 'hsl(160, 84%, 39%)',
  height = 32,
  width = 80,
  showDot = true,
  filled = true,
}: SparklineChartProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((v, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    // Smooth curve using cardinal spline
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return d;
  }, [data, height, width]);

  const fillPath = useMemo(() => {
    if (!filled || data.length < 2) return '';
    const padding = 2;
    return `${path} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;
  }, [path, filled, data, width, height]);

  const lastPoint = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;
    const i = data.length - 1;
    return {
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((data[i] - min) / range) * h,
    };
  }, [data, height, width]);

  if (data.length < 2) return null;

  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {filled && (
        <path d={fillPath} fill={`url(#${gradientId})`} />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && lastPoint && (
        <>
          <circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={color} />
          <circle cx={lastPoint.x} cy={lastPoint.y} r={5} fill={color} opacity={0.2}>
            <animate attributeName="r" values="5;8;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>
  );
}

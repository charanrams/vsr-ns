import type { ReactNode } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Legend } from './ui';

/** Shared categorical palette — status meaning is stable across every chart. */
export const C = {
  green: '#0f6b47',
  greenDark: '#0b3d2e',
  greenLight: '#5fbf7f',
  orange: '#f58220',
  amber: '#f4b740',
  blue: '#2f7de1',
  red: '#d9443a',
  violet: '#9b51e0',
  grey: '#c9c4b8',
};
export const STATUS_COLOR: Record<string, string> = {
  placed: C.amber, confirmed: '#f8cf6e', picking: C.blue, packed: C.violet, assigned: '#7fb2f0', out_for_delivery: C.blue,
  delivered: C.green, cancelled: C.red, rejected: '#ef8a83', returned: C.grey, return_requested: C.orange, delivery_failed: '#b8322a',
};
export const SERIES = [C.green, C.orange, C.blue, C.violet, C.amber, C.greenLight, C.red, C.grey];

export const axisProps = { tick: { fontSize: 11, fill: '#6b7470' }, axisLine: false, tickLine: false } as const;

export function ChartTooltip(props: { formatter?: (v: number, name: string) => [string, string] }) {
  return (
    <Tooltip
      formatter={props.formatter as never}
      cursor={{ fill: 'rgba(15,107,71,0.06)' }}
      contentStyle={{ borderRadius: 10, border: '1px solid #ebe5da', fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}
    />
  );
}

export function Donut({ data, center, sub, size = 170, legend = true, valueLabel }: { data: { name: string; value: number; color: string }[]; center: ReactNode; sub?: string; size?: number; legend?: boolean; valueLabel?: (d: { name: string; value: number }, total: number) => ReactNode }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const shown = total ? data.filter((d) => d.value > 0) : [{ name: 'None', value: 1, color: '#eee9df' }];
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={shown} dataKey="value" innerRadius="64%" outerRadius="100%" paddingAngle={total ? 1.5 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={false}>
              {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            {total > 0 && <ChartTooltip />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="tabular text-xl leading-tight font-extrabold">{center}</div>
            {sub && <div className="text-[11px] text-muted">{sub}</div>}
          </div>
        </div>
      </div>
      {legend && (
        <ul className="min-w-[150px] flex-1 space-y-2.5">
          {data.map((d) => (
            <Legend key={d.name} color={d.color} label={d.name} value={valueLabel ? valueLabel(d, total) : `${d.value} (${total ? Math.round((d.value / total) * 100) : 0}%)`} />
          ))}
        </ul>
      )}
    </div>
  );
}

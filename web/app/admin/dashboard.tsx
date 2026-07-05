'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Chart as ChartJS,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { api } from '@/lib/api';
import type { AdminGraphData, GraphPeriod } from '@/lib/admin';
import shell from './admin.module.css';

ChartJS.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

const graphFetcher = (p: string) => api.get<AdminGraphData>(p);

const PERIODS: { key: GraphPeriod; label: string }[] = [
  { key: 'day', label: '일' },
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
];

function PeriodTabs({ value, onChange }: { value: GraphPeriod; onChange: (p: GraphPeriod) => void }) {
  return (
    <div className={shell.periodTabs}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`${shell.periodTab} ${value === p.key ? shell.periodTabActive : ''}`}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const AXIS = '#4a5568';
const GRID = '#1e2a3a';
const LEGEND = '#a8b5c8';

/** 활동 통계 — 막대(가입/세션) + 선(PV/UV, 토글) */
export function ActivityChart() {
  const [period, setPeriod] = useState<GraphPeriod>('day');
  const [pvOn, setPvOn] = useState(false);
  const [uvOn, setUvOn] = useState(false);
  const { data } = useSWR(`/api/admin/stats/graph?period=${period}`, graphFetcher);

  const chartData: ChartData = {
    labels: data?.labels ?? [],
    datasets: [
      { type: 'bar', label: '신규 가입자', data: data?.users ?? [], backgroundColor: 'rgba(91,143,185,0.7)', borderRadius: 3, yAxisID: 'y' },
      { type: 'bar', label: '신규 세션', data: data?.sessions ?? [], backgroundColor: 'rgba(95,217,142,0.6)', borderRadius: 3, yAxisID: 'y' },
      { type: 'line', label: 'PV', data: data?.pv ?? [], borderColor: '#f0b34a', backgroundColor: 'rgba(240,179,74,0.08)', tension: 0.3, fill: false, pointRadius: 2, yAxisID: 'y2', hidden: !pvOn },
      { type: 'line', label: 'UV', data: data?.uv ?? [], borderColor: '#c084fc', backgroundColor: 'rgba(192,132,252,0.08)', tension: 0.3, fill: false, pointRadius: 2, yAxisID: 'y2', hidden: !uvOn },
    ],
  };

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: LEGEND, boxWidth: 12, font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: AXIS, maxTicksLimit: 12 }, grid: { color: GRID } },
      y: { min: 0, ticks: { color: AXIS }, grid: { color: GRID }, title: { display: true, text: '가입자 / 세션', color: AXIS, font: { size: 11 } } },
      y2: { position: 'right', min: 0, ticks: { color: AXIS }, grid: { drawOnChartArea: false }, title: { display: true, text: 'PV / UV', color: AXIS, font: { size: 11 } } },
    },
  };

  return (
    <div className={shell.chartCard}>
      <div className={shell.chartCardHeader}>
        <div className={shell.cardTitle} style={{ marginBottom: 0 }}>활동 통계</div>
        <div className={shell.chartRight}>
          <div className={shell.chartToggles}>
            <label className={shell.toggleLabel}>
              <input type="checkbox" checked={pvOn} onChange={(e) => setPvOn(e.target.checked)} />
              <span style={{ color: '#f0b34a' }}>PV</span>
            </label>
            <label className={shell.toggleLabel}>
              <input type="checkbox" checked={uvOn} onChange={(e) => setUvOn(e.target.checked)} />
              <span style={{ color: '#c084fc' }}>UV</span>
            </label>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>
      </div>
      <div className={shell.chartWrap}>
        <Chart type="bar" data={chartData} options={options} />
      </div>
    </div>
  );
}

/** Safety 위반 추이 — 선 */
export function SafetyChart() {
  const [period, setPeriod] = useState<GraphPeriod>('day');
  const { data } = useSWR(`/api/admin/stats/graph?period=${period}`, graphFetcher);

  const chartData: ChartData = {
    labels: data?.labels ?? [],
    datasets: [
      {
        type: 'line',
        label: 'Safety 위반',
        data: data?.moderation ?? [],
        borderColor: '#e05c5c',
        backgroundColor: 'rgba(224,92,92,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#e05c5c',
      },
    ],
  };

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: LEGEND, font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: AXIS, maxTicksLimit: 12 }, grid: { color: GRID } },
      y: { min: 0, ticks: { color: AXIS, stepSize: 1 }, grid: { color: GRID } },
    },
  };

  return (
    <div className={shell.chartCard}>
      <div className={shell.chartCardHeader}>
        <div className={shell.cardTitle} style={{ marginBottom: 0 }}>Safety 위반 추이</div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      <div className={shell.chartWrap}>
        <Chart type="line" data={chartData} options={options} />
      </div>
    </div>
  );
}

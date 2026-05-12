'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

const NOMINAL_VOLTAGE = 230
const LOW_VOLTAGE = 207
const HIGH_VOLTAGE = 253
const CRITICAL_LOW = 200

type Device = {
  id: string
  name: string
  location: string | null
}

type Reading = {
  recorded_at: string
  voltage: number
}

type ChartPoint = {
  time: string
  timestamp: string
  voltage: number
}

type RangeKey = '6h' | '24h' | '7d'

const RANGE_MS: Record<RangeKey, number> = {
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export default function Home() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [range, setRange] = useState<RangeKey>('24h')
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDevices() {
      const { data } = await supabase
        .from('devices')
        .select('id, name, location')
        .order('location')

      setDevices(data || [])
      if (data?.length) setSelectedDeviceId(data[0].id)
    }

    loadDevices()
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return

    let isMounted = true

    async function loadData(showLoader = false) {
      if (document.hidden) return
      if (showLoader) setLoading(true)

      const since = new Date(Date.now() - RANGE_MS[range]).toISOString()

      const { data: readings } = await supabase
        .from('voltage_readings')
        .select('recorded_at, voltage')
        .eq('device_id', selectedDeviceId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })

      if (!isMounted) return

      const formatted =
        readings?.map((r: Reading) => ({
          timestamp: r.recorded_at,
          time: new Date(r.recorded_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          voltage: r.voltage,
        })) || []

      setData(formatted)
      if (showLoader) setLoading(false)
    }

    loadData(true)

    const interval = setInterval(() => loadData(false), 10_000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [selectedDeviceId, range])

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)
  const latest = data[data.length - 1]

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return data.filter((d) => new Date(d.timestamp).getTime() >= cutoff)
  }, [data])

  const dailyStats = useMemo(() => {
    const values = last24h.map((d) => d.voltage)

    if (!values.length) return { min: null, max: null, avg: null }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    }
  }, [last24h])

  const stabilityScore = useMemo(() => {
    const values = last24h.map((d) => d.voltage)

    if (values.length < 2) return null

    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
      values.length

    const std = Math.sqrt(variance)

    return Math.max(0, Math.min(100, 100 - std * 8)).toFixed(0)
  }, [last24h])

  const oneHourAverage = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000
    const values = data
      .filter((d) => new Date(d.timestamp).getTime() >= cutoff)
      .map((d) => d.voltage)

    if (!values.length) return null

    return values.reduce((a, b) => a + b, 0) / values.length
  }, [data])

  const trendVsHour =
    latest && oneHourAverage !== null ? latest.voltage - oneHourAverage : null

  const voltageStatus =
    !latest
      ? 'unknown'
      : latest.voltage < LOW_VOLTAGE
        ? 'Low'
        : latest.voltage > HIGH_VOLTAGE
          ? 'High'
          : 'Normal'

  const chartLineColor =
    voltageStatus === 'Low'
      ? '#eab308'
      : voltageStatus === 'High'
        ? '#ef4444'
        : '#22c55e'

  function anomalyDot(props: any) {
    const { cx, cy, payload } = props
    const voltage = payload?.voltage

    if (voltage === undefined) return null

    if (voltage < CRITICAL_LOW || voltage > HIGH_VOLTAGE) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="#ef4444"
          stroke="#fff"
          strokeWidth={1}
        />
      )
    }

    if (voltage < LOW_VOLTAGE) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="#eab308"
          stroke="#fff"
          strokeWidth={1}
        />
      )
    }

    return null
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex justify-between items-center mb-4 gap-2">
        <div>
          <h1 className="text-xl font-semibold">Voltage Monitor</h1>
          <div className="text-xs text-gray-500">
            {selectedDevice?.name || '—'}
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-xl text-sm"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.location || d.name}
              </option>
            ))}
          </select>

          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="bg-gray-900 border border-gray-700 px-3 py-2 rounded-xl text-sm"
          >
            <option value="6h">6h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Current voltage</div>
              <div className="text-4xl font-bold">
                {latest ? `${latest.voltage.toFixed(1)} V` : '—'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {latest ? `Updated ${latest.time}` : 'No readings yet'}
              </div>
            </div>

            <div
              className={[
                'px-3 py-1 rounded-full text-sm h-fit',
                voltageStatus === 'Normal' && 'bg-green-500/20 text-green-400',
                voltageStatus === 'Low' && 'bg-yellow-500/20 text-yellow-400',
                voltageStatus === 'High' && 'bg-red-500/20 text-red-400',
                voltageStatus === 'unknown' && 'bg-gray-700 text-gray-300',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {voltageStatus}
            </div>
          </div>

          <div className="mt-4 text-sm">
            {trendVsHour === null ? (
              <span className="text-gray-500">1h trend unavailable</span>
            ) : trendVsHour > 0 ? (
              <span className="text-green-400">
                ↑ +{trendVsHour.toFixed(1)} V vs 1h avg
              </span>
            ) : trendVsHour < 0 ? (
              <span className="text-red-400">
                ↓ {trendVsHour.toFixed(1)} V vs 1h avg
              </span>
            ) : (
              <span className="text-gray-400">No change vs 1h avg</span>
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="text-sm text-gray-400 mb-3">Last 24h summary</div>

          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="text-xs text-gray-500">Min</div>
              <div className="text-yellow-400">
                {dailyStats.min !== null ? `${dailyStats.min.toFixed(1)} V` : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Avg</div>
              <div className="text-green-400">
                {dailyStats.avg !== null ? `${dailyStats.avg.toFixed(1)} V` : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">Max</div>
              <div className="text-red-400">
                {dailyStats.max !== null ? `${dailyStats.max.toFixed(1)} V` : '—'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-5">
          <div className="text-sm text-gray-400 mb-3">Stability</div>

          <div className="text-3xl font-bold">
            {stabilityScore !== null ? `${stabilityScore}%` : '—'}
          </div>

          <div className="text-xs text-gray-500 mt-2">
            Based on 24h voltage deviation
          </div>
        </div>
      </div>

      <div className="-mx-4 bg-gray-900 p-2 shadow-lg outline-none md:mx-0 md:rounded-2xl md:p-4">
        <div className="w-full h-[360px] md:h-[460px] outline-none">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading...
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />

                <ReferenceArea
                  y1={LOW_VOLTAGE}
                  y2={HIGH_VOLTAGE}
                  fill="#22c55e"
                  fillOpacity={0.08}
                />
                <ReferenceArea
                  y1={190}
                  y2={LOW_VOLTAGE}
                  fill="#eab308"
                  fillOpacity={0.1}
                />
                <ReferenceArea
                  y1={HIGH_VOLTAGE}
                  y2={270}
                  fill="#ef4444"
                  fillOpacity={0.1}
                />

                <ReferenceLine y={LOW_VOLTAGE} stroke="#eab308" />
                <ReferenceLine y={HIGH_VOLTAGE} stroke="#ef4444" />
                <ReferenceLine y={NOMINAL_VOLTAGE} stroke="#22c55e" />

                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  interval="preserveStartEnd"
                />

                <YAxis
                  domain={[190, 270]}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  width={32}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  labelStyle={{
                    color: '#9CA3AF',
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="voltage"
                  stroke={chartLineColor}
                  strokeWidth={2}
                  dot={anomalyDot}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </main>
  )
}
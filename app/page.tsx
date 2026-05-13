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

type VoltageEvent = {
  type: 'critical' | 'low' | 'high' | 'normal'
  label: string
  voltage: number
  time: string
}

const RANGE_MS: Record<RangeKey, number> = {
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

function buildEvents(points: ChartPoint[]): VoltageEvent[] {
  const events: VoltageEvent[] = []
  let prev: VoltageEvent['type'] | null = null

  for (const p of points) {
    let type: VoltageEvent['type']
    let label: string

    if (p.voltage < CRITICAL_LOW) {
      type = 'critical'
      label = 'Critical low'
    } else if (p.voltage < LOW_VOLTAGE) {
      type = 'low'
      label = 'Low voltage'
    } else if (p.voltage > HIGH_VOLTAGE) {
      type = 'high'
      label = 'High voltage'
    } else {
      type = 'normal'
      label = 'Back to normal'
    }

    if (type !== prev) {
      if (type !== 'normal' || prev !== null) {
        events.push({ type, label, voltage: p.voltage, time: p.time })
      }

      prev = type
    }
  }

  return events.reverse()
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

    let mounted = true

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

      if (!mounted) return

      setData(
        readings?.map((r: Reading) => ({
          timestamp: r.recorded_at,
          time: new Date(r.recorded_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          voltage: r.voltage,
        })) || []
      )

      if (showLoader) setLoading(false)
    }

    loadData(true)
    const interval = setInterval(() => loadData(false), 10000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [selectedDeviceId, range])

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)
  const latest = data[data.length - 1]
  const events = useMemo(() => buildEvents(data), [data])

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 86400000
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

  const stability = useMemo(() => {
    const values = last24h.map((d) => d.voltage)

    if (values.length < 2) return null

    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
      values.length

    return Math.max(0, 100 - Math.sqrt(variance) * 8).toFixed(0)
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
      ? '#facc15'
      : voltageStatus === 'High'
        ? '#fb7185'
        : '#22c55e'

  function anomalyDot(props: any) {
    const { cx, cy, payload } = props
    const voltage = payload?.voltage

    if (voltage === undefined) return null

    if (voltage < CRITICAL_LOW || voltage > HIGH_VOLTAGE) {
      return <circle cx={cx} cy={cy} r={5} fill="#fb7185" stroke="#fff" strokeWidth={1} />
    }

    if (voltage < LOW_VOLTAGE) {
      return <circle cx={cx} cy={cy} r={4} fill="#facc15" stroke="#fff" strokeWidth={1} />
    }

    return null
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#172554_0%,#020617_42%,#020617_100%)] text-white">
      <div className="w-full px-2 py-5 md:px-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Smart relay monitor
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Voltage Monitor
            </h1>

            <div className="mt-1 text-sm text-slate-400">
              {selectedDevice?.name || 'Loading device...'}
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-white shadow-lg outline-none backdrop-blur focus:border-emerald-400"
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
              className="rounded-2xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-white shadow-lg outline-none backdrop-blur focus:border-emerald-400"
            >
              <option value="6h">6h</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
            </select>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/75 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-slate-400">Current voltage</div>

                <div className="mt-2 text-5xl font-bold tracking-tight">
                  {latest ? `${latest.voltage.toFixed(1)}` : '—'}
                  <span className="ml-2 text-2xl text-slate-400">V</span>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  {latest ? `Updated ${latest.time}` : 'No readings yet'}
                </div>
              </div>

              <div
                className={[
                  'rounded-full px-3 py-1 text-sm font-medium',
                  voltageStatus === 'Normal' &&
                    'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20',
                  voltageStatus === 'Low' &&
                    'bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-400/20',
                  voltageStatus === 'High' &&
                    'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20',
                  voltageStatus === 'unknown' && 'bg-slate-700 text-slate-300',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {voltageStatus}
              </div>
            </div>

            <div className="mt-5 text-sm">
              {trendVsHour === null ? (
                <span className="text-slate-500">1h trend unavailable</span>
              ) : trendVsHour > 0 ? (
                <span className="text-emerald-300">
                  ↑ +{trendVsHour.toFixed(1)} V vs 1h avg
                </span>
              ) : trendVsHour < 0 ? (
                <span className="text-rose-300">
                  ↓ {trendVsHour.toFixed(1)} V vs 1h avg
                </span>
              ) : (
                <span className="text-slate-400">No change vs 1h avg</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/75 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="text-sm text-slate-400">Last 24h summary</div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-slate-500">Min</div>
                <div className="mt-1 text-lg font-semibold text-yellow-300">
                  {dailyStats.min !== null ? `${dailyStats.min.toFixed(1)} V` : '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Avg</div>
                <div className="mt-1 text-lg font-semibold text-emerald-300">
                  {dailyStats.avg !== null ? `${dailyStats.avg.toFixed(1)} V` : '—'}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Max</div>
                <div className="mt-1 text-lg font-semibold text-rose-300">
                  {dailyStats.max !== null ? `${dailyStats.max.toFixed(1)} V` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/75 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="text-sm text-slate-400">Stability</div>

            <div className="mt-3 text-5xl font-bold tracking-tight">
              {stability || '—'}
              <span className="ml-1 text-2xl text-slate-400">%</span>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Based on 24h voltage deviation
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/75 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="mb-3 text-sm text-slate-400">Recent events</div>

            {events.length === 0 ? (
              <div className="text-sm text-slate-500">No events yet</div>
            ) : (
              <div className="space-y-3">
                {events.slice(0, 3).map((event, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <div>
                      <div
                        className={[
                          'text-sm font-medium',
                          event.type === 'critical' && 'text-rose-300',
                          event.type === 'high' && 'text-rose-300',
                          event.type === 'low' && 'text-yellow-300',
                          event.type === 'normal' && 'text-emerald-300',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {event.label}
                      </div>

                      <div className="text-xs text-slate-500">{event.time}</div>
                    </div>

                    <div className="text-sm text-slate-300">
                      {event.voltage.toFixed(1)} V
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/75 p-2 shadow-2xl shadow-black/20 outline-none backdrop-blur md:p-4">
          <div className="h-[370px] w-full outline-none md:h-[520px]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                Loading...
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                No data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
                  style={{ outline: 'none' }}
                >
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />

                  <ReferenceArea y1={LOW_VOLTAGE} y2={HIGH_VOLTAGE} fill="#22c55e" fillOpacity={0.08} />
                  <ReferenceArea y1={190} y2={LOW_VOLTAGE} fill="#facc15" fillOpacity={0.08} />
                  <ReferenceArea y1={HIGH_VOLTAGE} y2={270} fill="#fb7185" fillOpacity={0.08} />

                  <ReferenceLine y={LOW_VOLTAGE} stroke="#facc15" strokeDasharray="4 4" />
                  <ReferenceLine y={HIGH_VOLTAGE} stroke="#fb7185" strokeDasharray="4 4" />
                  <ReferenceLine y={NOMINAL_VOLTAGE} stroke="#22c55e" strokeDasharray="2 2" />

                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: '#475569' }}
                    tickLine={{ stroke: '#475569' }}
                  />

                  <YAxis
                    domain={[190, 270]}
                    width={46}
                    tickMargin={8}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#475569' }}
                    tickLine={{ stroke: '#475569' }}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      border: '1px solid #334155',
                      borderRadius: '14px',
                      color: '#fff',
                      boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />

                  <Line
                    type="monotone"
                    dataKey="voltage"
                    stroke={chartLineColor}
                    strokeWidth={2.5}
                    dot={anomalyDot}
                    activeDot={{
                      r: 6,
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
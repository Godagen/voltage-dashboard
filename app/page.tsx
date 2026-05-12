'use client'

import { useEffect, useState } from 'react'
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
  voltage: number
}

type DailyStats = {
  min: number | null
  max: number | null
  avg: number | null
}

export default function Home() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    min: null,
    max: null,
    avg: null,
  })

  useEffect(() => {
    async function loadDevices() {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, location')
        .order('location')

      if (error) {
        console.error('devices error', error)
        return
      }

      setDevices(data || [])

      if (data && data.length > 0) {
        setSelectedDeviceId(data[0].id)
      }
    }

    loadDevices()
  }, [])

  useEffect(() => {
    if (!selectedDeviceId) return

    let isMounted = true

    async function loadData(showLoader = false) {
      if (showLoader) setLoading(true)

      const { data: readingsData, error: readingsError } = await supabase
        .from('voltage_readings')
        .select('recorded_at, voltage')
        .eq('device_id', selectedDeviceId)
        .order('recorded_at', { ascending: true })
        .limit(200)

      if (readingsError) {
        console.error('readings error', readingsError)
        if (showLoader) setLoading(false)
        return
      }

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: statsData, error: statsError } = await supabase
        .from('voltage_readings')
        .select('voltage')
        .eq('device_id', selectedDeviceId)
        .gte('recorded_at', since24h)

      if (statsError) {
        console.error('daily stats error', statsError)
      }

      if (!isMounted) return

      const formatted =
        readingsData?.map((row: Reading) => ({
          time: new Date(row.recorded_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          voltage: row.voltage,
        })) || []

      setData(formatted)

      const values =
        statsData
          ?.map((row) => row.voltage)
          .filter((value): value is number => value !== null && value !== undefined) || []

      if (values.length > 0) {
        setDailyStats({
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, value) => sum + value, 0) / values.length,
        })
      } else {
        setDailyStats({
          min: null,
          max: null,
          avg: null,
        })
      }

      if (showLoader) setLoading(false)
    }

    loadData(true)

    const intervalId = setInterval(() => {
      loadData(false)
    }, 10 * 1000)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [selectedDeviceId])

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId)

  const latest = data[data.length - 1]
  const previous = data.length > 1 ? data[data.length - 2] : null

  const voltageDelta =
    latest && previous ? latest.voltage - previous.voltage : null

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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold">Voltage Monitor</h1>
            <div className="text-xs text-gray-500">
              {selectedDevice?.name || 'Select device'}
            </div>
          </div>

          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="max-w-[180px] rounded-xl bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
          >
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.location || device.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-2xl p-5 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-400">Current voltage</div>

                  <div className="text-4xl font-bold mt-1">
                    {latest ? `${latest.voltage.toFixed(1)} V` : '—'}
                  </div>

                  <div className="text-sm text-gray-500 mt-1">
                    {latest ? `Updated ${latest.time}` : 'No readings yet'}
                  </div>
                </div>

                <div
                  className={[
                    'rounded-full px-3 py-1 text-sm font-semibold',
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
                {voltageDelta === null ? (
                  <span className="text-gray-500">Trend unavailable</span>
                ) : voltageDelta > 0 ? (
                  <span className="text-green-400">
                    ↑ +{voltageDelta.toFixed(1)} V
                  </span>
                ) : voltageDelta < 0 ? (
                  <span className="text-red-400">
                    ↓ {voltageDelta.toFixed(1)} V
                  </span>
                ) : (
                  <span className="text-gray-400">No change</span>
                )}
              </div>

              <div className="text-xs text-gray-500 mt-3">
                Normal range: {LOW_VOLTAGE}–{HIGH_VOLTAGE} V, nominal{' '}
                {NOMINAL_VOLTAGE} V
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 shadow-lg">
              <div className="text-sm text-gray-400 mb-3">
                Last 24h summary
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Min</div>
                  <div className="text-lg font-semibold text-yellow-400">
                    {dailyStats.min !== null ? `${dailyStats.min.toFixed(1)} V` : '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Avg</div>
                  <div className="text-lg font-semibold text-green-400">
                    {dailyStats.avg !== null ? `${dailyStats.avg.toFixed(1)} V` : '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Max</div>
                  <div className="text-lg font-semibold text-red-400">
                    {dailyStats.max !== null ? `${dailyStats.max.toFixed(1)} V` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 shadow-lg">
            <div className="w-full h-[320px] md:h-[460px]">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Loading...
                </div>
              ) : data.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No data
                </div>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

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

                    <ReferenceLine
                      y={LOW_VOLTAGE}
                      stroke="#eab308"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={HIGH_VOLTAGE}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={NOMINAL_VOLTAGE}
                      stroke="#22c55e"
                      strokeDasharray="2 2"
                    />

                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    />

                    <YAxis
                      domain={[190, 270]}
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="voltage"
                      stroke={chartLineColor}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
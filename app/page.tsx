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
} from 'recharts'

type Device = {
  id: string
  name: string
  location: string | null
}

type Reading = {
  recorded_at: string
  voltage: number
}

export default function Home() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // load devices
  useEffect(() => {
    async function loadDevices() {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, location')
        .order('name')

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

  // load readings
  useEffect(() => {
    if (!selectedDeviceId) return

    async function loadReadings() {
      setLoading(true)

      const { data, error } = await supabase
        .from('voltage_readings')
        .select('recorded_at, voltage')
        .eq('device_id', selectedDeviceId)
        .order('recorded_at', { ascending: true })
        .limit(200)

      if (error) {
        console.error('readings error', error)
        setLoading(false)
        return
      }

      const formatted =
        data?.map((row: Reading) => ({
          time: new Date(row.recorded_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          voltage: row.voltage,
        })) || []

      setData(formatted)
      setLoading(false)
    }

    loadReadings()
  }, [selectedDeviceId])

  const selectedDevice = devices.find(d => d.id === selectedDeviceId)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <h1 className="text-xl font-semibold text-center mb-4">
        Voltage Monitor
      </h1>

      {/* Device selector */}
      <div className="mb-4">
        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} {d.location ? `— ${d.location}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Current device info */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-4">
        <div className="text-sm text-gray-400">Device</div>
        <div className="text-lg font-semibold">
          {selectedDevice?.name || 'Loading...'}
        </div>
        <div className="text-sm text-gray-500">
          {selectedDevice?.location}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-2xl p-3 shadow-lg">
        <div className="w-full h-64">
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

                <XAxis
                  dataKey="time"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                />

                <YAxis
                  domain={['auto', 'auto']}
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
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </main>
  )
}
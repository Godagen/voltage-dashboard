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

type Row = {
  recorded_at: string
  voltage: number
}

export default function Home() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('voltage_readings')
        .select('recorded_at, voltage')
        .order('recorded_at', { ascending: true })
        .limit(200)

      if (error) {
        console.error(error)
        return
      }

      const formatted =
        data?.map((row: Row) => ({
          time: new Date(row.recorded_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          voltage: row.voltage,
        })) || []

      setData(formatted)
    }

    load()
  }, [])

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4">
      <h1 className="text-xl font-semibold mb-4 text-center">
        Voltage Monitor
      </h1>

      <div className="bg-gray-900 rounded-2xl p-3 shadow-lg">
        <div className="w-full h-64">
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
        </div>
      </div>
    </main>
  )
}
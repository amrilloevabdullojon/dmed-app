'use client'

interface BarChartProps {
  data: Array<{ label: string; value: number }>
  height?: number
  color?: string
  showValues?: boolean
}

export function BarChart({ data, height = 300, color = '#3B82F6', showValues = true }: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Нет данных для отображения
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const barWidth = 100 / data.length

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <div className="flex items-end justify-between h-full gap-1">
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 100

          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              {/* Bar */}
              <div className="w-full flex flex-col items-center justify-end flex-1">
                {showValues && item.value > 0 && (
                  <span className="text-xs font-medium text-gray-300 mb-1">{item.value}</span>
                )}
                <div
                  className="w-full rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    minHeight: item.value > 0 ? '4px' : '0',
                  }}
                  title={`${item.label}: ${item.value}`}
                />
              </div>

              {/* Label */}
              <span className="text-xs text-gray-400 text-center truncate w-full px-1">
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

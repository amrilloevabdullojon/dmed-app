'use client'

interface PieChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  size?: number
  showLegend?: boolean
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
  '#14B8A6', // teal
]

export function PieChart({ data, size = 200, showLegend = true }: PieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Нет данных для отображения
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Нет данных для отображения
      </div>
    )
  }

  const center = size / 2
  const radius = size / 2 - 10

  let currentAngle = -90 // Начинаем сверху

  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100
    const angle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle

    currentAngle = endAngle

    // Вычисляем координаты для SVG path
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = center + radius * Math.cos(startRad)
    const y1 = center + radius * Math.sin(startRad)
    const x2 = center + radius * Math.cos(endRad)
    const y2 = center + radius * Math.sin(endRad)

    const largeArc = angle > 180 ? 1 : 0

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ')

    const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

    return {
      pathData,
      color,
      label: item.label,
      value: item.value,
      percentage: percentage.toFixed(1),
    }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pie Chart */}
      <svg width={size} height={size} className="transform hover:scale-105 transition-transform">
        {slices.map((slice, index) => (
          <g key={index}>
            <path
              d={slice.pathData}
              fill={slice.color}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            >
              <title>
                {slice.label}: {slice.value} ({slice.percentage}%)
              </title>
            </path>
          </g>
        ))}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="grid grid-cols-2 gap-2 w-full">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-300 truncate">{slice.label}</div>
                <div className="text-xs text-gray-500">
                  {slice.value} ({slice.percentage}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

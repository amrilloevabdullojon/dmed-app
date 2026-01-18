'use client'

interface LineChartProps {
  data: Array<{ label: string; value: number }>
  height?: number
  color?: string
  fillColor?: string
}

export function LineChart({
  data,
  height = 300,
  color = '#3B82F6',
  fillColor = 'rgba(59, 130, 246, 0.1)',
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Нет данных для отображения
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const minValue = Math.min(...data.map((d) => d.value), 0)
  const range = maxValue - minValue || 1

  const width = 100
  const padding = 5
  const chartHeight = height - 40 // Оставляем место для подписей

  // Генерируем точки для линии
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * (width - 2 * padding) + padding
    const y =
      chartHeight - ((item.value - minValue) / range) * (chartHeight - 2 * padding) - padding

    return { x, y, value: item.value, label: item.label }
  })

  // Создаём path для линии
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // Создаём path для заливки области под линией
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none">
        {/* Заливка области */}
        <path d={areaPath} fill={fillColor} />

        {/* Линия */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="0.5" />

        {/* Точки */}
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r="0.8" fill={color} />
            <title>
              {point.label}: {point.value}
            </title>
          </g>
        ))}
      </svg>

      {/* Подписи */}
      <div className="flex justify-between mt-2">
        {data.map((item, index) => {
          // Показываем только некоторые подписи, чтобы не было overlap
          const showLabel =
            data.length <= 7 || index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 7) === 0

          return (
            <div key={index} className="flex-1 text-center">
              {showLabel && <span className="text-xs text-gray-400">{item.label}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

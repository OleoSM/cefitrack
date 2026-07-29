// Gráfica de barras de promedio por materia (Chart.js).
// Barras con degradado vertical, esquinas redondeadas, etiqueta directa del
// valor sobre cada barra y línea punteada del promedio general.
import { useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/* Línea punteada horizontal con el promedio general del alumno */
const avgLinePlugin = {
  id: 'avgLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts?.value == null) return
    const { ctx, chartArea, scales: { y } } = chart
    const yPos = y.getPixelForValue(opts.value)
    if (yPos < chartArea.top || yPos > chartArea.bottom) return
    ctx.save()
    ctx.strokeStyle = opts.color
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(chartArea.left, yPos)
    ctx.lineTo(chartArea.right, yPos)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '600 10px sans-serif'
    ctx.fillStyle = opts.color
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`Promedio general ${opts.value}`, chartArea.right, yPos - 4)
    ctx.restore()
  },
}

export default function MateriaBarChart({ stats, colorOf, t, avg }) {
  // stats: [{ materia, promedio, count }]
  const data = useMemo(() => ({
    labels: stats.map(m => m.materia),
    datasets: [{
      data: stats.map(m => m.promedio),
      backgroundColor: (ctx) => {
        const { chart, dataIndex } = ctx
        const { ctx: c, chartArea } = chart
        const color = colorOf(stats[dataIndex]?.materia)
        if (!chartArea) return hexToRgba(color, .75)
        const g = c.createLinearGradient(0, chartArea.bottom, 0, chartArea.top)
        g.addColorStop(0, hexToRgba(color, .18))
        g.addColorStop(1, hexToRgba(color, .85))
        return g
      },
      hoverBackgroundColor: (ctx) => hexToRgba(colorOf(stats[ctx.dataIndex]?.materia), .95),
      borderColor: (ctx) => hexToRgba(colorOf(stats[ctx.dataIndex]?.materia), .9),
      borderWidth: { top: 0, left: 0, right: 0, bottom: 0 },
      borderRadius: { topLeft: 6, topRight: 6 },
      borderSkipped: 'bottom',
      maxBarThickness: 46,
      categoryPercentage: 0.62,
    }],
  }), [stats, colorOf])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 18 } },
    scales: {
      y: {
        min: 0, max: 10,
        border: { display: false },
        ticks: { stepSize: 2, color: t.axis, font: { size: 11 } },
        grid: { color: t.grid, tickLength: 0, lineWidth: 1 },
      },
      x: {
        border: { display: false },
        ticks: { color: t.axis, font: { size: 11, weight: 600 } },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        borderWidth: 1,
        titleColor: t.tooltipText,
        bodyColor: t.tooltipText,
        titleFont: { size: 12, weight: 700 },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const m = stats[item.dataIndex]
            return [`Promedio: ${m.promedio}`, `${m.count} evaluacion${m.count !== 1 ? 'es' : ''}`]
          },
        },
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        offset: 2,
        color: t.t1,
        font: { size: 12, weight: 700 },
        formatter: v => v.toFixed(1),
      },
      avgLine: { value: avg, color: t.t4 },
    },
  }), [stats, t, avg])

  return (
    <div style={{ height: 250 }}>
      <Bar data={data} options={options} plugins={[ChartDataLabels, avgLinePlugin]}/>
    </div>
  )
}

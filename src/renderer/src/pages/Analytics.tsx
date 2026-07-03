import React, { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar
} from 'recharts'
import { TrendingUp, Award, Clock, Sparkles, Download, Flame, LayoutGrid } from 'lucide-react'
import { useModalStore } from '../stores/modalStore'

interface SummaryStats {
  totalNotes: number
  totalTasks: number
  completedTasks: number
  totalFiles: number
}

export default function Analytics(): React.JSX.Element {
  const { openModal } = useModalStore()
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week')
  const [stats, setStats] = useState<any>(null)
  const [summary, setSummary] = useState<SummaryStats>({
    totalNotes: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalFiles: 0
  })

  const [llmInsight, setLlmInsight] = useState<string>(
    'Generating weekly cognitive insights locally...'
  )
  const [isLlmLoading, setIsLlmLoading] = useState(false)

  const loadStats = async () => {
    try {
      const rangeDays = timeRange === 'week' ? 7 : 30
      const res = await window.api.analytics.getStats(rangeDays)
      setStats(res)
      setSummary(res.summary)
    } catch (e) {
      console.error('Failed to load analytics statistics:', e)
    }
  }

  const generateLLMInsights = async () => {
    if (isLlmLoading) return
    setIsLlmLoading(true)
    try {
      const prompt = `Here are my productivity stats over the past period:
- Notes created: ${summary.totalNotes}
- Tasks completed: ${summary.completedTasks} out of ${summary.totalTasks}
- Files indexed: ${summary.totalFiles}

Provide exactly two brief, actionable productivity tips (one sentence each) based on these numbers. Keep the tone encouraging.`

      // We use a temporary chat session (or summarize hook) to get suggestions
      const response = await window.api.llm.summarize(prompt)
      setLlmInsight(response || 'Maintain a steady focus flow by completing subtasks early.')
    } catch (err) {
      console.warn('Local LLM suggestions failed, falling back to rule-based engine:', err)
      // Fallback
      setLlmInsight(
        'Great job! You are maintaining a steady focus rate. Try breaking tasks down to increase completion speeds.'
      )
    } finally {
      setIsLlmLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [timeRange])

  useEffect(() => {
    if (summary.totalNotes > 0 || summary.totalTasks > 0) {
      generateLLMInsights()
    }
  }, [summary])

  const handleExport = (): void => {
    openModal('export')
  }

  // Helper to render calendar heatmap contribution boxes
  const renderContributionHeatmap = () => {
    if (!stats || !stats.heatmap) return null

    const daysCount = 365
    const heatmapMap = new Map<string, number>()
    stats.heatmap.forEach((h: any) => {
      heatmapMap.set(h.date, h.count)
    })

    const cells: React.JSX.Element[] = []
    const now = new Date()

    for (let i = daysCount; i >= 0; i--) {
      const date = new Date(now.getTime())
      date.setDate(now.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const count = heatmapMap.get(dateStr) || 0

      // Color intensity
      let bgColor = 'rgba(255, 255, 255, 0.03)' // 0
      if (count > 0 && count <= 2) bgColor = 'rgba(52, 152, 219, 0.2)'
      if (count > 2 && count <= 5) bgColor = 'rgba(52, 152, 219, 0.5)'
      if (count > 5) bgColor = 'rgba(52, 152, 219, 0.85)'

      cells.push(
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: bgColor,
            cursor: 'pointer'
          }}
          title={`${date.toLocaleDateString()}: ${count} activity updates`}
        />
      )
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'repeat(7, 10px)',
          gridAutoFlow: 'column',
          gap: 3,
          overflowX: 'auto',
          padding: '10px 0'
        }}
      >
        {cells}
      </div>
    )
  }

  const defaultTimelineData = [
    { name: 'Mon', focusTime: 0.5, tasksDone: 0 },
    { name: 'Tue', focusTime: 0.5, tasksDone: 0 },
    { name: 'Wed', focusTime: 0.5, tasksDone: 0 }
  ]

  const defaultSkillData = [
    { subject: 'Writing', A: 50, fullMark: 100 },
    { subject: 'Coding', A: 60, fullMark: 100 },
    { subject: 'Planning', A: 40, fullMark: 100 }
  ]

  const timelineData = stats?.timeline?.length ? stats.timeline : defaultTimelineData
  const skillData = stats?.skills?.length ? stats.skills : defaultSkillData

  return (
    <div className="flex flex-col gap-4" style={{ paddingBottom: 24 }}>
      {/* Analytics Summary Stats Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div
          className="card flex items-center justify-between"
          style={{ padding: '16px 20px', borderRadius: 8 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="input-label" style={{ margin: 0 }}>
              TOTAL NOTES
            </span>
            <span style={{ fontSize: '24px', fontWeight: 700 }} className="font-mono">
              {summary.totalNotes}
            </span>
          </div>
          <LayoutGrid size={24} className="text-secondary" style={{ opacity: 0.5 }} />
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ padding: '16px 20px', borderRadius: 8 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="input-label" style={{ margin: 0 }}>
              INDEXED FILES
            </span>
            <span style={{ fontSize: '24px', fontWeight: 700 }} className="font-mono">
              {summary.totalFiles}
            </span>
          </div>
          <Clock size={24} className="text-accent" style={{ opacity: 0.5 }} />
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ padding: '16px 20px', borderRadius: 8 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="input-label" style={{ margin: 0 }}>
              TASKS COMPLETED
            </span>
            <span style={{ fontSize: '24px', fontWeight: 700 }} className="font-mono">
              {summary.completedTasks}
            </span>
          </div>
          <TrendingUp size={24} className="text-success" style={{ opacity: 0.5 }} />
        </div>

        <div
          className="card flex items-center justify-between"
          style={{ padding: '16px 20px', borderRadius: 8 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="input-label" style={{ margin: 0 }}>
              COMPLETION RATE
            </span>
            <span style={{ fontSize: '24px', fontWeight: 700 }} className="font-mono">
              {summary.totalTasks > 0
                ? `${Math.round((summary.completedTasks / summary.totalTasks) * 100)}%`
                : '0%'}
            </span>
          </div>
          <Flame size={24} className="text-error animate-pulse" style={{ opacity: 0.5 }} />
        </div>
      </div>

      {/* Analytics Toolbar */}
      <div
        className="card flex justify-between items-center"
        style={{ padding: 12, borderRadius: 8 }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setTimeRange('week')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: timeRange === 'week' ? 'var(--bg-surface)' : 'transparent',
              color: timeRange === 'week' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            This Week
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setTimeRange('month')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: timeRange === 'month' ? 'var(--bg-surface)' : 'transparent',
              color: timeRange === 'month' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            This Month
          </button>
        </div>

        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
          onClick={handleExport}
        >
          <Download size={14} />
          <span>Export Analytics</span>
        </button>
      </div>

      {/* Energy Heatmap Contribution Grid */}
      <div className="card flex flex-col gap-4" style={{ padding: '16px 20px', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="font-semibold flex items-center gap-2">
            <Flame size={18} className="text-error" />
            <span>Daily Activity Energy Heatmap (Past Year)</span>
          </h4>
          <div
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '10px' }}
            className="text-muted"
          >
            <span>Less</span>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.03)'
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: 'rgba(52, 152, 219, 0.2)'
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: 'rgba(52, 152, 219, 0.5)'
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                backgroundColor: 'rgba(52, 152, 219, 0.85)'
              }}
            />
            <span>More</span>
          </div>
        </div>

        {renderContributionHeatmap()}
      </div>

      {/* Main charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* 1. Productivity Timeline Area Chart */}
        <div className="card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold flex items-center gap-2">
              <Clock size={18} className="text-muted" />
              <span>Focus Hours & Productivity Timeline</span>
            </h4>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-main)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="focusTime"
                  stroke="var(--color-secondary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFocus)"
                  name="Focus Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Capability Radar Chart */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Award size={18} className="text-muted" />
            <span>Skill Capability Mapping (Top Tags)</span>
          </h4>

          <div
            style={{
              width: '100%',
              height: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillData}>
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" fontSize={11} />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  stroke="var(--border-color)"
                  fontSize={9}
                />
                <Radar
                  name="Tags usage"
                  dataKey="A"
                  stroke="var(--color-accent)"
                  fill="var(--color-accent)"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* 3. Tasks Done Bar Chart */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <TrendingUp size={18} className="text-muted" />
            <span>Tasks Completed</span>
          </h4>

          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-main)'
                  }}
                />
                <Bar
                  dataKey="tasksDone"
                  fill="var(--color-success)"
                  radius={[4, 4, 0, 0]}
                  name="Completed Tasks"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Automated Insights Panel */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles
              size={18}
              className="text-muted animate-pulse"
              style={{ color: 'var(--color-accent)' }}
            />
            <span>Local AI Cognitive Insights</span>
          </h4>

          <div className="flex flex-col gap-3" style={{ fontSize: '13px' }}>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 16,
                borderRadius: 8,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)'
              }}
            >
              {isLlmLoading ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid var(--border-color)',
                    borderTopColor: 'var(--color-secondary)',
                    animation: 'spin 1s linear infinite'
                  }}
                />
              ) : (
                <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>[COGNITIVE]</div>
              )}
              <div
                style={{
                  flex: 1,
                  color: isLlmLoading ? 'var(--text-muted)' : 'var(--text-main)',
                  fontStyle: 'italic'
                }}
              >
                "{llmInsight}"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

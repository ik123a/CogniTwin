import React, { useEffect, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  Cpu,
  TrendingUp,
  Activity,
  Award,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react'

interface ProjectRow {
  id: string
  name: string
}

interface SavedDecision {
  id: string
  title: string
  description: string | null
  recommended_option: string | null
  created_at: string
  options_json: string
  factors_json: string
}

export default function Simulation(): React.JSX.Element {
  const [activeSubTab, setActiveSubTab] = useState<'markov' | 'monte-carlo' | 'bayesian'>('markov')
  const [projects, setProjects] = useState<ProjectRow[]>([])

  // Markov states
  const [markovMatrix, setMarkovMatrix] = useState<any>(null)
  const [markovForecast, setMarkovForecast] = useState<any[]>([])
  const [markovLoading, setMarkovLoading] = useState(false)

  // Monte Carlo states
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [runsCount, setRunsCount] = useState<number>(1000)
  const [mcResult, setMcResult] = useState<any>(null)
  const [mcLoading, setMcLoading] = useState(false)

  // Bayesian decision states
  const [decisionsList, setDecisionsList] = useState<SavedDecision[]>([])
  const [decisionTitle, setDecisionTitle] = useState('')
  const [decisionDesc, setDecisionDesc] = useState('')

  // Initial templates for factors and options
  const [factors, setFactors] = useState<Array<{ name: string; weight: number }>>([
    { name: 'ROI & Value Impact', weight: 4 },
    { name: 'Urgency & Time Constraints', weight: 2 },
    { name: 'Technical Risk & Bugs', weight: -3 },
    { name: 'Effort & Implementation Time', weight: -2 }
  ])
  const [options, setOptions] = useState<
    Array<{ name: string; factorRatings: Record<string, number> }>
  >([
    {
      name: 'Option A (Quick Fix)',
      factorRatings: {
        'ROI & Value Impact': 4,
        'Urgency & Time Constraints': 9,
        'Technical Risk & Bugs': 2,
        'Effort & Implementation Time': 3
      }
    },
    {
      name: 'Option B (Refactor Properly)',
      factorRatings: {
        'ROI & Value Impact': 9,
        'Urgency & Time Constraints': 3,
        'Technical Risk & Bugs': 8,
        'Effort & Implementation Time': 8
      }
    }
  ])
  const [solvingResult, setSolvingResult] = useState<any>(null)

  // Load basic configurations and project lists
  const loadProjects = async () => {
    try {
      const list = await window.api.db.query('SELECT id, name FROM projects')
      setProjects(list)
    } catch (e) {
      console.error(e)
    }
  }

  const loadDecisions = async () => {
    try {
      const list = await window.api.simulation.decisionList()
      setDecisionsList(list)
    } catch (e) {
      console.error(e)
    }
  }

  // Run Markov Simulation
  const runMarkovSim = async () => {
    setMarkovLoading(true)
    try {
      const res = await window.api.simulation.markovForecast()
      setMarkovMatrix(res.matrix)
      setMarkovForecast(res.forecast)
    } catch (e) {
      console.error(e)
    } finally {
      setMarkovLoading(false)
    }
  }

  // Run Monte Carlo Simulation
  const runMonteCarloSim = async () => {
    setMcLoading(true)
    try {
      const pId = selectedProjectId === 'all' ? null : selectedProjectId
      const res = await window.api.simulation.monteCarlo(pId, runsCount)
      setMcResult(res)
    } catch (e) {
      console.error(e)
    } finally {
      setMcLoading(false)
    }
  }

  // Bayesian decision handlers
  const handleAddFactor = () => {
    const name = prompt('Enter criteria/factor name (e.g. Security, Cost):')
    if (!name) return
    setFactors((prev) => [...prev, { name, weight: 1 }])
    setOptions((prev) =>
      prev.map((opt) => ({
        ...opt,
        factorRatings: { ...opt.factorRatings, [name]: 5 }
      }))
    )
  }

  const handleAddOption = () => {
    const name = prompt('Enter option name (e.g. AWS Cloud, Local Storage):')
    if (!name) return
    const initialRatings: Record<string, number> = {}
    factors.forEach((f) => {
      initialRatings[f.name] = 5
    })
    setOptions((prev) => [...prev, { name, factorRatings: initialRatings }])
  }

  const handleRatingChange = (optIdx: number, factorName: string, val: number) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i === optIdx) {
          return {
            ...opt,
            factorRatings: {
              ...opt.factorRatings,
              [factorName]: val
            }
          }
        }
        return opt
      })
    )
  }

  const handleFactorWeightChange = (factIdx: number, val: number) => {
    setFactors((prev) =>
      prev.map((fact, i) => {
        if (i === factIdx) {
          return { ...fact, weight: val }
        }
        return fact
      })
    )
  }

  const handleSolveDecision = async () => {
    if (!decisionTitle.trim()) {
      alert('Please specify a title for this decision evaluation.')
      return
    }
    try {
      const res = await window.api.simulation.decisionSave(
        decisionTitle,
        decisionDesc,
        options,
        factors
      )
      setSolvingResult(res)
      loadDecisions()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteDecision = async (id: string) => {
    if (!confirm('Are you sure you want to delete this decision?')) return
    try {
      const res = await window.api.simulation.decisionDelete(id)
      if (res.success) {
        loadDecisions()
        if (solvingResult?.id === id) {
          setSolvingResult(null)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadProjects()
    loadDecisions()
    runMarkovSim()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      {/* Title */}
      <div>
        <h3 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
          Advanced Digital Twin Simulation
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Compute state transitions, outcome forecast vectors, and structured decision intelligence
          locally.
        </p>
      </div>

      {/* Sub tabs selector */}
      <div
        className="card flex"
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          display: 'flex',
          gap: 8,
          width: 'fit-content'
        }}
      >
        {[
          { id: 'markov', label: 'Behavioral Clone (Markov)', icon: Activity },
          { id: 'monte-carlo', label: 'Outcome Forecast (Monte Carlo)', icon: TrendingUp },
          { id: 'bayesian', label: 'Decision Optimizer (Bayesian)', icon: Award }
        ].map((t) => {
          const Icon = t.icon
          const isActive = activeSubTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as any)}
              className="btn btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                fontSize: '13px',
                backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                borderRadius: 6
              }}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content 1: Markov */}
      {activeSubTab === 'markov' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Markov explanation & controls */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Activity size={18} style={{ color: 'var(--color-secondary)' }} />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                  Behavior State Transition Matrix
                </h4>
              </div>
              <button
                onClick={runMarkovSim}
                disabled={markovLoading}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
              >
                <RefreshCw size={14} className={markovLoading ? 'animate-spin' : ''} />
                <span>Re-Train Markov Model</span>
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              The twin uses Markov transition probabilities derived from your local audit logs to
              build a predictive cloning model of your state sequence changes.
            </p>

            {markovMatrix && (
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th
                        style={{ textAlign: 'left', padding: '10px', color: 'var(--text-muted)' }}
                      >
                        FROM STATE
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          backgroundColor: 'rgba(52, 152, 219, 0.05)',
                          color: '#fff'
                        }}
                      >
                        Focus Working
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          backgroundColor: 'rgba(46, 204, 113, 0.05)',
                          color: '#fff'
                        }}
                      >
                        Rest/Break
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          backgroundColor: 'rgba(155, 89, 182, 0.05)',
                          color: '#fff'
                        }}
                      >
                        Comm Triage
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          backgroundColor: 'rgba(230, 126, 34, 0.05)',
                          color: '#fff'
                        }}
                      >
                        Meetings
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          color: '#fff'
                        }}
                      >
                        Idle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { state: 'Focus Working', color: '#3498db' },
                      { state: 'Resting/Break', color: '#2ecc71' },
                      { state: 'Communications Triage', color: '#9b59b6' },
                      { state: 'Meetings', color: '#e67e22' },
                      { state: 'Idle', color: '#7f8c8d' }
                    ].map((row) => (
                      <tr
                        key={row.state}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                          <span style={{ color: row.color, marginRight: 6 }}>●</span> {row.state}
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        >
                          {(markovMatrix[row.state]?.['Focus Working'] * 100).toFixed(1)}%
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        >
                          {(markovMatrix[row.state]?.['Resting/Break'] * 100).toFixed(1)}%
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        >
                          {(markovMatrix[row.state]?.['Communications Triage'] * 100).toFixed(1)}%
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        >
                          {(markovMatrix[row.state]?.['Meetings'] * 100).toFixed(1)}%
                        </td>
                        <td
                          style={{
                            padding: '12px 10px',
                            textAlign: 'center',
                            fontFamily: 'monospace'
                          }}
                        >
                          {(markovMatrix[row.state]?.['Idle'] * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 24-hour visual state forecast */}
          <div className="card flex flex-col gap-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} style={{ color: 'var(--color-accent)' }} />
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Simulated 24-Hour Behavioral Timeline Forecast
              </h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Based on your transition matrix and current state, this is the simulated future
              sequence path over the next 24 hours.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {markovForecast.map((f, i) => {
                let bg = 'rgba(255,255,255,0.03)'
                let color = 'var(--text-muted)'
                if (f.state === 'Focus Working') {
                  bg = 'rgba(52, 152, 219, 0.15)'
                  color = '#3498db'
                } else if (f.state === 'Resting/Break') {
                  bg = 'rgba(46, 204, 113, 0.15)'
                  color = '#2ecc71'
                } else if (f.state === 'Communications Triage') {
                  bg = 'rgba(155, 89, 182, 0.15)'
                  color = '#9b59b6'
                } else if (f.state === 'Meetings') {
                  bg = 'rgba(230, 126, 34, 0.15)'
                  color = '#e67e22'
                } else if (f.state === 'Idle') {
                  bg = 'rgba(255, 255, 255, 0.08)'
                  color = '#fff'
                }

                return (
                  <div
                    key={i}
                    style={{
                      flex: '1 0 80px',
                      padding: '10px 8px',
                      borderRadius: 8,
                      backgroundColor: bg,
                      border: `1px solid ${color}40`,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                      {f.hour}:00
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {f.state.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Monte Carlo */}
      {activeSubTab === 'monte-carlo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Controls card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={18} style={{ color: 'var(--color-secondary)' }} />
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Monte Carlo Project Path Simulator
              </h4>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Estimates project delivery timelines by performing 1000 pathway runs with variable
              task complexity and cognitive energy depletion bounds.
            </p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'end', marginTop: 8 }}>
              <div className="input-group" style={{ flex: 1 }}>
                <span className="input-label">SELECT TARGET PROJECT</span>
                <select
                  className="input-field"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="all">All Projects & Tasks</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ width: 140 }}>
                <span className="input-label">SIMULATION RUNS</span>
                <select
                  className="input-field"
                  value={runsCount}
                  onChange={(e) => setRunsCount(Number(e.target.value))}
                >
                  <option value={500}>500 runs</option>
                  <option value={1000}>1000 runs</option>
                  <option value={2000}>2000 runs</option>
                </select>
              </div>

              <button
                onClick={runMonteCarloSim}
                disabled={mcLoading}
                className="btn btn-primary"
                style={{
                  height: '38px',
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                {mcLoading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <TrendingUp size={14} />
                )}
                <span>Run Simulator</span>
              </button>
            </div>
          </div>

          {/* Results Display */}
          {mcResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
              {/* Left stats panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card flex flex-col gap-4">
                  <h5
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-muted)'
                    }}
                  >
                    MEAN COMPLETION TIME
                  </h5>
                  <span
                    style={{ fontSize: '32px', fontWeight: 700 }}
                    className="font-mono text-secondary"
                  >
                    {mcResult.meanDays} Days
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4
                    }}
                  >
                    The average simulated calendar days to complete all remaining tasks.
                  </p>
                </div>

                <div className="card flex flex-col gap-4">
                  <h5
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-muted)'
                    }}
                  >
                    90% PROBABILITY BOUND
                  </h5>
                  <span
                    style={{ fontSize: '32px', fontWeight: 700 }}
                    className="font-mono text-accent"
                  >
                    {mcResult.confidence90} Days
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4
                    }}
                  >
                    Highly confident (90% chance) that the project will compile and complete in this
                    duration or less.
                  </p>
                </div>

                <div className="card flex flex-col gap-4">
                  <h5
                    style={{
                      margin: 0,
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-muted)'
                    }}
                  >
                    SIMULATION RISK RATING
                  </h5>
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color:
                        mcResult.riskFactor === 'High'
                          ? 'var(--color-error)'
                          : mcResult.riskFactor === 'Medium'
                            ? 'var(--color-warning)'
                            : 'var(--color-success)'
                    }}
                  >
                    ● {mcResult.riskFactor} Risk
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.4
                    }}
                  >
                    Risk assessment calculated from duration variance and backlog scale.
                  </p>
                </div>
              </div>

              {/* Right chart panel */}
              <div className="card flex flex-col gap-4">
                <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                  Cumulative Probability Curve
                </h5>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  This curve displays the likelihood (Y-axis) that all tasks are finished within a
                  given calendar day threshold (X-axis).
                </p>

                <div style={{ width: '100%', height: 260, marginTop: 12 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={mcResult.chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="mcProb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis
                        dataKey="days"
                        stroke="var(--text-muted)"
                        fontSize={11}
                        label={{ value: 'Days', position: 'insideBottomRight', offset: -5 }}
                      />
                      <YAxis stroke="var(--text-muted)" fontSize={11} domain={[0, 100]} />
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
                        dataKey="cumulative"
                        stroke="var(--color-secondary)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#mcProb)"
                        name="Likelihood %"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {!mcResult && !mcLoading && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px dashed rgba(255,255,255,0.08)',
                borderRadius: 12
              }}
            >
              <TrendingUp
                size={36}
                style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }}
              />
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                Ready to run Monte Carlo forecast. Select a project and click "Run Simulator".
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 3: Bayesian Decision */}
      {activeSubTab === 'bayesian' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, width: '100%' }}>
          {/* Saved decisions list left panel */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              paddingRight: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Saved Evaluations</h5>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: '420px',
                overflowY: 'auto'
              }}
            >
              {decisionsList.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No decisions optimized yet.
                </span>
              ) : (
                decisionsList.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setDecisionTitle(d.title)
                      setDecisionDesc(d.description || '')
                      setOptions(JSON.parse(d.options_json))
                      setFactors(JSON.parse(d.factors_json))
                      setSolvingResult({
                        id: d.id,
                        recommendedOption: d.recommended_option,
                        rankings: [] // Can solve again easily
                      })
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          color: '#fff',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {d.title}
                      </span>
                      <span
                        style={{ fontSize: '11px', color: 'var(--color-success)', fontWeight: 600 }}
                      >
                        ★ {d.recommended_option}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteDecision(d.id)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#e74c3c',
                        padding: 4,
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Builder area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <span className="input-label">DECISION SUBJECT / TITLE</span>
              <input
                type="text"
                placeholder="e.g. Choose Database Platform"
                className="input-field"
                value={decisionTitle}
                onChange={(e) => setDecisionTitle(e.target.value)}
              />
            </div>

            <div className="input-group">
              <span className="input-label">DESCRIPTION (OPTIONAL)</span>
              <input
                type="text"
                placeholder="Describe options scope..."
                className="input-field"
                value={decisionDesc}
                onChange={(e) => setDecisionDesc(e.target.value)}
              />
            </div>

            {/* Criteria Factors section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  1. Evaluation Criteria & Utility Weights
                </h5>
                <button
                  onClick={handleAddFactor}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Plus size={12} />
                  <span>Add Criteria</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {factors.map((fact, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{fact.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Weight:</span>
                      <input
                        type="number"
                        min="-10"
                        max="10"
                        style={{
                          width: 44,
                          padding: 2,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          borderRadius: 4,
                          fontSize: '11px',
                          textAlign: 'center'
                        }}
                        value={fact.weight}
                        onChange={(e) => handleFactorWeightChange(idx, Number(e.target.value))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options ratings grid */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                  2. Score Options (1 to 10 scale)
                </h5>
                <button
                  onClick={handleAddOption}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Plus size={12} />
                  <span>Add Option</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {options.map((opt, optIdx) => (
                  <div
                    key={optIdx}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                  >
                    <span
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-secondary)' }}
                    >
                      {opt.name}
                    </span>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 10
                      }}
                    >
                      {factors.map((f, fIdx) => (
                        <div
                          key={fIdx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {f.name}
                          </span>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            style={{ width: '90px' }}
                            value={opt.factorRatings[f.name] || 5}
                            onChange={(e) =>
                              handleRatingChange(optIdx, f.name, Number(e.target.value))
                            }
                          />
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 'bold',
                              width: 14,
                              textAlign: 'right'
                            }}
                          >
                            {opt.factorRatings[f.name] || 5}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSolveDecision}
              className="btn btn-primary"
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                marginTop: 12
              }}
            >
              <Award size={14} />
              <span>Optimize Decision</span>
            </button>

            {/* Results */}
            {solvingResult && (
              <div
                style={{
                  border: '1px solid rgba(46, 204, 113, 0.3)',
                  background: 'rgba(46, 204, 113, 0.05)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkles size={18} style={{ color: '#2ecc71' }} />
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                    Recommendation:{' '}
                    <span style={{ color: '#2ecc71' }}>{solvingResult.recommendedOption}</span>
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {options.map((opt) => {
                    // Let's compute score manually for real-time display of list if not returned
                    const totalWeight = factors.reduce((acc, f) => acc + Math.abs(f.weight), 0) || 1
                    let utility = 0
                    factors.forEach((f) => {
                      const rating = opt.factorRatings[f.name] || 5
                      utility += rating * (f.weight / totalWeight)
                    })
                    const score = Math.min(100, Math.max(0, Math.round((utility / 10) * 100)))

                    const isRecommended = opt.name === solvingResult.recommendedOption

                    return (
                      <div
                        key={opt.name}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px'
                          }}
                        >
                          <span
                            style={{
                              fontWeight: isRecommended ? 600 : 400,
                              color: isRecommended ? '#2ecc71' : '#fff'
                            }}
                          >
                            {opt.name} {isRecommended && '★ (Recommended)'}
                          </span>
                          <span className="font-mono">{score}% Expected Utility</span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: 6,
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            borderRadius: 3,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${score}%`,
                              backgroundColor: isRecommended ? '#2ecc71' : 'var(--color-secondary)',
                              borderRadius: 3
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

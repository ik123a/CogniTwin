import React, { useEffect, useState } from 'react'
import { useExpertiseStore, ExpertiseDomain, ExpertiseAnalogy } from '../stores/expertiseStore'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import {
  Award,
  GitMerge,
  Plus,
  Trash2,
  Calendar,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react'

export default function ExpertiseProfile(): React.JSX.Element {
  const {
    domains,
    analogies,
    isLoading,
    loadDomains,
    loadAnalogies,
    createDomain,
    deleteDomain,
    createAnalogy,
    deleteAnalogy
  } = useExpertiseStore()

  // Component state
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [domName, setDomName] = useState('')
  const [domScore, setDomScore] = useState(70)
  const [domActivity, setDomActivity] = useState(10)
  const [domColor, setDomColor] = useState('#3b82f6')

  const [showAddAnalogy, setShowAddAnalogy] = useState(false)
  const [anaTitle, setAnaTitle] = useState('')
  const [anaSource, setAnaSource] = useState('')
  const [anaTarget, setAnaTarget] = useState('')
  const [anaDesc, setAnaDesc] = useState('')
  const [anaConfidence, setAnaConfidence] = useState(80)

  // Load data on mount
  useEffect(() => {
    loadDomains()
    loadAnalogies()
  }, [])

  const handleCreateDomain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domName.trim()) return
    await createDomain(domName, domScore, domActivity, domColor)
    setDomName('')
    setDomScore(70)
    setDomActivity(10)
    setDomColor('#3b82f6')
    setShowAddDomain(false)
  }

  const handleCreateAnalogy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anaTitle.trim() || !anaSource || !anaTarget || !anaDesc.trim()) return
    if (anaSource === anaTarget) {
      alert('Source and target domains must be different.')
      return
    }
    await createAnalogy(anaSource, anaTarget, anaTitle, anaDesc, anaConfidence)
    setAnaTitle('')
    setAnaSource('')
    setAnaTarget('')
    setAnaDesc('')
    setAnaConfidence(80)
    setShowAddAnalogy(false)
  }

  // Format chart data
  const chartData = domains.map((d) => ({
    subject: d.name,
    A: d.score,
    fullMark: 100
  }))

  // Computed statistics
  const avgExpertise = domains.length
    ? Math.round(domains.reduce((acc, curr) => acc + curr.score, 0) / domains.length)
    : 0

  const totalActivity = domains.reduce((acc, curr) => acc + curr.activity_count, 0)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 24,
        height: '100%',
        overflowY: 'auto'
      }}
    >
      {/* 1. Header Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Award className="text-secondary" size={24} />
            <span>Expertise Profile</span>
          </h2>
          <p className="text-muted text-sm">
            Visualize your cognitive domains, activity depths, and cross-disciplinary analogies.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-secondary flex items-center gap-1"
            onClick={() => setShowAddDomain(!showAddDomain)}
          >
            <Plus size={16} /> Add Domain
          </button>
          <button
            className="btn btn-primary flex items-center gap-1"
            onClick={() => setShowAddAnalogy(!showAddAnalogy)}
            disabled={domains.length < 2}
          >
            <GitMerge size={16} /> Link Analogy
          </button>
        </div>
      </div>

      {/* 2. Modals/Drawers inline */}
      {showAddDomain && (
        <div
          className="card flex flex-col gap-4 animate-fade-in"
          style={{ padding: 20, borderLeft: '4px solid var(--color-secondary)' }}
        >
          <h4 className="font-semibold text-md flex items-center gap-2">
            <Sparkles size={16} className="text-secondary" /> Add New Expertise Domain
          </h4>
          <form
            onSubmit={handleCreateDomain}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16
            }}
          >
            <div className="input-group">
              <span className="input-label">Domain Name</span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Quantum Physics"
                value={domName}
                onChange={(e) => setDomName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <span className="input-label">Proficiency Score ({domScore}%)</span>
              <input
                type="range"
                min="0"
                max="100"
                value={domScore}
                onChange={(e) => setDomScore(Number(e.target.value))}
                style={{ width: '100%', height: 38 }}
              />
            </div>
            <div className="input-group">
              <span className="input-label">Initial Activity Count</span>
              <input
                type="number"
                className="input-field"
                min="0"
                value={domActivity}
                onChange={(e) => setDomActivity(Number(e.target.value))}
              />
            </div>
            <div className="input-group">
              <span className="input-label">Domain Theme Color</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 38 }}>
                {['#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#6366f1'].map((c) => (
                  <div
                    key={c}
                    onClick={() => setDomColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: c,
                      cursor: 'pointer',
                      border:
                        domColor === c
                          ? '2px solid var(--text-main)'
                          : '1px solid var(--border-color)',
                      boxShadow: domColor === c ? '0 0 6px rgba(0,0,0,0.2)' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                marginTop: 8
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddDomain(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Domain
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddAnalogy && (
        <div
          className="card flex flex-col gap-4 animate-fade-in"
          style={{ padding: 20, borderLeft: '4px solid var(--color-success)' }}
        >
          <h4 className="font-semibold text-md flex items-center gap-2">
            <GitMerge size={16} className="text-success" /> Link Cross-Domain Analogy
          </h4>
          <form onSubmit={handleCreateAnalogy} className="flex flex-col gap-4">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="input-group">
                <span className="input-label">Source Domain</span>
                <select
                  className="input-field"
                  value={anaSource}
                  onChange={(e) => setAnaSource(e.target.value)}
                  required
                >
                  <option value="">Select Domain...</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <span className="input-label">Target Domain</span>
                <select
                  className="input-field"
                  value={anaTarget}
                  onChange={(e) => setAnaTarget(e.target.value)}
                  required
                >
                  <option value="">Select Domain...</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="input-group">
              <span className="input-label">Analogy Title</span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Synapses vs Neurons"
                value={anaTitle}
                onChange={(e) => setAnaTitle(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-label">Mapping Description (How do they relate?)</span>
              <textarea
                className="input-field"
                placeholder="Describe the conceptual mapping or structural similarities..."
                value={anaDesc}
                onChange={(e) => setAnaDesc(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-label">Confidence Level ({anaConfidence}%)</span>
              <input
                type="range"
                min="10"
                max="100"
                value={anaConfidence}
                onChange={(e) => setAnaConfidence(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddAnalogy(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Link Analogy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Radar & Overview statistics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 24
        }}
      >
        {/* Radar Chart Panel */}
        <div
          className="card flex flex-col items-center justify-center"
          style={{ minHeight: 340, padding: 24, position: 'relative' }}
        >
          <h4
            className="font-semibold text-sm self-start text-muted uppercase tracking-wider"
            style={{ marginBottom: 12 }}
          >
            Cognitive Domain Map
          </h4>
          {domains.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center text-muted"
              style={{ height: 280 }}
            >
              <Layers size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
              <span>No domains defined. Add domains to view your cognitive chart.</span>
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)' }}
                  />
                  <Radar
                    name="Proficiency"
                    dataKey="A"
                    stroke="var(--color-secondary)"
                    fill="var(--color-secondary)"
                    fillOpacity={0.25}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      color: 'var(--text-main)'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stats and Metrics Summary */}
        <div className="flex flex-col gap-4 justify-between">
          <div className="card flex flex-col justify-between" style={{ flex: 1, padding: 20 }}>
            <div>
              <span
                className="text-xs font-semibold text-muted uppercase tracking-wider block"
                style={{ marginBottom: 6 }}
              >
                Average Proficiency
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-secondary">{avgExpertise}%</span>
                <span className="text-sm text-muted">Across {domains.length} Domains</span>
              </div>
            </div>
            <div
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 16 }}
            >
              <span
                className="text-xs font-semibold text-muted uppercase tracking-wider block"
                style={{ marginBottom: 6 }}
              >
                Cognitive Growth Pace
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-main">{totalActivity} Active Logs</span>
                <span className="text-xs text-muted">Notes, flashcards & connections</span>
              </div>
            </div>
            <div
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 16 }}
            >
              <span
                className="text-xs font-semibold text-muted uppercase tracking-wider block"
                style={{ marginBottom: 6 }}
              >
                Discovered Intersections
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-success">
                  {analogies.length} Cross-Discipline Links
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tip Card */}
          <div
            className="card flex items-start gap-3"
            style={{
              padding: 16,
              backgroundColor: 'rgba(52, 152, 219, 0.04)',
              borderColor: 'rgba(52, 152, 219, 0.15)'
            }}
          >
            <Zap className="text-secondary flex-shrink-0" size={18} style={{ marginTop: 2 }} />
            <div>
              <h5 className="font-semibold text-sm" style={{ marginBottom: 4 }}>
                Twin Insight
              </h5>
              <p className="text-muted" style={{ fontSize: '12px', lineHeight: 1.4 }}>
                Linking diverse domains (like Thermodynamics and Markets) helps build robust
                analogies. Your Digital Twin uses these conceptual mappings to recommend relevant
                workspace links.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Domains List Section */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ marginBottom: 16 }}>
          <span>Expertise Domains</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 12,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)'
            }}
          >
            {domains.length} Total
          </span>
        </h3>
        {domains.length === 0 ? (
          <div className="card flex items-center justify-center text-muted" style={{ height: 100 }}>
            <span>No domains defined. Click "Add Domain" to register one.</span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}
          >
            {domains.map((dom) => (
              <div
                key={dom.id}
                className="card flex flex-col justify-between"
                style={{
                  padding: 16,
                  borderLeft: `4px solid ${dom.color}`,
                  backgroundColor: 'var(--bg-surface-elevated)'
                }}
              >
                <div>
                  <div className="flex justify-between items-start" style={{ marginBottom: 8 }}>
                    <h4 className="font-semibold text-md" style={{ color: dom.color }}>
                      {dom.name}
                    </h4>
                    <button
                      className="btn-ghost"
                      onClick={() => deleteDomain(dom.id)}
                      style={{ padding: 4, borderRadius: 4 }}
                      title="Remove Domain"
                    >
                      <Trash2 size={13} className="text-muted" />
                    </button>
                  </div>

                  {/* Proficiency progress bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div
                      className="flex justify-between text-xs text-muted"
                      style={{ marginBottom: 4 }}
                    >
                      <span>Proficiency</span>
                      <span className="font-semibold">{dom.score}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'var(--border-color)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${dom.score}%`,
                          height: '100%',
                          borderRadius: 3,
                          backgroundColor: dom.color
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="flex justify-between items-center"
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 10,
                    marginTop: 8,
                    fontSize: '11px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span className="flex items-center gap-1">
                    <Zap size={11} /> {dom.activity_count} Activities
                  </span>
                  {dom.last_active && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {new Date(dom.last_active).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Analogies List Section */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ marginBottom: 16 }}>
          <span>Conceptual Analogies & Connections</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 12,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)'
            }}
          >
            {analogies.length} Links
          </span>
        </h3>

        {analogies.length === 0 ? (
          <div className="card flex items-center justify-center text-muted" style={{ height: 120 }}>
            <span className="text-sm">
              No cross-domain connections linked. Select "Link Analogy" to create connections.
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 20
            }}
          >
            {analogies.map((ana) => (
              <div
                key={ana.id}
                className="card flex flex-col justify-between"
                style={{
                  padding: 20,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Header containing connecting domains */}
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 12, fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-secondary">
                        {ana.source_domain_name || 'Source'}
                      </span>
                      <span>&harr;</span>
                      <span className="font-semibold text-success">
                        {ana.target_domain_name || 'Target'}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: '9px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        color: 'var(--color-success)'
                      }}
                    >
                      {ana.confidence}% Conf.
                    </span>
                  </div>

                  <h4
                    className="font-semibold text-sm"
                    style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <GitMerge size={14} className="text-secondary" />
                    <span>{ana.analogy_title}</span>
                  </h4>

                  <p
                    className="text-muted"
                    style={{ fontSize: '12px', lineHeight: 1.4, minHeight: 48 }}
                  >
                    {ana.description}
                  </p>
                </div>

                <div
                  className="flex justify-between items-center"
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: 12,
                    marginTop: 12
                  }}
                >
                  <span className="flex items-center gap-1 text-muted" style={{ fontSize: '10px' }}>
                    <ShieldCheck size={11} className="text-success" /> Validated conceptual overlay
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => deleteAnalogy(ana.id)}
                    style={{ padding: 4, borderRadius: 4 }}
                    title="Remove Analogy"
                  >
                    <Trash2 size={13} className="text-muted" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

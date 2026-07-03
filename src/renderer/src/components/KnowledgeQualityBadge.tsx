import React, { useState } from 'react'
import { ShieldCheck, Info } from 'lucide-react'

interface KnowledgeQualityBadgeProps {
  title: string
  content: string
}

export default function KnowledgeQualityBadge({
  title,
  content
}: KnowledgeQualityBadgeProps): React.JSX.Element {
  const [showTooltip, setShowTooltip] = useState(false)

  // 1. Calculate metrics
  const text = content || ''
  const length = text.trim().length

  // A. Completeness Score
  let completeness = 0
  if (length > 0) {
    if (length < 50) completeness = 20
    else if (length < 200) completeness = 50
    else if (length < 600) completeness = 80
    else completeness = 100
  }

  // B. Structure Score (headings, bold, lists, blocks, formatting)
  let structure = 0
  if (length > 0) {
    const hasHeadings = /#+\s/.test(text) ? 25 : 0
    const hasLists = /[-\*\+]\s|\d+\.\s/.test(text) ? 25 : 0
    const hasBoldItalics = /\*\*|__|\*|_/.test(text) ? 25 : 0
    const hasParagraphs = /\n\n/.test(text) ? 25 : 0
    structure = hasHeadings + hasLists + hasBoldItalics + hasParagraphs
  }

  // C. Depth Score (cognitive terms, vocabulary diversity, links)
  let depth = 0
  if (length > 0) {
    const words = text.split(/\s+/).filter(Boolean)
    const wordCount = words.length

    // Density score
    const densityScore = Math.min(40, Math.floor(wordCount / 2.5))

    // Cognitive transition words
    const cognitiveWords = [
      'therefore',
      'because',
      'consequently',
      'analogy',
      'resembles',
      'conceptual',
      'hypothesis',
      'structure',
      'mechanism',
      'implication',
      'specifically',
      'instance',
      'furthermore'
    ]
    const cognitiveMatches = words.filter((w) => cognitiveWords.includes(w.toLowerCase())).length
    const cognitiveScore = Math.min(40, cognitiveMatches * 10)

    // Links/External refs
    const hasLinks = /https?:\/\/[^\s]+|\[[^\]]+\]\([^\)]+\)/.test(text) ? 20 : 0

    depth = densityScore + cognitiveScore + hasLinks
  }

  // D. Overall Score
  const overallScore = length > 0 ? Math.round((completeness + structure + depth) / 3) : 0

  // E. Color mapping based on score
  let ringColor = 'rgba(231, 76, 60, 0.8)' // Red
  let badgeLabel = 'Low Quality'
  if (overallScore >= 70) {
    ringColor = 'rgba(46, 204, 113, 0.85)' // Green
    badgeLabel = 'Mature Knowledge'
  } else if (overallScore >= 40) {
    ringColor = 'rgba(230, 126, 34, 0.85)' // Orange/Yellow
    badgeLabel = 'Drafting Quality'
  }

  // SVG parameters
  const radius = 18
  const strokeWidth = 3.5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (overallScore / 100) * circumference

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge Circle Graphic */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 20,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <svg width="42" height="42" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track circle */}
          <circle
            cx="21"
            cy="21"
            r={radius}
            fill="transparent"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx="21"
            cy="21"
            r={radius}
            fill="transparent"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.35s' }}
          />
          {/* Central score number */}
          <text
            x="21"
            y="-18" // x, y are rotated, so y becomes x and x becomes -y
            fontFamily="monospace"
            fontSize="10"
            fontWeight="bold"
            fill="var(--text-main)"
            textAnchor="middle"
            transform="rotate(90)"
          >
            {overallScore}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}
          >
            Knowledge Score
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 500 }}>
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Popover Breakdown on Hover */}
      {showTooltip && (
        <div
          className="card"
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 250,
            padding: 16,
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            backdropFilter: 'blur(12px)',
            backgroundColor: 'var(--bg-surface-elevated)',
            animation: 'fade-in 0.2s ease'
          }}
        >
          <div
            className="flex items-center gap-1.5 font-semibold text-xs text-secondary border-b pb-2 mb-1"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <ShieldCheck size={14} />
            <span>KNOWLEDGE QUALITY INDEX</span>
          </div>

          {/* Completeness bar */}
          <div>
            <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
              <span>Completeness</span>
              <span className="font-semibold">{completeness}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                backgroundColor: 'var(--border-color)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${completeness}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: 'var(--color-secondary)'
                }}
              />
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              Note size: {length} chars
            </span>
          </div>

          {/* Structure bar */}
          <div>
            <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
              <span>Structure</span>
              <span className="font-semibold">{structure}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                backgroundColor: 'var(--border-color)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${structure}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: 'var(--color-success)'
                }}
              />
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              Markdown format, headings & lists
            </span>
          </div>

          {/* Depth bar */}
          <div>
            <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
              <span>Depth & Connections</span>
              <span className="font-semibold">{depth}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                borderRadius: 2,
                backgroundColor: 'var(--border-color)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${depth}%`,
                  height: '100%',
                  borderRadius: 2,
                  backgroundColor: 'var(--color-accent)'
                }}
              />
            </div>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
              Vocabulary variety & semantic triggers
            </span>
          </div>

          <div
            className="flex items-center gap-1 text-muted"
            style={{
              fontSize: '9px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: 8,
              marginTop: 4
            }}
          >
            <Info size={10} />
            <span>Maturing your notes increases Twin query accuracy.</span>
          </div>
        </div>
      )}
    </div>
  )
}

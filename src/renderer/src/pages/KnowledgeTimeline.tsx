import React, { useState, useEffect } from 'react'
import {
  FileText,
  CheckSquare,
  Calendar,
  Sparkles,
  RefreshCw,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react'

interface Milestone {
  id: string
  type: 'note' | 'task' | 'event' | 'idea_state'
  title: string
  timestamp: string
  details: {
    noteId?: string
    taskId?: string
    eventId?: string
    state?: string
    status?: string
    startTime?: string
  }
}

export default function KnowledgeTimeline(): React.JSX.Element {
  const [timeline, setTimeline] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const data = await window.api.maturation.getTimeline()
      setTimeline(data)
    } catch (error) {
      console.error('Error fetching maturation timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
  }, [])

  const getIcon = (type: Milestone['type']) => {
    switch (type) {
      case 'note':
        return <FileText className="w-5 h-5 text-sky-400" />
      case 'task':
        return <CheckSquare className="w-5 h-5 text-emerald-400" />
      case 'event':
        return <Calendar className="w-5 h-5 text-purple-400" />
      case 'idea_state':
        return <Sparkles className="w-5 h-5 text-amber-400" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getBorderColor = (type: Milestone['type']) => {
    switch (type) {
      case 'note':
        return 'border-sky-500/30'
      case 'task':
        return 'border-emerald-500/30'
      case 'event':
        return 'border-purple-500/30'
      case 'idea_state':
        return 'border-amber-500/30'
      default:
        return 'border-white/10'
    }
  }

  const getBgColor = (type: Milestone['type']) => {
    switch (type) {
      case 'note':
        return 'bg-sky-500/10'
      case 'task':
        return 'bg-emerald-500/10'
      case 'event':
        return 'bg-purple-500/10'
      case 'idea_state':
        return 'bg-amber-500/10'
      default:
        return 'bg-white/5'
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-secondary w-7 h-7" />
            Knowledge Maturation Timeline
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Track the chronological evolution of your workspace notes, tasks, scheduled sessions,
            and concept maturation.
          </p>
        </div>
        <button
          className="btn btn-secondary flex items-center gap-2"
          onClick={fetchTimeline}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Timeline Section */}
      {loading && timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400">Loading chronological feed...</p>
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-2xl">
          <Clock className="w-12 h-12 text-gray-500 mb-2" />
          <p className="text-base text-gray-300 font-semibold">No Milestones Recorded</p>
          <p className="text-sm text-gray-400 text-center max-w-sm mt-1">
            Create new notes, schedule events, or complete tasks in your workspace to populate the
            timeline.
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col pl-6 md:pl-10 py-4">
          {/* Vertical central line */}
          <div className="absolute left-6 md:left-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-secondary/50 via-accent/30 to-transparent transform -translate-x-1/2"></div>

          {timeline.map((milestone, idx) => {
            const iconBg = getBgColor(milestone.type)
            const borderCol = getBorderColor(milestone.type)
            return (
              <div
                key={milestone.id + '-' + idx}
                className="relative flex flex-col md:flex-row gap-4 mb-8 group"
              >
                {/* Timeline Icon Badge */}
                <div
                  className={`absolute left-0 top-1.5 transform -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center z-10 border ${borderCol} ${iconBg} shadow-lg shadow-black/40 group-hover:scale-110 transition-transform`}
                  style={{ left: '-6px' }}
                >
                  {getIcon(milestone.type)}
                </div>

                {/* Milestone Detail Card */}
                <div className="flex-1 ml-6 bg-white/5 border border-white/10 hover:border-white/20 transition-all rounded-xl p-5 backdrop-blur-sm shadow-md">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                    <span className="font-semibold text-white text-base leading-tight group-hover:text-secondary transition-colors">
                      {milestone.title}
                    </span>
                    <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(milestone.timestamp)}
                    </span>
                  </div>

                  {/* Contextual description based on details */}
                  <div className="text-sm text-gray-300 mt-2 leading-relaxed">
                    {milestone.type === 'note' && (
                      <div className="flex items-center gap-1">
                        <span>New node registered. Stage initialized as </span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-xs uppercase">
                          Seed
                        </span>
                      </div>
                    )}
                    {milestone.type === 'task' && (
                      <div>
                        Task logged in workbench. Priority:{' '}
                        <span className="text-white font-medium">
                          {milestone.details.status || 'Active'}
                        </span>
                        .
                      </div>
                    )}
                    {milestone.type === 'event' && (
                      <div>
                        Event scheduled for{' '}
                        <span className="text-white font-medium">
                          {formatDate(milestone.details.startTime || '')}
                        </span>
                        .
                      </div>
                    )}
                    {milestone.type === 'idea_state' && (
                      <div className="flex flex-col gap-2">
                        <p>
                          Concept complexity threshold reached. Matured stage transitioned to:{' '}
                          <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs uppercase tracking-wide">
                            {milestone.details.state}
                          </span>
                        </p>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                          <span>• Character requirements met</span>
                          <span>• Link connectivity validated</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

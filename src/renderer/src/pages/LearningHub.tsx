import React, { useState, useEffect } from 'react'
import { useLearningStore, LearningGoal, LearningPathStep } from '../stores/learningStore'
import {
  Compass,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  Search,
  BookOpen,
  Sparkles,
  CheckSquare,
  Square,
  RefreshCw,
  FileText
} from 'lucide-react'

export default function LearningHub(): React.JSX.Element {
  const {
    goals,
    selectedGoal,
    steps,
    isLoading,
    loadGoals,
    selectGoal,
    createGoal,
    completeStep,
    performGapAnalysis
  } = useLearningStore()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalTopic, setGoalTopic] = useState('')
  const [analyzingGap, setAnalyzingGap] = useState(false)
  const [noteNames, setNoteNames] = useState<Record<string, string>>({})

  // Load goals on mount
  useEffect(() => {
    loadGoals()
  }, [])

  // Fetch note titles for steps that have note_id matched
  useEffect(() => {
    const fetchNoteNames = async () => {
      const ids = steps.map((s) => s.note_id).filter((id): id is string => !!id)
      if (ids.length === 0) {
        setNoteNames({})
        return
      }

      const placeholders = ids.map(() => '?').join(',')
      try {
        const notesList = await window.api.db.query(
          `SELECT id, title FROM notes WHERE id IN (${placeholders})`,
          ids
        )
        const mapping = notesList.reduce(
          (acc, note) => {
            acc[note.id] = note.title
            return acc
          },
          {} as Record<string, string>
        )
        setNoteNames(mapping)
      } catch (err) {
        console.error('Failed to query matching note titles:', err)
      }
    }
    fetchNoteNames()
  }, [steps])

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalTitle.trim() || !goalTopic.trim()) return
    await createGoal(goalTitle, goalTopic)
    setGoalTitle('')
    setGoalTopic('')
    setShowCreateModal(false)
  }

  const handleRunGap = async () => {
    if (!selectedGoal) return
    setAnalyzingGap(true)
    try {
      await performGapAnalysis(selectedGoal.id)
    } finally {
      setAnalyzingGap(false)
    }
  }

  // Helper to calculate progress percent for a goal
  const getGoalProgress = (goalId: string) => {
    // We would ideally query completed steps count. Let's compute locally or fetch.
    // For simplicity, if selectGoal is active, we can compute from store steps,
    // but for the general list we can run a quick query.
    // Let's run query or compute if steps are loaded, but since we want it for the list,
    // we can do a quick load or use precomputed stats. Let's write a react state for counts.
    return progressStats[goalId] || { completed: 0, total: 3 }
  }

  const [progressStats, setProgressStats] = useState<
    Record<string, { completed: number; total: number }>
  >({})

  const fetchProgressStats = async () => {
    try {
      const stats = await window.api.db.query(`
        SELECT goal_id, 
               COUNT(*) as total, 
               SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
        FROM learning_path_steps
        GROUP BY goal_id
      `)
      const mapping = stats.reduce(
        (acc, item) => {
          acc[item.goal_id] = { completed: item.completed || 0, total: item.total || 0 }
          return acc
        },
        {} as Record<string, { completed: number; total: number }>
      )
      setProgressStats(mapping)
    } catch (err) {
      console.error('Error fetching goal progress stats:', err)
    }
  }

  useEffect(() => {
    if (goals.length > 0) {
      fetchProgressStats()
    }
  }, [goals, steps])

  return (
    <div className="flex flex-row h-full overflow-hidden text-white">
      {/* LEFT COLUMN: Goals list panel */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-white/5 backdrop-blur-md">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-secondary" />
            <h3 className="font-semibold text-sm tracking-wide">Learning Goals</h3>
          </div>
          <button
            className="btn btn-secondary p-1.5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            onClick={() => setShowCreateModal(true)}
            title="Create Learning Goal"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {goals.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              No learning goals yet.
              <br />
              Click the plus icon to start.
            </div>
          ) : (
            goals.map((g) => {
              const stats = getGoalProgress(g.id)
              const percent =
                stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
              const isSelected = selectedGoal?.id === g.id

              return (
                <div
                  key={g.id}
                  onClick={() => selectGoal(g)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border text-left ${
                    isSelected
                      ? 'bg-secondary/15 border-secondary/40'
                      : 'bg-white/5 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="font-semibold text-sm leading-snug text-gray-100 group-hover:text-white">
                      {g.title}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                        g.status === 'Completed'
                          ? 'bg-success/20 text-success'
                          : 'bg-secondary/20 text-secondary'
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 block mb-3 font-medium">
                    Topic: {g.topic}
                  </span>

                  {/* Progress bar */}
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span>PROGRESS</span>
                      <span className="font-bold text-gray-300">
                        {percent}% ({stats.completed}/{stats.total} steps)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-secondary to-accent transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Goal detailed steps and warnings */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-slate-950/45">
        {selectedGoal ? (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            {/* Selected Goal Card */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-lg">
              <div>
                <span className="text-xs text-secondary font-bold uppercase tracking-wider">
                  Goal Syllabus
                </span>
                <h2 className="text-2xl font-bold mt-1 text-white">{selectedGoal.title}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Core Domain: <span className="text-gray-200">{selectedGoal.topic}</span>
                </p>
              </div>
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={handleRunGap}
                disabled={analyzingGap || isLoading}
              >
                {analyzingGap ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Workspace...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze Gaps & Update Path
                  </>
                )}
              </button>
            </div>

            {/* List of sequential steps */}
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold border-b border-white/10 pb-2">
                Sequential Learning Steps
              </h3>

              {isLoading && steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-400">Loading steps syllabus...</p>
                </div>
              ) : (
                steps.map((step, idx) => {
                  const isCompleted = step.status === 'Completed'
                  const hasNote = !!step.note_id

                  return (
                    <div
                      key={step.id}
                      className={`border rounded-xl transition-all p-5 flex flex-col gap-4 ${
                        isCompleted
                          ? 'bg-success/5 border-success/20'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {/* Top bar of step card */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-1 flex-shrink-0 cursor-pointer text-gray-400 hover:text-white"
                            onClick={() => !isCompleted && completeStep(step.id)}
                            disabled={isCompleted}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-5.5 h-5.5 text-success fill-success/10 animate-bounce" />
                            ) : (
                              <Square className="w-5.5 h-5.5 text-gray-500 hover:text-secondary" />
                            )}
                          </button>

                          <div>
                            <h4
                              className={`font-semibold text-base leading-snug ${isCompleted ? 'line-through text-gray-400' : 'text-white'}`}
                            >
                              {idx + 1}. {step.title}
                            </h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 font-medium">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Duration: {step.estimated_duration || '1 hour'}
                              </span>

                              {hasNote ? (
                                <span className="flex items-center gap-1 text-sky-400">
                                  <FileText className="w-3.5 h-3.5" />
                                  Matched note: "{noteNames[step.note_id!] || 'Loading...'}"
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-warning">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Knowledge Gap
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {step.description && (
                        <p
                          className={`text-sm text-gray-300 pl-8 leading-relaxed ${isCompleted ? 'text-gray-500' : ''}`}
                        >
                          {step.description}
                        </p>
                      )}

                      {/* Warning Banner / References */}
                      {!isCompleted && !hasNote && (
                        <div className="ml-8 border border-warning/30 bg-warning/5 rounded-xl p-4 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-warning font-semibold text-xs tracking-wider uppercase">
                            <AlertTriangle className="w-4 h-4" />
                            Knowledge Gap Alert: Matched Note is Empty
                          </div>
                          <p className="text-xs text-gray-300 leading-normal">
                            No corresponding workspace note was discovered for this topic. We
                            recommend creating a new note or exploring these resources:
                          </p>

                          {/* Recommended resources */}
                          {step.recommendations ? (
                            <div className="bg-black/20 rounded-lg p-3 text-xs text-gray-200 border border-white/5 font-mono leading-relaxed whitespace-pre-line">
                              {step.recommendations}
                            </div>
                          ) : (
                            <div className="bg-black/20 rounded-lg p-3 text-xs text-gray-400 italic">
                              Perform "Analyze Gaps" to generate online reference recommendations.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-32 text-center gap-3">
            <Compass className="w-16 h-16 text-gray-600 animate-pulse" />
            <h4 className="text-xl font-bold text-gray-300">No Selected Learning Goal</h4>
            <p className="text-sm text-gray-500 max-w-sm">
              Please choose a goal syllabus from the left sidebar or click the plus button to
              register a new domain curriculum.
            </p>
          </div>
        )}
      </div>

      {/* CREATE GOAL MODAL */}
      {showCreateModal && (
        <div className="modal-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999]">
          <div
            className="modal-content glass flex flex-col w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl relative"
            style={{
              background:
                'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="flex justify-between items-center mb-5 pb-2 border-b border-white/10">
              <h3 className="font-semibold text-lg">Create Learning Goal</h3>
              <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>
                <Plus className="w-5 h-5 text-gray-400 hover:text-white rotate-45 transform" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="flex flex-col gap-4">
              <div className="input-group">
                <span className="input-label">CURRICULUM SYLLABUS TITLE</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Master Rust Concurrency"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <span className="input-label">FOCUS TOPIC / DOMAIN</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Rust asynchronous channels, select block"
                  value={goalTopic}
                  onChange={(e) => setGoalTopic(e.target.value)}
                  required
                />
              </div>

              <p className="text-[11px] text-gray-400 leading-normal">
                💡 Note: Creating this goal will automatically trigger a local AI (Qwen model)
                background action to break down your focus domain into structured, progressive
                learning steps.
              </p>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Generate Path
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

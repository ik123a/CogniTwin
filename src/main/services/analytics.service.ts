import { getDatabase } from '../database/connection'

export interface TimelineData {
  name: string
  focusTime: number // calculated roughly from task completions and note creation events
  tasksDone: number
}

export interface SkillData {
  subject: string
  A: number // number of occurrences
  fullMark: number
}

export interface HeatmapData {
  date: string
  count: number
}

/**
 * Aggregates daily note creations and task completions for the timeline charts.
 */
export async function getTimelineStats(rangeDays: number = 7): Promise<TimelineData[]> {
  const db = getDatabase()
  const filterDate = new Date()
  filterDate.setDate(filterDate.getDate() - rangeDays)
  const filterDateStr = filterDate.toISOString().split('T')[0]

  try {
    // 1. Fetch note creations count per day
    const notesResult = db
      .prepare(
        `
      SELECT date(created_at) as dateStr, count(*) as count 
      FROM notes 
      WHERE created_at >= ?
      GROUP BY dateStr
    `
      )
      .all(filterDateStr) as Array<{ dateStr: string; count: number }>

    // 2. Fetch task completions count per day
    const tasksResult = db
      .prepare(
        `
      SELECT date(updated_at) as dateStr, count(*) as count 
      FROM tasks 
      WHERE status = 'Completed' AND updated_at >= ?
      GROUP BY dateStr
    `
      )
      .all(filterDateStr) as Array<{ dateStr: string; count: number }>

    // 3. Merge stats into a sequence of days
    const mergedMap = new Map<string, { notes: number; tasks: number }>()

    // Fill empty range days
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const str = d.toISOString().split('T')[0]
      mergedMap.set(str, { notes: 0, tasks: 0 })
    }

    notesResult.forEach((n) => {
      if (mergedMap.has(n.dateStr)) {
        mergedMap.get(n.dateStr)!.notes = n.count
      }
    })

    tasksResult.forEach((t) => {
      if (mergedMap.has(t.dateStr)) {
        mergedMap.get(t.dateStr)!.tasks = t.count
      }
    })

    // Format for charts: sorted chronologically
    return Array.from(mergedMap.entries())
      .map(([dateStr, stats]) => {
        // Approximate focus hours = notes * 0.8 + tasks * 0.5 (rough estimation)
        const focusTime = parseFloat((stats.notes * 0.8 + stats.tasks * 0.5).toFixed(1))

        // Format date string to brief labels e.g. "Mon" or "Jun 24"
        const dateObj = new Date(dateStr)
        const label = dateObj.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })

        return {
          name: label,
          focusTime: focusTime || 0.5, // minimum default to show on chart lines
          tasksDone: stats.tasks
        }
      })
      .reverse()
  } catch (error) {
    console.error('[AnalyticsService] Failed to fetch timeline stats:', error)
    return []
  }
}

/**
 * Aggregates tag item counts for the Capability Radar chart.
 */
export async function getSkillRadarStats(): Promise<SkillData[]> {
  const db = getDatabase()

  try {
    const tagStats = db
      .prepare(
        `
      SELECT t.name as subject, count(*) as count 
      FROM tags t
      JOIN item_tags it ON t.id = it.tag_id
      GROUP BY subject
      ORDER BY count DESC
      LIMIT 6
    `
      )
      .all() as Array<{ subject: string; count: number }>

    // Fallback default skills if database tags are empty
    if (tagStats.length === 0) {
      return [
        { subject: 'Writing', A: 40, fullMark: 100 },
        { subject: 'Coding', A: 50, fullMark: 100 },
        { subject: 'Planning', A: 30, fullMark: 100 },
        { subject: 'Analysis', A: 60, fullMark: 100 },
        { subject: 'Review', A: 20, fullMark: 100 }
      ]
    }

    const maxCount = Math.max(...tagStats.map((t) => t.count), 1)
    return tagStats.map((t) => ({
      subject: t.subject,
      A: Math.round((t.count / maxCount) * 100), // Normalized percentage out of 100
      fullMark: 100
    }))
  } catch (error) {
    console.error('[AnalyticsService] Failed to fetch radar stats:', error)
    return []
  }
}

/**
 * Gathers daily action frequencies over the past 12 months for the energy contribution heatmap.
 */
export async function getHeatmapStats(): Promise<HeatmapData[]> {
  const db = getDatabase()
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]

  try {
    const rawEvents = db
      .prepare(
        `
      SELECT dateStr, count(*) as count FROM (
        SELECT date(created_at) as dateStr FROM notes WHERE created_at >= ?
        UNION ALL
        SELECT date(created_at) as dateStr FROM tasks WHERE created_at >= ?
        UNION ALL
        SELECT date(created_at) as dateStr FROM files WHERE created_at >= ?
      )
      GROUP BY dateStr
    `
      )
      .all(oneYearAgoStr, oneYearAgoStr, oneYearAgoStr) as Array<{ dateStr: string; count: number }>

    return rawEvents.map((e) => ({
      date: e.dateStr,
      count: e.count
    }))
  } catch (error) {
    console.error('[AnalyticsService] Failed to aggregate heatmap stats:', error)
    return []
  }
}

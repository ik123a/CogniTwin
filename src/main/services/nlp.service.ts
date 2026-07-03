import nlp from 'compromise'

export interface ExtractedEntity {
  name: string
  type: 'person' | 'organization' | 'place' | 'concept' | 'date'
  normalizedName: string
  mentionCount: number
}

// Stopwords list to filter out common words during keyword extraction
const STOPWORDS = new Set([
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'a',
  'an',
  'the',
  'and',
  'but',
  'if',
  'or',
  'because',
  'as',
  'until',
  'while',
  'of',
  'at',
  'by',
  'for',
  'with',
  'about',
  'against',
  'between',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'to',
  'from',
  'up',
  'down',
  'in',
  'out',
  'on',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'any',
  'both',
  'each',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  's',
  't',
  'can',
  'will',
  'just',
  'don',
  'should',
  'now',
  'using',
  'use',
  'would',
  'also',
  'project',
  'task',
  'note',
  'work',
  'new',
  'get',
  'make',
  'like'
])

/**
 * Extracts named entities (people, places, organizations) using the compromise library.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  if (!text || text.trim().length === 0) return []

  const doc = nlp(text)
  const entitiesMap = new Map<string, ExtractedEntity>()

  const processEntityList = (list: any[], type: 'person' | 'organization' | 'place') => {
    list.forEach((entityStr: string) => {
      const name = entityStr.trim()
      if (name.length < 2 || name.length > 50) return

      const normalized = name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (normalized.length < 2) return

      const key = `${type}:${normalized}`
      const existing = entitiesMap.get(key)
      if (existing) {
        existing.mentionCount++
      } else {
        entitiesMap.set(key, {
          name,
          type,
          normalizedName: normalized,
          mentionCount: 1
        })
      }
    })
  }

  // 1. Extract People
  const people = doc.people().out('array')
  processEntityList(people, 'person')

  // 2. Extract Organizations
  const orgs = doc.organizations().out('array')
  processEntityList(orgs, 'organization')

  // 3. Extract Places
  const places = doc.places().out('array')
  processEntityList(places, 'place')

  return Array.from(entitiesMap.values())
}

/**
 * Extracts key terms and keywords from a document using word frequencies and stopword removal.
 */
export function extractKeywords(text: string, topK: number = 10): string[] {
  if (!text || text.trim().length === 0) return []

  // Normalize text and split into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)

  const freq: Record<string, number> = {}

  words.forEach((word) => {
    if (word.length < 3 || word.length > 25 || STOPWORDS.has(word)) return
    freq[word] = (freq[word] || 0) + 1
  })

  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, topK)
}

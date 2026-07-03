/**
 * Text Chunker Service
 * Splits long text documents into overlapping chunks for embedding generation.
 * Uses a recursive character text splitter that respects paragraph and sentence boundaries.
 */

export interface TextChunk {
  text: string
  index: number
  startChar: number
  endChar: number
}

const DEFAULT_MAX_CHARS = 1500 // ~512 tokens for MiniLM
const DEFAULT_OVERLAP_CHARS = 200 // ~64 tokens overlap

/**
 * Splits text into overlapping chunks, respecting paragraph and sentence boundaries.
 */
export function chunkText(
  text: string,
  maxChars: number = DEFAULT_MAX_CHARS,
  overlapChars: number = DEFAULT_OVERLAP_CHARS
): TextChunk[] {
  if (!text || text.trim().length === 0) return []

  const cleaned = text.replace(/\r\n/g, '\n').trim()

  // If text fits in one chunk, return as-is
  if (cleaned.length <= maxChars) {
    return [{ text: cleaned, index: 0, startChar: 0, endChar: cleaned.length }]
  }

  const chunks: TextChunk[] = []
  let currentPos = 0
  let chunkIndex = 0

  while (currentPos < cleaned.length) {
    let endPos = Math.min(currentPos + maxChars, cleaned.length)

    // If we haven't reached the end, try to find a good break point
    if (endPos < cleaned.length) {
      // Priority 1: Break at paragraph boundary (\n\n)
      const paragraphBreak = cleaned.lastIndexOf('\n\n', endPos)
      if (paragraphBreak > currentPos + maxChars * 0.3) {
        endPos = paragraphBreak + 2 // Include the newlines
      } else {
        // Priority 2: Break at sentence boundary (. ! ?)
        const sentenceMatch = cleaned.substring(currentPos, endPos).match(/[.!?]\s+(?=[A-Z])/g)
        if (sentenceMatch) {
          const lastSentenceEnd = cleaned
            .substring(currentPos, endPos)
            .lastIndexOf(sentenceMatch[sentenceMatch.length - 1])
          if (lastSentenceEnd > maxChars * 0.3) {
            endPos = currentPos + lastSentenceEnd + sentenceMatch[sentenceMatch.length - 1].length
          }
        } else {
          // Priority 3: Break at newline
          const newlineBreak = cleaned.lastIndexOf('\n', endPos)
          if (newlineBreak > currentPos + maxChars * 0.3) {
            endPos = newlineBreak + 1
          } else {
            // Priority 4: Break at word boundary (space)
            const spaceBreak = cleaned.lastIndexOf(' ', endPos)
            if (spaceBreak > currentPos + maxChars * 0.3) {
              endPos = spaceBreak + 1
            }
          }
        }
      }
    }

    const chunkText = cleaned.substring(currentPos, endPos).trim()
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        startChar: currentPos,
        endChar: endPos
      })
      chunkIndex++
    }

    // Advance position with overlap
    currentPos = endPos - overlapChars
    if (currentPos >= cleaned.length) break
    // Safety: ensure we always advance
    if (currentPos <= chunks[chunks.length - 1]?.startChar) {
      currentPos = endPos
    }
  }

  return chunks
}

/**
 * Extracts plain text from a content item (title + body) for embedding.
 */
export function prepareTextForEmbedding(title: string, content: string | null): string {
  const parts: string[] = []
  if (title) parts.push(title)
  if (content) parts.push(content)
  return parts.join('\n\n')
}

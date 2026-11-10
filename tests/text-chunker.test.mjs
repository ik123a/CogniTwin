import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkText } from '../src/main/services/text-chunker.service.ts'
test('stops once the final source character is covered', () => {
  const chunks = chunkText('abcdefghijklmno', 10, 2)
  assert.deepEqual(chunks.map(c => c.text), ['abcdefghij', 'ijklmno'])
})
test('empty and short input remain supported', () => {
  assert.deepEqual(chunkText('  '), [])
  assert.equal(chunkText('hello')[0].text, 'hello')
})

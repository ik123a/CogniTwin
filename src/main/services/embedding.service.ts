import { env, pipeline, FeatureExtractionPipeline } from '@xenova/transformers'
import { app } from 'electron'
import path from 'path'

// Configure transformers to run 100% offline using local model assets
env.allowRemoteModels = false

// Resolve local models directory path
const modelsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'models')
  : path.join(__dirname, '../../resources/models')

env.localModelPath = modelsPath

let extractorInstance: FeatureExtractionPipeline | null = null

/**
 * Lazy loads and returns the feature extraction pipeline instance.
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractorInstance) return extractorInstance

  try {
    console.log(`Initializing semantic embedding pipeline from local path: ${modelsPath}`)
    // Load local all-MiniLM-L6-v2 model (quantized version is loaded automatically)
    extractorInstance = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', {
      quantized: true
    })
    return extractorInstance
  } catch (error) {
    console.error('Failed to initialize feature-extraction pipeline:', error)
    throw error
  }
}

/**
 * Generates a 384-dimensional vector embedding for the given text.
 * Performs mean pooling over token embeddings.
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (!text || text.trim().length === 0) {
    return new Float32Array(384) // Zero vector for empty text
  }

  const extractor = await getExtractor()

  // Generate embeddings (returns a Tensor object)
  const output = await extractor(text, {
    pooling: 'mean',
    normalize: true
  })

  // Extract the Float32Array containing the 384 dimensions
  return Float32Array.from(output.data)
}

/**
 * Generates embeddings for a batch of texts.
 */
export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = []
  for (const text of texts) {
    const vec = await generateEmbedding(text)
    embeddings.push(vec)
  }
  return embeddings
}

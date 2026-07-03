const fs = require('fs')
const path = require('path')
const https = require('https')

const MODEL_DIR = path.join(__dirname, '../resources/models')
const MODEL_NAME = 'qwen2.5-1.5b-instruct-q4_k_m.gguf'
const MODEL_URL = `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/${MODEL_NAME}`

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading LLM model from ${url} ...`)
    const file = fs.createWriteStream(destPath)
    let downloadedBytes = 0

    const request = (targetUrl) => {
      https
        .get(targetUrl, (response) => {
          if ([301, 302, 307, 308].includes(response.statusCode)) {
            // Handle redirects correctly (HuggingFace uses relative paths for CDN caches)
            let nextUrl = response.headers.location
            if (nextUrl.startsWith('/')) {
              nextUrl = 'https://huggingface.co' + nextUrl
            }
            request(nextUrl)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: Status Code ${response.statusCode}`))
            return
          }

          const totalBytes = parseInt(response.headers['content-length'], 10)
          console.log(`Total model size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`)

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length
            // Log progress occasionally
            if (Math.random() < 0.02) {
              console.log(
                `Progress: ${((downloadedBytes / totalBytes) * 100).toFixed(1)}% (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB)`
              )
            }
          })

          response.pipe(file)

          file.on('finish', () => {
            file.close()
            console.log(`Finished downloading LLM model: ${MODEL_NAME}`)
            resolve()
          })
        })
        .on('error', (err) => {
          fs.unlink(destPath, () => {})
          reject(err)
        })
    }

    request(url)
  })
}

async function main() {
  try {
    ensureDirectoryExists(MODEL_DIR)
    const dest = path.join(MODEL_DIR, MODEL_NAME)

    if (fs.existsSync(dest)) {
      console.log(`Local LLM model already exists at: ${dest}. Skipping download.`)
      process.exit(0)
    }

    await downloadFile(MODEL_URL, dest)
    console.log('LLM model download completed successfully!')
  } catch (error) {
    console.error('Error downloading LLM model:', error)
    process.exit(1)
  }
}

main()

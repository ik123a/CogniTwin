const fs = require('fs')
const path = require('path')
const https = require('https')

const MODEL_DIR = path.join(__dirname, '../resources/models/all-MiniLM-L6-v2')

const FILES_TO_DOWNLOAD = [
  {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
    filename: 'model_quantized.onnx'
  },
  {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
    filename: 'tokenizer.json'
  },
  {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json',
    filename: 'tokenizer_config.json'
  },
  {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/vocab.txt',
    filename: 'vocab.txt'
  },
  {
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/special_tokens_map.json',
    filename: 'special_tokens_map.json'
  }
]

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} ...`)
    const file = fs.createWriteStream(destPath)

    const request = (targetUrl) => {
      https
        .get(targetUrl, (response) => {
          if ([301, 302, 307, 308].includes(response.statusCode)) {
            // Handle redirect
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

          response.pipe(file)

          file.on('finish', () => {
            file.close()
            console.log(`Finished: ${path.basename(destPath)}`)
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
    console.log(`Model directory: ${MODEL_DIR}`)

    for (const item of FILES_TO_DOWNLOAD) {
      const dest = path.join(MODEL_DIR, item.filename)
      if (fs.existsSync(dest)) {
        console.log(`${item.filename} already exists. Skipping.`)
        continue
      }
      await downloadFile(item.url, dest)
    }
    console.log('Model download completed successfully!')
  } catch (error) {
    console.error('Error downloading model files:', error)
    process.exit(1)
  }
}

main()

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

// Configuration Walrus
const WALRUS_CONFIG = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space"
};

// Middleware
app.use(cors());
app.use(express.json());

// Cache directory
const CACHE_DIR = './audio_cache';
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Multer pour upload
const upload = multer({
  dest: './uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 🏠 Route de test
app.get('/', (req, res) => {
  res.json({
    message: '🎵 Music Jukebox Backend',
    status: 'OK',
    endpoints: {
      health: 'GET /api/health',
      upload: 'POST /api/upload',
      audio: 'GET /api/audio/:blobId'
    }
  });
});

// 🔍 Route health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    walrus: {
      publisher: WALRUS_CONFIG.publisher,
      aggregator: WALRUS_CONFIG.aggregator
    },
    cache: fs.readdirSync(CACHE_DIR).length + ' files',
    timestamp: new Date().toISOString()
  });
});

// 📤 Route upload vers Walrus
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    console.log(`🎵 Upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Lire le fichier uploadé
    const fileBuffer = fs.readFileSync(req.file.path);

    // Tenter upload vers Walrus
    const blobId = await uploadToWalrus(fileBuffer);

    // Nettoyer fichier temporaire
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      blobId,
      filename: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    // Nettoyer en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'Upload failed',
      details: error.message
    });
  }
});

// 📥 Route download depuis Walrus
app.get('/api/audio/:blobId', async (req, res) => {
  try {
    const { blobId } = req.params;
    const cacheFile = path.join(CACHE_DIR, `${blobId}.mp3`);

    console.log(`🎵 Request for: ${blobId}`);

    // Vérifier cache
    if (fs.existsSync(cacheFile)) {
      console.log('✅ Serving from cache');
      return streamAudioFile(cacheFile, res);
    }

    // Download depuis Walrus
    console.log('🔄 Downloading from Walrus...');
    const audioBuffer = await downloadFromWalrus(blobId);

    // Sauver en cache
    fs.writeFileSync(cacheFile, audioBuffer);

    // Stream vers client
    streamAudioFile(cacheFile, res);

  } catch (error) {
    console.error('❌ Audio error:', error);
    res.status(500).json({
      error: 'Failed to fetch audio',
      details: error.message
    });
  }
});

// 📤 FONCTION: Upload vers Walrus
async function uploadToWalrus(fileBuffer, epochs = 5) {
  try {
    console.log(`📤 Uploading ${fileBuffer.length} bytes to Walrus...`);

    const response = await fetch(`${WALRUS_CONFIG.publisher}/v1/store?epochs=${epochs}`, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Walrus upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('📥 Walrus response:', result);

    const blobId = result.newlyCreated?.blobObject?.blobId ||
                   result.alreadyCertified?.blobObject?.blobId;

    if (!blobId) {
      throw new Error('Blob ID not found in response');
    }

    console.log(`✅ Upload success: ${blobId}`);
    return blobId;

  } catch (error) {
    console.error('❌ Walrus upload error:', error);
    throw error;
  }
}

// 📥 FONCTION: Download depuis Walrus
async function downloadFromWalrus(blobId) {
  try {
    console.log(`📥 Downloading ${blobId} from Walrus...`);

    const response = await fetch(`${WALRUS_CONFIG.aggregator}/v1/${blobId}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Walrus download failed: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`✅ Downloaded ${buffer.length} bytes`);
    return buffer;

  } catch (error) {
    console.error('❌ Walrus download error:', error);
    throw error;
  }
}

// 🎵 FONCTION: Stream audio vers client
function streamAudioFile(filePath, res) {
  const stat = fs.statSync(filePath);

  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600'
  });

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  stream.on('error', (err) => {
    console.error('❌ Stream error:', err);
    res.status(500).end();
  });
}

// 🚀 Démarrer serveur
app.listen(PORT, () => {
  console.log(`🎵 Music Jukebox Backend démarré!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📂 Cache: ${CACHE_DIR}`);
  console.log(`🔗 Walrus Publisher: ${WALRUS_CONFIG.publisher}`);
  console.log(`🔗 Walrus Aggregator: ${WALRUS_CONFIG.aggregator}`);
});
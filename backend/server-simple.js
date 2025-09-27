import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const PORT = 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, 'audio_cache');

// URLs Walrus - Liste des endpoints disponibles (fallback si un ne marche pas)
const WALRUS_AGGREGATORS = [
  "https://aggregator.walrus-testnet.walrus.space",
  "https://wal-aggregator-testnet.staketab.org",
  "https://walrus-testnet-aggregator.bartestnet.com",
  "https://walrus-testnet.blockscope.net",
  "https://walrus-testnet-aggregator.nodes.guru",
  "https://walrus-cache-testnet.overclock.run"
];

const WALRUS_PUBLISHERS = [
  "https://publisher.walrus-testnet.walrus.space",
  "https://wal-publisher-testnet.staketab.org",
  "https://walrus-testnet-publisher.bartestnet.com",
  "https://walrus-testnet-publisher.nodes.guru",
  "https://walrus-testnet-publisher.stakin-nodes.com",
  "https://testnet-publisher-walrus.kiliglab.io",
  "https://walrus-testnet-publisher.nodeinfra.com",
  "https://walrus-publisher.rubynodes.io",
  "https://walrus-testnet-publisher.brightlystake.com",
  "https://walrus-testnet-publisher.nami.cloud",
  "https://walrus-testnet-publisher.stakecraft.com",
  "https://pub.test.walrus.eosusa.io",
  "https://walrus-pub.testnet.obelisk.sh"
];

// Créer dossier cache
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 🎵 SERVEUR HTTP SIMPLE
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;
  const pathname = url.pathname;

  console.log(`${method} ${pathname}`);

  try {
    // 🏠 Route principale
    if (pathname === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: '🎵 Music Jukebox Backend (Simple)',
        status: 'OK',
        endpoints: {
          health: 'GET /api/health',
          upload: 'POST /api/upload',
          audio: 'GET /api/audio/:blobId'
        }
      }));
      return;
    }

    // 🔍 Route health
    if (pathname === '/api/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'OK',
        walrus: {
          aggregators: WALRUS_AGGREGATORS.length + ' endpoints',
          publishers: WALRUS_PUBLISHERS.length + ' endpoints',
          primary_aggregator: WALRUS_AGGREGATORS[0]
        },
        cache: fs.readdirSync(CACHE_DIR).length + ' files',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // 📥 Route audio streaming (GET et HEAD)
    if (pathname.startsWith('/api/audio/') && (method === 'GET' || method === 'HEAD')) {
      const blobId = pathname.split('/api/audio/')[1];

      if (!blobId) {
        sendError(res, 400, 'Blob ID requis');
        return;
      }

      await handleAudioRequest(blobId, res, method);
      return;
    }

    // 📤 Route upload vers Walrus
    if (pathname === '/api/upload' && method === 'POST') {
      await handleUploadRequest(req, res);
      return;
    }

    // Route non trouvée
    sendError(res, 404, 'Route non trouvée');

  } catch (error) {
    console.error('❌ Server error:', error);
    sendError(res, 500, error.message);
  }
});

// 📥 FONCTION: Gérer requête audio (GET et HEAD)
async function handleAudioRequest(blobId, res, method = 'GET') {
  try {
    const cacheFile = path.join(CACHE_DIR, `${blobId}.mp3`);

    console.log(`🎵 ${method} request for: ${blobId}`);

    // Vérifier cache
    if (fs.existsSync(cacheFile)) {
      console.log('✅ Serving from cache');
      streamAudioFile(cacheFile, res, method);
      return;
    }

    // Download depuis Walrus
    console.log('🔄 Downloading from Walrus...');
    const audioBuffer = await downloadFromWalrus(blobId);

    // Sauver en cache
    fs.writeFileSync(cacheFile, audioBuffer);
    console.log(`💾 Cached ${audioBuffer.length} bytes`);

    // Stream vers client
    streamAudioFile(cacheFile, res, method);

  } catch (error) {
    console.error('❌ Audio error:', error);
    sendError(res, 500, `Failed to fetch audio: ${error.message}`);
  }
}

// 📤 FONCTION: Gérer upload de fichier
async function handleUploadRequest(req, res) {
  try {
    console.log('📤 Upload request received');

    // Parse multipart form data
    const { fileBuffer, filename } = await parseMultipartFormData(req);

    if (!fileBuffer) {
      sendError(res, 400, 'Aucun fichier trouvé dans la requête');
      return;
    }

    console.log(`📁 File received: ${filename} (${fileBuffer.length} bytes)`);

    // Upload vers Walrus
    const blobId = await uploadToWalrus(fileBuffer);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      blobId,
      filename,
      size: fileBuffer.length,
      message: 'Upload réussi vers Walrus'
    }));

  } catch (error) {
    console.error('❌ Upload error:', error);
    sendError(res, 500, `Upload failed: ${error.message}`);
  }
}

// 📤 FONCTION: Parse multipart form data (sans npm)
async function parseMultipartFormData(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('multipart/form-data')) {
      reject(new Error('Content-Type must be multipart/form-data'));
      return;
    }

    // Extraire boundary
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      reject(new Error('No boundary found in Content-Type'));
      return;
    }

    let data = Buffer.alloc(0);

    req.on('data', chunk => {
      data = Buffer.concat([data, chunk]);
    });

    req.on('end', () => {
      try {
        const result = parseFormData(data, boundary);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

// 📄 FONCTION: Parser les données du formulaire
function parseFormData(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  // Trouver toutes les parties
  while (true) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;

    if (start !== 0) {
      parts.push(buffer.slice(start, boundaryIndex));
    }

    start = boundaryIndex + boundaryBuffer.length;
  }

  // Parser chaque partie pour trouver le fichier
  for (const part of parts) {
    if (part.length === 0) continue;

    // Séparer headers et body
    const headerEndIndex = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex === -1) continue;

    const headers = part.slice(0, headerEndIndex).toString();
    const body = part.slice(headerEndIndex + 4, part.length - 2); // -2 pour \r\n final

    // Vérifier si c'est un fichier
    if (headers.includes('filename=')) {
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'uploaded_file';

      return {
        fileBuffer: body,
        filename: filename
      };
    }
  }

  throw new Error('No file found in form data');
}

// 📤 FONCTION: Upload vers Walrus (avec fallback publishers)
async function uploadToWalrus(fileBuffer, epochs = 5) {
  console.log(`📤 Uploading ${fileBuffer.length} bytes to Walrus...`);

  // Essayer plusieurs publishers jusqu'à ce qu'un fonctionne
  for (let i = 0; i < WALRUS_PUBLISHERS.length; i++) {
    const publisher = WALRUS_PUBLISHERS[i];

    try {
      console.log(`🔄 Upload tentative ${i + 1}/${WALRUS_PUBLISHERS.length}: ${publisher}`);

      const response = await fetch(`${publisher}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });

      if (!response.ok) {
        console.log(`❌ Publisher ${publisher} failed: ${response.status} ${response.statusText}`);
        continue; // Essayer le suivant
      }

      const result = await response.json();
      console.log('📥 Walrus upload response:', result);

      // Extraire le Blob ID
      const blobId = result.newlyCreated?.blobObject?.blobId ||
                     result.alreadyCertified?.blobObject?.blobId;

      if (!blobId) {
        console.log(`❌ Publisher ${publisher}: No Blob ID in response`);
        continue;
      }

      console.log(`✅ Upload success with ${publisher}! Blob ID: ${blobId}`);
      return blobId;

    } catch (error) {
      console.log(`❌ Publisher ${publisher} error:`, error.message);

      // Si c'est le dernier publisher, throw l'erreur
      if (i === WALRUS_PUBLISHERS.length - 1) {
        throw new Error(`All Walrus publishers failed. Last error: ${error.message}`);
      }

      // Sinon continuer avec le suivant
      continue;
    }
  }
}

// 📥 FONCTION: Download depuis Walrus (avec fallback sur plusieurs endpoints)
async function downloadFromWalrus(blobId) {
  console.log(`📥 Downloading ${blobId} from Walrus...`);

  // Essayer plusieurs aggregators jusqu'à ce qu'un fonctionne
  for (let i = 0; i < WALRUS_AGGREGATORS.length; i++) {
    const aggregator = WALRUS_AGGREGATORS[i];

    try {
      console.log(`🔄 Tentative ${i + 1}/${WALRUS_AGGREGATORS.length}: ${aggregator}`);

      const response = await fetch(`${aggregator}/v1/blobs/${blobId}`);

      if (!response.ok) {
        console.log(`❌ Endpoint ${aggregator} failed: ${response.status} ${response.statusText}`);
        continue; // Essayer le suivant
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✅ Success with ${aggregator}! Downloaded ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      console.log(`❌ Endpoint ${aggregator} error:`, error.message);

      // Si c'est le dernier endpoint, throw l'erreur
      if (i === WALRUS_AGGREGATORS.length - 1) {
        throw new Error(`All Walrus aggregators failed. Last error: ${error.message}`);
      }

      // Sinon continuer avec le suivant
      continue;
    }
  }
}

// 🎵 FONCTION: Stream audio vers client (supporte GET et HEAD)
function streamAudioFile(filePath, res, method = 'GET') {
  try {
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });

    // Pour HEAD, on envoie seulement les headers (pas le body)
    if (method === 'HEAD') {
      res.end();
      return;
    }

    // Pour GET, on stream le fichier
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('❌ Stream error:', err);
      res.destroy();
    });

  } catch (error) {
    console.error('❌ Stream setup error:', error);
    sendError(res, 500, 'Stream error');
  }
}

// ❌ FONCTION: Envoyer erreur
function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: message,
    timestamp: new Date().toISOString()
  }));
}

// 🚀 Démarrer serveur
server.listen(PORT, () => {
  console.log(`🎵 Music Jukebox Backend (Simple) démarré!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📂 Cache: ${CACHE_DIR}`);
  console.log(`🔗 Walrus Aggregators: ${WALRUS_AGGREGATORS.length} endpoints`);
  console.log(`🔗 Primary: ${WALRUS_AGGREGATORS[0]}`);
  console.log('');
  console.log('📋 Endpoints disponibles:');
  console.log('  GET  /api/health');
  console.log('  POST /api/upload');
  console.log('  GET  /api/audio/:blobId');
  console.log('');
  console.log('💡 Aucune dépendance npm requise!');
});
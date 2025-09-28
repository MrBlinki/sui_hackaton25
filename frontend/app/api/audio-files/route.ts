import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    const files = await readdir(audioDir);
    
    // Filtrer pour ne garder que les fichiers audio et exclure README.md
    const audioFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext);
      })
      .map(file => {
        const nameWithoutExt = path.parse(file).name;
        return {
          title: nameWithoutExt.replace(/[-_]/g, ' '), // Remplace - et _ par des espaces
          file: nameWithoutExt, // nom sans extension
          filename: file // nom complet avec extension
        };
      });

    return NextResponse.json({ files: audioFiles });
  } catch (error) {
    console.error('Error reading audio directory:', error);
    return NextResponse.json({ files: [] });
  }
}
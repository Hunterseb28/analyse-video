import express from 'express';
import cors from 'cors';
import youtubedl from 'yt-dlp-exec';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '16kb' }));

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

app.get('/api/resolve', async (req, res) => {
  const url = String(req.query.url || '').trim();

  if (!validHttpUrl(url)) {
    return res.status(400).json({ error: 'URL invalide.' });
  }

  try {
    const result = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      skipDownload: true,
      format: 'best[ext=mp4]/best',
    });

    if (!result.url) {
      return res.status(422).json({ error: 'Aucun flux vidéo direct trouvé.' });
    }

    res.json({
      title: result.title || 'Vidéo',
      duration: result.duration || null,
      url: result.url,
      webpageUrl: result.webpage_url || url,
    });
  } catch (error) {
    console.error('resolve error:', error?.stderr || error?.message || error);
    res.status(422).json({
      error: 'Impossible de récupérer un flux vidéo depuis cette URL.',
    });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Analyse Video API listening on port ${PORT}`);
});

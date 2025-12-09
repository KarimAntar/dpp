require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';


// Serve static files from "public"
app.use(express.static(path.join(__dirname, 'public')));

// Optional: explicitly serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (!BOT_TOKEN) throw new Error('Set DISCORD_BOT_TOKEN in .env');

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ----- Utilities -----
function defaultAvatarUrl(id, discriminator = '0') {
  const idBig = BigInt(id);
  let idx;
  if (discriminator === '0') {
    idx = Number((idBig >> 22n) % 6n);
  } else {
    idx = parseInt(discriminator, 10) % 5;
  }
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function avatarCdnUrl(userId, avatarHash, size = 4096, discriminator = '0') {
  if (!avatarHash) return defaultAvatarUrl(userId, discriminator);
  const isAnimated = avatarHash.startsWith('a_');
  const format = isAnimated ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=${size}`;
}

function creationDateFromId(id) {
  const discordEpoch = 1420070400000n;
  const snowflake = BigInt(id);
  const timestamp = (snowflake >> 22n) + discordEpoch;
  return new Date(Number(timestamp)).toLocaleString();
}

// ----- API Endpoint -----
app.get('/api/avatar/:id', async (req, res) => {
  const id = req.params.id;
  const size = req.query.size ? Number(req.query.size) : 4096;

  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid Discord ID' });

  try {
    const response = await fetch(`${DISCORD_API}/users/${id}`, {
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'User-Agent': 'AvatarFetcher/1.0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Discord API error ${response.status}`, details: text });
    }

    const user = await response.json();
    const data = {
      id: user.id,
      username: user.username,
      global_name: user.global_name || null,
      discriminator: user.discriminator,
      avatar: avatarCdnUrl(user.id, user.avatar, size, user.discriminator),
      avatarDecoration: null,
      banner: user.banner || null,
      accentColor: user.accent_color || null,
      bannerColor: user.banner_color || null,
      isBot: user.bot || false,
      isSystem: false,
      flags: user.flags || [],
      nitroType: {
        value: 0,
        name: 'Unknown',
        description: 'Unknown Nitro Type',
        icon: 'icon-url-for-unknown'
      },
      creationDate: creationDateFromId(user.id)
    };
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

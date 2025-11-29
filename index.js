require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const shortid = require('shortid');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(express.json());
app.use(cors()); 

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado!'))
  .catch(err => console.log('Error de conexión:', err));

const urlSchema = new mongoose.Schema({
  shortId: { type: String, required: true, unique: true },
  redirectURL: { type: String, required: true },
  visitHistory: [{ timestamp: { type: Number } }], 
});

const URLModel = mongoose.model('URL', urlSchema);

app.post('/url', async (req, res) => {
  const body = req.body;
  let urlOriginal = body.url;
  const customAlias = body.customId;

  if (!urlOriginal.startsWith('http://') && !urlOriginal.startsWith('https://')) {
    urlOriginal = 'https://' + urlOriginal;
  }
  
  try {
    new URL(urlOriginal); 
  } catch (err) {
    console.log("Error validando URL:", err.message);
    return res.status(400).json({ error: 'URL inválida. Asegúrate de incluir http:// o https://' });
  }

  let shortID;
  if (customAlias) {
    const existe = await URLModel.findOne({ shortId: customAlias });
    if (existe) {
      return res.status(400).json({ error: '¡Ese nombre personalizado ya está en uso!' });
    }
    shortID = customAlias;
  } else {
    shortID = shortid.generate();
  }

  await URLModel.create({
    shortId: shortID,
    redirectURL: urlOriginal,
    visitHistory: [],
  });

  const linkCorto = `https://gr3link.onrender.com/${shortID}`;
  const qrImage = await QRCode.toDataURL(linkCorto, { width: 300, margin: 2 });

  return res.json({ id: shortID, qr: qrImage });
});

app.get('/:shortId', async (req, res) => {
  const shortId = req.params.shortId;
  
  const entry = await URLModel.findOneAndUpdate(
    { shortId },
    { 
      $push: { 
        visitHistory: { timestamp: Date.now() } 
      },
    }
  );
  
  if(entry) {
    res.redirect(entry.redirectURL);
  } else {
    res.status(404).send("URL no encontrada");
  }
});

app.get('/analytics/:shortId', async (req, res) => {
  const shortId = req.params.shortId;
  const result = await URLModel.findOne({ shortId });

  if (!result) return res.status(404).json({ error: "No encontrado" });

  return res.json({ 
    totalClicks: result.visitHistory.length, 
    analytics: result.visitHistory 
  });
});

app.listen(8001, () => console.log('Servidor corriendo en puerto 8001'));
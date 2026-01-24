import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import EventEmitter from 'events'; // ഈ രീതിയിലേക്ക് മാറ്റി

// Importing the routers
import pairRouter from './pair.js';
import qrRouter from './qr.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// പഴയ എറർ വന്ന ഭാഗം മാറ്റി ലളിതമാക്കി
EventEmitter.defaultMaxListeners = 1000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

app.use((req, res) => {
    res.status(404).send('Page Not Found - LIZA-AI');
});

app.listen(PORT, '0.0.0.0', () => { 
 console.log(`\n\n=========================================`);
 console.log(`🚀 LIZA-PAIR SERVER IS ACTIVE!`);
 console.log(`👤 MADE BY: (hank!nd3 p4d4y41!)`);
 console.log(`📡 URL: http://0.0.0.0:${PORT}`);
 console.log(`=========================================\n\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is busy. Trying again...`);
    }
});

export default app;

import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import EventEmitter from 'events';

// Importing the routers
import pairRouter from './pair.js';
import qrRouter from './qr.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// മെമ്മറി ലീക്ക് വാണിംഗുകൾ ഒഴിവാക്കാൻ
EventEmitter.defaultMaxListeners = 1500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// സ്റ്റാറ്റിക് ഫയലുകൾ കൃത്യമായി ലോഡ് ചെയ്യാൻ ഇത് മാറ്റിയെഴുതി
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

app.use((req, res) => {
    res.status(404).send('Page Not Found - LIZA-AI');
});

const server = app.listen(PORT, '0.0.0.0', () => { 
    console.log(`\n\n=========================================`);
    console.log(`🚀 LIZA-PAIR SERVER IS ACTIVE!`);
    console.log(`👤 MADE BY: (hank!nd3 p4d4y41!)`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`=========================================\n\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is busy. Re-trying with another setup...`);
        setTimeout(() => {
            server.close();
            app.listen(PORT);
        }, 1000);
    } else {
        console.error('Server Error:', err);
    }
});

export default app;

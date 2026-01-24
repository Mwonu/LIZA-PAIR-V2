import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';

// Importing the routers
import pairRouter from './pair.js';
import qrRouter from './qr.js';

const app = express();

// Resolve the current directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PORT സെറ്റിംഗ്സ് പുതുക്കി - Replit-ൽ പോർട്ട് ബിസി ആണെങ്കിൽ മറ്റൊന്ന് എടുക്കും
const PORT = process.env.PORT || 8080; 

// ലാഗ് ഒഴിവാക്കാൻ ലിസണർ ലിമിറ്റ് കൂട്ടുന്നു
import('events').then(events => {
    if (events && events.defaultMaxListeners) {
        events.defaultMaxListeners = 1000;
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// സ്റ്റാറ്റിക് ഫയലുകൾ (CSS, Images, pair.html) ലോഡ് ചെയ്യാൻ
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// 404 Error handling
app.use((req, res) => {
    res.status(404).send('Page Not Found - LIZA-AI');
});

// സെർവർ സ്റ്റാർട്ട് ചെയ്യുന്നു
app.listen(PORT, '0.0.0.0', () => { 
 console.log(`\n\n=========================================`);
 console.log(`🚀 LIZA-PAIR SERVER IS STARTING...`);
 console.log(`👤 MADE BY: (hank!nd3 p4d4y41!)`);
 console.log(`📡 URL: http://0.0.0.0:${PORT}`);
 console.log(`=========================================\n\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is busy. Please wait a moment or restart Replit.`);
    } else {
        console.log(err);
    }
});

export default app;

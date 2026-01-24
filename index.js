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

// Replit-ൽ 0.0.0.0 ഹോസ്റ്റ് തന്നെയാണ് നല്ലത്
const PORT = process.env.PORT || 5000;

// ലാഗ് ഒഴിവാക്കാൻ ലിസണർ ലിമിറ്റ് കൂട്ടുന്നു
import('events').then(events => {
    if (events.EventEmitter) {
        events.EventEmitter.defaultMaxListeners = 1000;
    }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// സ്റ്റാറ്റിക് ഫയലുകൾ കൃത്യമായി ലോഡ് ചെയ്യാൻ
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    // pair.html ഫയൽ തന്നെയാണോ എന്ന് ഉറപ്പുവരുത്തുക
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// 404 Error handling (തെറ്റായ പേജിൽ പോയാൽ റീഡയറക്ട് ചെയ്യാൻ)
app.use((req, res) => {
    res.status(404).send('Page Not Found - LIZA-AI');
});

app.listen(PORT, '0.0.0.0', () => { 
 console.log(`\n\n=========================================`);
 console.log(`🚀 LIZA-PAIR SERVER IS ACTIVE!`);
 console.log(`👤 MADE BY: (hank!nd3 p4d4y41!)`);
 console.log(`📡 URL: http://0.0.0.0:${PORT}`);
 console.log(`=========================================\n\n`);
});

export default app;

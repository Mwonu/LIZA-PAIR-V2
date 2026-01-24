import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { 
    makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore, 
    Browsers, 
    jidNormalizedUser, 
    fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ code: "Phone number is required" });

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 10) {
        return res.status(400).send({ code: 'Invalid phone number format. Include country code.' });
    }

    let dirs = './' + num;
    await removeFile(dirs);

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.ubuntu("Chrome"), 
                connectTimeoutMs: 120000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(8000); 
                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    console.error("Pairing Code Error:", error);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Service Unavailable' });
                    }
                }
            }

            KnightBot.ev.on('creds.update', saveCreds);

            KnightBot.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                if (connection === 'open') {
                    await delay(5000);
                    try {
                        const sessionPath = dirs + '/creds.json';
                        if (fs.existsSync(sessionPath)) {
                            // ഫയൽ റീഡ് ചെയ്ത് Base64 ആക്കി മാറ്റുന്നു
                            const sessionKnight = fs.readFileSync(sessionPath);
                            const base64Session = Buffer.from(sessionKnight).toString('base64');
                            const sessionID = "Session~" + base64Session;

                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // വാട്സാപ്പിലേക്ക് SESSION_ID മെസ്സേജ് അയക്കുന്നു
                            await KnightBot.sendMessage(userJid, {
                                text: sessionID
                            });

                            await KnightBot.sendMessage(userJid, {
                                text: `✅ *LIZA-AI CONNECTED SUCCESSFULLY!*\n\nCopy the above Session ID and use it in your Hugging Face/Render environment variables.`
                            });
                        }

                        await delay(2000);
                        removeFile(dirs);
                        // സെഷൻ അയച്ചു കഴിഞ്ഞാൽ പ്രോസസ്സ് സ്റ്റോപ്പ് ചെയ്യുക
                        process.exit(0); 
                    } catch (e) {
                        console.log("Message send error:", e);
                    }
                }
                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) initiateSession();
                }
            });
        } catch (err) {
            console.error("Initialization Error:", err);
        }
    }
    await initiateSession();
});

export default router;

limport express from 'express';
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

    // ഇന്ത്യക്കാരാണെങ്കിൽ 91 ഓട്ടോമാറ്റിക്കായി ചേർക്കുന്നു
    if (num.length === 10 && !num.startsWith('91')) {
        num = '91' + num;
    }

    let dirs = './' + num;
    await removeFile(dirs);

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            
            // KnightBot മാറ്റി LIZA_AI എന്നാക്കി - (hank!nd3 p4d4y41!)
            let LIZA_AI = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.ubuntu("Chrome"), // പഴയ കോഡിലെ അതേ സെറ്റിംഗ്സ്
                connectTimeoutMs: 120000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 10000,
                syncFullHistory: false,
            });

            if (!LIZA_AI.authState.creds.registered) {
                // പഴയ കോഡിലെ പോലെ 8 സെക്കൻഡ് ഡിലേ നൽകുന്നു (കൂടുതൽ സ്റ്റേബിൾ ആണ്)
                await delay(8000); 
                try {
                    let code = await LIZA_AI.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    console.error("Pairing Code Error:", error);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'വാട്സാപ്പ് സെർവർ ബിസിയാണ്. ദയവായി അല്പം കഴിഞ്ഞ് ശ്രമിക്കൂ.' });
                    }
                }
            }

            LIZA_AI.ev.on('creds.update', saveCreds);

            LIZA_AI.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    await delay(5000);
                    try {
                        const sessionPath = dirs + '/creds.json';
                        if (fs.existsSync(sessionPath)) {
                            const sessionData = fs.readFileSync(sessionPath);
                            const base64Session = Buffer.from(sessionData).toString('base64');
                            const sessionID = "LIZA~" + base64Session;

                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            await LIZA_AI.sendMessage(userJid, { text: sessionID });

                            await LIZA_AI.sendMessage(userJid, {
                                text: `✅ *LIZA-AI CONNECTED!*\n\n*Developer:* (hank!nd3 p4d4y41!)\n\n_ഈ സെഷൻ ഐഡി സുരക്ഷിതമായി സൂക്ഷിക്കുക._`
                            });
                        }

                        await delay(2000);
                        removeFile(dirs);
                        setTimeout(() => { process.exit(0); }, 3000); 
                    } catch (e) {
                        console.log("Message send error:", e);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) initiateSession();
                    else removeFile(dirs);
                }
            });
        } catch (err) {
            console.error("Initialization Error:", err);
            removeFile(dirs);
        }
    }
    await initiateSession();
});

export default router;

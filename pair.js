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

    // ഇന്ത്യക്കാരാണെങ്കിൽ 91 ഓട്ടോമാറ്റിക്കായി ചേർക്കുന്നു
    if (num.length === 10 && !num.startsWith('91')) {
        num = '91' + num;
    }

    let dirs = './' + num;
    await removeFile(dirs);

    // സുരക്ഷിതമായി കണക്ഷൻ ക്ലോസ് ചെയ്യാനുള്ള വേരിയബിൾ
    let connectionTimeout;

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            
            let LIZA_AI = makeWASocket({
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
                syncFullHistory: false,
            });

            if (!LIZA_AI.authState.creds.registered) {
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
                    clearTimeout(connectionTimeout); // കണക്ട് ആയാൽ ടൈംഔട്ട് ഒഴിവാക്കുന്നു
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
                        // സോക്കറ്റ് സുരക്ഷിതമായി ക്ലോസ് ചെയ്യുന്നു
                        LIZA_AI.end();
                        removeFile(dirs);
                    } catch (e) {
                        console.log("Message send error:", e);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        // ക്രാഷ് ആകാതിരിക്കാൻ ചെറിയൊരു ഡിലേ ഇട്ട് റീ-കണക്ട് ചെയ്യുക
                        setTimeout(() => { initiateSession(); }, 3000);
                    } else {
                        removeFile(dirs);
                    }
                }
            });

            // ⚠️ സുരക്ഷാ ക്രമീകരണം: 2 മിനിറ്റിനുള്ളിൽ കണക്ട് ചെയ്തില്ലെങ്കിൽ ബാക്ക്ഗ്രൗണ്ട് പ്രോസസ് തനിയെ നിർത്തുന്നു
            connectionTimeout = setTimeout(() => {
                try {
                    LIZA_AI.end();
                    removeFile(dirs);
                } catch (e) {}
            }, 120000);

        } catch (err) {
            console.error("Initialization Error:", err);
            removeFile(dirs);
        }
    }
    await initiateSession();
});

export default router;

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
                // ട്രസ്റ്റഡ് ആയ ബ്രൗസർ ഫോർമാറ്റ്
                browser: Browsers.macOS("Desktop"), 
                connectTimeoutMs: 60000,
                syncFullHistory: false, // പഴയ മെസ്സേജുകൾ ലോഡ് ചെയ്യുന്നത് ഒഴിവാക്കി ✅
                markOnlineOnConnect: true,
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000); 
                try {
                    let code = await KnightBot.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    console.error("Pairing Code Error:", error);
                    if (!res.headersSent) {
                        res.status(500).send({ code: 'വാട്സാപ്പ് സെർവർ ബിസിയാണ്, അല്പം കഴിഞ്ഞ് ശ്രമിക്കൂ.' });
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
                            const sessionKnight = fs.readFileSync(sessionPath);
                            const base64Session = Buffer.from(sessionKnight).toString('base64');
                            const sessionID = "LIZA~" + base64Session;

                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // വാട്സാപ്പിലേക്ക് സെഷൻ ഐഡി അയക്കുന്നു
                            await KnightBot.sendMessage(userJid, { text: sessionID });

                            await KnightBot.sendMessage(userJid, {
                                text: `✅ *LIZA-AI CONNECTED!*\n\n*Developer:* (hank!nd3 p4d4y41!)\n\n_ഈ ഐഡി സുരക്ഷിതമായി സൂക്ഷിക്കുക._`
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
                    if (statusCode !== 401) {
                        initiateSession();
                    } else {
                        removeFile(dirs);
                    }
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

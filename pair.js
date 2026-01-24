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

// ഫയലുകൾ കൃത്യമായി ക്ലീൻ ചെയ്യാനുള്ള ഫംഗ്ഷൻ
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
            
            // Stronger Connection Configuration - (hank!nd3 p4d4y41!)
            let KnightBot = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                // വാട്സാപ്പിൽ ലോഗിൻ ചെയ്യുമ്പോൾ ബ്രൗസർ പേര് LIZA-AI എന്ന് കാണിക്കും
                browser: ["LIZA-AI", "Safari", "1.0.0"], 
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                syncFullHistory: false, // ഹിസ്റ്ററി സിങ്ക് ഓഫ് ആക്കുന്നത് വേഗത കൂട്ടും
                markOnlineOnConnect: true,
            });

            if (!KnightBot.authState.creds.registered) {
                await delay(3000); // ഡിലേ കുറച്ചു (സ്പീഡ് കൂട്ടാൻ)
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
                    await delay(3000);
                    try {
                        const sessionPath = dirs + '/creds.json';
                        if (fs.existsSync(sessionPath)) {
                            const sessionKnight = fs.readFileSync(sessionPath);
                            const base64Session = Buffer.from(sessionKnight).toString('base64');
                            const sessionID = "Session~" + base64Session;

                            const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                            
                            // പ്രീമിയം വെരിഫിക്കേഷൻ മെസ്സേജ്
                            await KnightBot.sendMessage(userJid, {
                                text: sessionID
                            });

                            await KnightBot.sendMessage(userJid, {
                                text: `✅ *LIZA-AI CONNECTED SUCCESSFULLY!*\n\n*Developer:* (hank!nd3 p4d4y41!)\n*Status:* Strong Session Active\n\n_ഈ സെഷൻ ഐഡി സുരക്ഷിതമായി വെക്കുക._`
                            });
                        }

                        await delay(2000);
                        removeFile(dirs);
                        // സെഷൻ അയച്ചു കഴിഞ്ഞാൽ ഉടൻ പ്രോസസ്സ് ക്ലോസ് ചെയ്യാതെ ചെറിയ ഗ്യാപ്പ് നൽകുന്നു
                        setTimeout(() => { process.exit(0); }, 5000); 
                    } catch (e) {
                        console.log("Message send error:", e);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    // സെഷൻ എറർ വന്നാൽ തനിയെ റീകണക്ട് ചെയ്യാനുള്ള സ്ട്രോങ്ങ് ലോജിക്
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

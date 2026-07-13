import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { 
    makeWASocket, 
    useMultiFileAuthState, 
    makeCacheableSignalKeyStore, 
    Browsers, 
    jidNormalizedUser, 
    fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import { delay } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

router.get('/', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const dirs = `./qr_sessions/session_${sessionId}`;

    if (!fs.existsSync('./qr_sessions')) {
        fs.mkdirSync('./qr_sessions', { recursive: true });
    }

    let connectionTimeout;

    async function initiateSession() {
        if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            
            let qrGenerated = false;
            let responseSent = false;

            const socketConfig = {
                version,
                logger: pino({ level: 'silent' }),
                browser: ["LIZA-AI", "Safari", "1.0.0"], 
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                syncFullHistory: false, 
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
            };

            let sock = makeWASocket(socketConfig);

            const handleConnectionUpdate = async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // QR കോഡ് ക്ലയന്റിന് അയക്കുന്നു
                if (qr && !qrGenerated && !responseSent) {
                    qrGenerated = true;
                    try {
                        const qrDataURL = await QRCode.toDataURL(qr);
                        responseSent = true;
                        res.send({ 
                            qr: qrDataURL, 
                            message: 'LIZA-AI QR Code Generated!',
                            instructions: [
                                '1. Open WhatsApp Settings',
                                '2. Linked Devices > Link a Device',
                                '3. Scan this QR code'
                            ]
                        });
                    } catch (err) {
                        if (!responseSent) {
                            responseSent = true;
                            res.status(500).send({ code: 'QR Error' });
                        }
                    }
                }

                if (connection === 'open') {
                    clearTimeout(connectionTimeout); // കണക്ട് ആയാൽ ഓട്ടോ-ക്ലോസ് ടൈംഔട്ട് ഒഴിവാക്കുന്നു
                    await delay(5000);
                    try {
                        const sessionPath = dirs + '/creds.json';
                        if (fs.existsSync(sessionPath)) {
                            const sessionKnight = fs.readFileSync(sessionPath);
                            
                            // സെഷൻ ഐഡി Base64 ആക്കുന്നു
                            const base64Session = Buffer.from(sessionKnight).toString('base64');
                            const sessionID = "LIZA~" + base64Session;

                            const userJid = jidNormalizedUser(sock.authState.creds.me.id);
                                
                            if (userJid) {
                                // സെഷൻ ഐഡി ടെക്സ്റ്റ് ആയി അയക്കുന്നു
                                await sock.sendMessage(userJid, { text: sessionID });

                                // ബാനർ ഇമേജ് സഹിതം ഇൻഫോർമേഷൻ അയക്കുന്നു
                                await sock.sendMessage(userJid, {
                                    image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                                    caption: `✅ *LIZA-AI QR CONNECTED!*\n\n*Developer:* (hank!nd3 p4d4y41!)\n\nസെഷൻ ഐഡി മുകളിൽ നൽകിയിട്ടുണ്ട്. ഇത് സുരക്ഷിതമായി സൂക്ഷിക്കുക.`
                                });
                            }
                        }
                    } catch (error) {
                        console.error("Error during session messaging:", error);
                    }
                    
                    // സുരക്ഷിതമായി സോക്കറ്റ് അറുത്തു മാറ്റുകയും താൽക്കാലിക ഫോൾഡർ നീക്കം ചെയ്യുകയും ചെയ്യുന്നു
                    setTimeout(() => {
                        try {
                            sock.end();
                            removeFile(dirs);
                        } catch (e) {}
                    }, 10000);
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        // കണക്ഷൻ തടസ്സപ്പെട്ടാൽ മാത്രം വീണ്ടും കണക്ട് ചെയ്യാൻ ശ്രമിക്കുന്നു
                        setTimeout(() => { initiateSession(); }, 3000);
                    } else {
                        removeFile(dirs);
                    }
                }
            };

            sock.ev.on('connection.update', handleConnectionUpdate);
            sock.ev.on('creds.update', saveCreds);

            // ⚠️ സുരക്ഷാ ക്രಮീകരണം: 2 മിനിറ്റിനുള്ളിൽ ക്യുആർ സ്കാൻ ചെയ്തില്ലെങ്കിൽ പ്രോസസ് തനിയെ ക്ലോസ് ചെയ്യുന്നു
            connectionTimeout = setTimeout(() => {
                try {
                    sock.end();
                    removeFile(dirs);
                    if (!responseSent) {
                        responseSent = true;
                        res.status(408).send({ code: "Timeout: QR scanning expired" });
                    }
                } catch (e) {}
            }, 120000);

        } catch (err) {
            console.error("QR Session initialization error:", err);
            removeFile(dirs);
            if (!responseSent) {
                responseSent = true;
                res.status(500).send({ code: "Initialization failed" });
            }
        }
    }

    await initiateSession();
});

export default router;

import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
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
                // ✅ ബ്രൗസർ പേര് LIZA-AI എന്ന് മാറ്റി
                browser: ["LIZA-AI", "Safari", "1.0.0"], 
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                syncFullHistory: false, // സ്പീഡ് കൂട്ടാൻ ഹിസ്റ്ററി സിങ്ക് ഓഫ് ചെയ്തു
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
            };

            let sock = makeWASocket(socketConfig);

            const handleConnectionUpdate = async (update) => {
                const { connection, lastDisconnect, qr } = update;

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
                        if (!responseSent) res.status(500).send({ code: 'QR Error' });
                    }
                }

                if (connection === 'open') {
                    await delay(5000);
                    try {
                        const sessionPath = dirs + '/creds.json';
                        const sessionKnight = fs.readFileSync(sessionPath);
                        
                        // ✅ സെഷൻ ഐഡി Base64 ആക്കി മാറ്റുന്നു (പെയറിംഗ് കോഡിന് സമാനമായി)
                        const base64Session = Buffer.from(sessionKnight).toString('base64');
                        const sessionID = "Session~" + base64Session;

                        const userJid = jidNormalizedUser(sock.authState.creds.me.id);
                            
                        if (userJid) {
                            // ✅ സെഷൻ ഐഡി ടെക്സ്റ്റ് ആയി അയക്കുന്നു
                            await sock.sendMessage(userJid, { text: sessionID });

                            // ✅ നിങ്ങളുടെ പുതിയ ക്രെഡിറ്റ്സ് ചേർത്തു
                            await sock.sendMessage(userJid, {
                                image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                                caption: `✅ *LIZA-AI QR CONNECTED!*\n\n*Developer:* (hank!nd3 p4d4y41!)\n\nസെഷൻ ഐഡി മുകളിൽ നൽകിയിട്ടുണ്ട്. ഇത് സുരക്ഷിതമായി സൂക്ഷിക്കുക.`
                            });
                        }
                    } catch (error) {
                        console.error("Error:", error);
                    }
                    
                    setTimeout(() => {
                        removeFile(dirs);
                        process.exit(0);
                    }, 10000);
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        // റീകണക്ട് ലോജിക്
                    } else {
                        removeFile(dirs);
                    }
                }
            };

            sock.ev.on('connection.update', handleConnectionUpdate);
            sock.ev.on('creds.update', saveCreds);

        } catch (err) {
            removeFile(dirs);
        }
    }

    await initiateSession();
});

export default router;

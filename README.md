# Ayatollah Ransomware

This project is a simple ransomware implementation for educational purposes, available in three programming languages: C, Python, and JavaScript. Each implementation demonstrates how files in a directory can be encrypted using AES encryption, with the AES key itself being encrypted using RSA. The code also includes functionality to decrypt the files, simulating a ransomware attack and recovery process.

## **Disclaimer**
This code is for **educational purposes only**. Creating, distributing, or using ransomware is illegal and unethical. This project is intended to help security researchers and developers understand how ransomware works in order to better defend against it. Do not use this code for malicious purposes.

## **How It Works**
1. **Encryption**:
   - Each implementation generates an RSA key pair.
   - For each file in the specified directory, a random AES key is generated.
   - The file is encrypted using the AES key.
   - The AES key is then encrypted using the RSA public key and saved in a separate `.key` file.

2. **Decryption**:
   - Each implementation reads the encrypted AES key from the `.key` file.
   - The AES key is decrypted using the RSA private key.
   - The file is then decrypted using the AES key.

3. **Ransom Message**:
   - After encryption, a ransom message is displayed, simulating a typical ransomware demand.

## **Usage**
### C Implementation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Ayatollah-Ransomware.git
   ```
2. Compile the code using a C compiler (e.g., GCC):
   ```bash
   gcc src/c/ayatollah-ransomware.c -o ransomware -lcrypt32
   ```
3. Run the program:
   ```bash
   ./ransomware
   ```

### Python Implementation
1. Ensure you have Python installed along with the `cryptography` library:
   ```bash
   pip install cryptography
   ```
2. Run the Python script:
   ```bash
   python src/python/ayatollah-ransomware.py
   ```

### JavaScript Implementation
1. Ensure you have Node.js installed.
2. Run the JavaScript file:
   ```bash
   node src/javascript/ayatollah-ransomware.js
   ```

## **Important Notes**
- The code is designed to work on Windows due to its use of the Windows CryptoAPI in the C implementation. The Python and JavaScript implementations are cross-platform.
- The program targets the `C:\test` directory by default. Modify the code to change the target directory.
- **Do not run this code on important files or systems.** Use a controlled environment for testing.

## **Ethical Use**
This project is intended to raise awareness about ransomware and help developers understand how to protect against such attacks. Always use this knowledge responsibly and ethically.
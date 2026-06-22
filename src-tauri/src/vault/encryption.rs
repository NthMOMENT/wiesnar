use aes_gcm::{Aes256Gcm, Nonce, KeyInit};
use aes_gcm::aead::Aead;
use argon2::Argon2;
use rand::RngCore;
use zeroize::Zeroize;

pub struct EncryptedBlob {
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
}

/// Turns the Master Password into a 32-byte AES-256 key using Argon2.
/// Slow by design — this is what makes brute-forcing the password expensive.
fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Key derivation failed: {e}"))?;
    Ok(key)
}

/// Encrypts plaintext (the seed phrase) with a key derived from the master password.
/// Fresh random salt + nonce generated on every call — never reused.
pub fn encrypt(plaintext: &str, password: &str) -> Result<EncryptedBlob, String> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {e}"))?;

    key.zeroize(); // wipe derived key from RAM the instant it's no longer needed

    Ok(EncryptedBlob { salt: salt.to_vec(), nonce: nonce_bytes.to_vec(), ciphertext })
}

/// Decrypts a stored blob using the master password. Used later by "The Unlock".
pub fn decrypt(blob: &EncryptedBlob, password: &str) -> Result<String, String> {
    let mut key = derive_key(password, &blob.salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&blob.nonce);

    let plaintext_bytes = cipher
        .decrypt(nonce, blob.ciphertext.as_slice())
        .map_err(|_| "Incorrect password or corrupted vault.".to_string())?;

    key.zeroize();
    String::from_utf8(plaintext_bytes).map_err(|e| e.to_string())
}

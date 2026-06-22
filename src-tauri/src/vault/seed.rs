use bip39::Mnemonic;
use rand::RngCore;

/// Generates a fresh, cryptographically random 24-word BIP-39 seed phrase.
/// 24 words requires 256 bits (32 bytes) of entropy.
pub fn generate_seed_phrase() -> Result<String, String> {
    let mut entropy = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut entropy);

    let mnemonic = Mnemonic::from_entropy(&entropy).map_err(|e| e.to_string())?;
    Ok(mnemonic.to_string())
}

use bip39::{Language, Mnemonic};
use k256::ecdsa::SigningKey;
use k256::elliptic_curve::sec1::ToEncodedPoint;
use sha3::{Digest, Keccak256};
use tiny_hderive::bip32::ExtendedPrivKey;

/// Derives the standard Ethereum address (BIP-44 path m/44'/60'/0'/0/0)
/// from a 24-word BIP-39 seed phrase. No passphrase used (V1 scope).
pub fn derive_eth_address(seed_phrase: &str) -> Result<String, String> {
    let mnemonic = Mnemonic::parse_in_normalized(Language::English, seed_phrase)
        .map_err(|e| e.to_string())?;
    let seed = mnemonic.to_seed("");

    let ext_key = ExtendedPrivKey::derive(&seed, "m/44'/60'/0'/0/0")
        .map_err(|_| "Failed to derive HD key path.".to_string())?;

    let secret_key_bytes = ext_key.secret();

    let signing_key = SigningKey::from_slice(&secret_key_bytes).map_err(|e| e.to_string())?;
    let verifying_key = signing_key.verifying_key();
    let encoded_point = verifying_key.to_encoded_point(false); // uncompressed: 0x04 + X(32) + Y(32)
    let public_key_bytes = encoded_point.as_bytes();

    let mut hasher = Keccak256::new();
    hasher.update(&public_key_bytes[1..]); // skip the 0x04 prefix
    let hash = hasher.finalize();

    let address_bytes = &hash[12..32]; // last 20 bytes of the hash
    Ok(to_checksum_address(address_bytes))
}

/// EIP-55 mixed-case checksum encoding.
fn to_checksum_address(address_bytes: &[u8]) -> String {
    let address_hex = hex::encode(address_bytes);

    let mut hasher = Keccak256::new();
    hasher.update(address_hex.as_bytes());
    let hash = hasher.finalize();

    let mut checksummed = String::from("0x");
    for (i, c) in address_hex.chars().enumerate() {
        if c.is_ascii_digit() {
            checksummed.push(c);
        } else {
            let byte = hash[i / 2];
            let nibble = if i % 2 == 0 { byte >> 4 } else { byte & 0x0f };
            checksummed.push(if nibble >= 8 { c.to_ascii_uppercase() } else { c });
        }
    }
    checksummed
}

pub mod address;
pub mod encryption;
pub mod seed;

pub use address::*;
pub use encryption::*;
pub use seed::*;

use serde::{Deserialize, Serialize};

/// On-disk format for a vault file. All fields are hex-encoded strings.
#[derive(Serialize, Deserialize)]
pub struct VaultFile {
    pub version: u8,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

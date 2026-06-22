mod vault;
mod network;

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Serialize, Deserialize)]
pub struct VaultSummary {
    pub name: String,
    pub address: String,
}

#[tauri::command]
fn check_vault_exists(app: tauri::AppHandle) -> Result<bool, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        return Ok(false);
    }
    let has_vault = std::fs::read_dir(&app_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .any(|entry| entry.path().extension().map_or(false, |ext| ext == "vault"));
    Ok(has_vault)
}

#[tauri::command]
fn generate_seed_phrase() -> Result<String, String> {
    vault::generate_seed_phrase()
}

#[tauri::command]
fn create_vault(
    app: tauri::AppHandle,
    seed_phrase: String,
    master_password: String,
    vault_name: String,
) -> Result<String, String> {
    if master_password.len() < 12 {
        return Err("Master password must be at least 12 characters.".into());
    }
    let clean_name = vault_name.trim();
    if clean_name.is_empty() {
        return Err("Vault name cannot be empty.".into());
    }

    let blob = vault::encrypt(&seed_phrase, &master_password)?;

    let vault_file = vault::VaultFile {
        version: 1,
        salt: hex::encode(&blob.salt),
        nonce: hex::encode(&blob.nonce),
        ciphertext: hex::encode(&blob.ciphertext),
    };

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let file_path = app_dir.join(format!("{clean_name}.vault"));

    if file_path.exists() {
        return Err("A vault with this name already exists.".into());
    }

    let json = serde_json::to_string_pretty(&vault_file).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json).map_err(|e| e.to_string())?;

    vault::derive_eth_address(&seed_phrase)
}

#[tauri::command]
fn unlock_vault(app: tauri::AppHandle, master_password: String) -> Result<Vec<VaultSummary>, String> {
    if master_password.len() < 12 {
        return Err("The vault door remains shut.".into());
    }

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        return Err("No vaults found.".into());
    }

    let mut matched = Vec::new();
    let entries = std::fs::read_dir(&app_dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "vault") {
            let contents = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let vault_file: vault::VaultFile = match serde_json::from_str(&contents) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let salt = match hex::decode(&vault_file.salt) { Ok(v) => v, Err(_) => continue };
            let nonce = match hex::decode(&vault_file.nonce) { Ok(v) => v, Err(_) => continue };
            let ciphertext = match hex::decode(&vault_file.ciphertext) { Ok(v) => v, Err(_) => continue };

            let blob = vault::EncryptedBlob { salt, nonce, ciphertext };

            if let Ok(decrypted_seed) = vault::decrypt(&blob, &master_password) {
                let name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unnamed Vault")
                    .to_string();
                let address = vault::derive_eth_address(&decrypted_seed)
                    .unwrap_or_else(|_| "Address derivation failed".to_string());
                matched.push(VaultSummary { name, address });
            }
        }
    }

    if matched.is_empty() {
        return Err("Incorrect password, or no vaults match.".into());
    }

    Ok(matched)
}

// --- NETWORK (V1: trusted RPC) ---

#[tauri::command]
fn check_network_configured(app: tauri::AppHandle) -> Result<bool, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(network::load_config(&app_dir).is_some())
}

#[tauri::command]
fn save_network_config(app: tauri::AppHandle, execution_rpc: String) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    network::save_config(&app_dir, &execution_rpc)
}

#[tauri::command]
async fn test_network_connection(app: tauri::AppHandle) -> Result<u64, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config = network::load_config(&app_dir).ok_or("No network config saved.".to_string())?;
    network::get_block_number(&config.execution_rpc).await
}

#[tauri::command]
async fn fetch_balance(app: tauri::AppHandle, address: String) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config = network::load_config(&app_dir).ok_or("No network config saved.".to_string())?;
    network::get_balance(&config.execution_rpc, &address).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            unlock_vault,
            create_vault,
            generate_seed_phrase,
            check_vault_exists,
            check_network_configured,
            save_network_config,
            test_network_connection,
            fetch_balance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

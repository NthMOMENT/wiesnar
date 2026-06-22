use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct NetworkConfig {
    pub execution_rpc: String,
}

fn config_path(app_dir: &PathBuf) -> PathBuf {
    app_dir.join("network_config.json")
}

pub fn save_config(app_dir: &PathBuf, execution_rpc: &str) -> Result<(), String> {
    let config = NetworkConfig {
        execution_rpc: execution_rpc.trim().to_string(),
    };
    std::fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(config_path(app_dir), json).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_config(app_dir: &PathBuf) -> Option<NetworkConfig> {
    let contents = std::fs::read_to_string(config_path(app_dir)).ok()?;
    serde_json::from_str(&contents).ok()
}

/// Sends a raw Ethereum JSON-RPC request to the configured (trusted) endpoint.
async fn rpc_call(rpc_url: &str, method: &str, params: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    });

    let response = client
        .post(rpc_url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

    let parsed: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse RPC response: {e}"))?;

    if let Some(error) = parsed.get("error") {
        return Err(format!("RPC error: {error}"));
    }

    parsed
        .get("result")
        .cloned()
        .ok_or_else(|| "RPC response missing result field.".to_string())
}

fn hex_to_u64(hex_str: &str) -> Result<u64, String> {
    let trimmed = hex_str.trim_start_matches("0x");
    u64::from_str_radix(trimmed, 16).map_err(|e| e.to_string())
}

fn hex_to_u128(hex_str: &str) -> Result<u128, String> {
    let trimmed = hex_str.trim_start_matches("0x");
    u128::from_str_radix(trimmed, 16).map_err(|e| e.to_string())
}

/// Current block number, as reported by the configured RPC provider.
/// NOTE: this is TRUSTED data — we have no cryptographic way to verify the
/// provider isn't lying, unlike the light-client approach this is standing
/// in for until that path is production-ready.
pub async fn get_block_number(execution_rpc: &str) -> Result<u64, String> {
    let result = rpc_call(execution_rpc, "eth_blockNumber", json!([])).await?;
    let hex_str = result.as_str().ok_or("Unexpected response format.".to_string())?;
    hex_to_u64(hex_str)
}

/// Returns the ETH balance of an address, formatted to 6 decimal places.
pub async fn get_balance(execution_rpc: &str, address: &str) -> Result<String, String> {
    let result = rpc_call(execution_rpc, "eth_getBalance", json!([address, "latest"])).await?;
    let hex_str = result.as_str().ok_or("Unexpected response format.".to_string())?;
    let wei = hex_to_u128(hex_str)?;
    let eth = wei as f64 / 1_000_000_000_000_000_000.0;
    Ok(format!("{:.6}", eth))
}

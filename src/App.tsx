import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const SECURITY_MESSAGES = [
  "Not your keys, not your coins.",
  "The network is public, but your vault is yours.",
  "Trust the math, not the middleman.",
  "A seed phrase on paper outlives the cloud.",
  "Your hardware is your sovereign territory.",
  "Privacy is the silence of your transactions.",
  "To verify is to trust no one else.",
  "Code is law, but cryptography is physics.",
  "Self-custody is the ultimate freedom.",
  "The blockchain remembers everything; guard your keys.",
];

type Vault = {
  id: number | string;
  name: string;
  address: string;
  mainEth: string;
  l2Tokens: { name: string; symbol: string; amount: string }[];
  transactions: { type: string; asset: string; amount: string; time: string }[];
  totalUsd: string;
  volumeIn: string;
  volumeOut: string;
};

type Screen =
  | "checking" | "unlock" | "seed-display" | "seed-verify"
  | "password-create" | "vault-name" | "forging"
  | "transition" | "selector" | "dashboard";

type NetworkStatus = "idle" | "connecting" | "connected" | "error";

function shuffle(arr: number[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function App() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [vaultExists, setVaultExists] = useState<boolean | null>(null);

  const [password, setPassword] = useState("");
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  const [realVaults, setRealVaults] = useState<Vault[]>([]);

  const [seedPhrase, setSeedPhrase] = useState("");
  const [verifyPositions, setVerifyPositions] = useState<number[]>([]);
  const [verifyStep, setVerifyStep] = useState(0);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [forgeError, setForgeError] = useState("");

  const [showAllTx, setShowAllTx] = useState(false);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const [networkConfigured, setNetworkConfigured] = useState<boolean | null>(null);
  const [executionRpcInput, setExecutionRpcInput] = useState("");
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("idle");
  const [networkError, setNetworkError] = useState("");
  const [blockNumber, setBlockNumber] = useState<number | null>(null);

  useEffect(() => {
    invoke<boolean>("check_vault_exists")
      .then((exists) => { setVaultExists(exists); setScreen("unlock"); })
      .catch(() => { setVaultExists(false); setScreen("unlock"); });
  }, []);

  useEffect(() => {
    if (screen !== "dashboard") return;
    invoke<boolean>("check_network_configured")
      .then((configured) => setNetworkConfigured(configured))
      .catch(() => setNetworkConfigured(false));
  }, [screen]);

  useEffect(() => {
    if (screen !== "unlock") return;
    const fullMessage = SECURITY_MESSAGES[currentMsgIndex];
    const words = fullMessage.split(" ");
    let i = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      if (i < words.length) {
        setDisplayedText((prev) => (prev ? prev + " " + words[i] : words[i]));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setCurrentMsgIndex((p) => (p + 1) % SECURITY_MESSAGES.length), 4000);
      }
    }, 350);
    return () => clearInterval(interval);
  }, [currentMsgIndex, screen]);

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      setIsFlashingRed(true);
      setTimeout(() => { setIsFlashingRed(false); setPassword(""); }, 800);
      return;
    }
    try {
      const summaries = await invoke<{ name: string; address: string }[]>("unlock_vault", { masterPassword: password });
      const vaults: Vault[] = summaries.map((s) => ({
        id: s.name,
        name: s.name,
        address: s.address,
        mainEth: "0.00",
        l2Tokens: [],
        transactions: [],
        totalUsd: "$0.00",
        volumeIn: "$0.00",
        volumeOut: "$0.00",
      }));
      setRealVaults(vaults);
      setPassword("");
      setScreen("transition");
      setTimeout(() => setScreen("selector"), 1500);
    } catch {
      setIsFlashingRed(true);
      setTimeout(() => { setIsFlashingRed(false); setPassword(""); }, 800);
    }
  };

  const handleStartForge = async () => {
    try {
      const phrase = await invoke<string>("generate_seed_phrase");
      setSeedPhrase(phrase);
      setScreen("seed-display");
    } catch (err) {
      setForgeError(String(err));
    }
  };

  const handleConfirmWrittenDown = () => {
    const positions = shuffle(Array.from({ length: 24 }, (_, i) => i)).slice(0, 5);
    setVerifyPositions(positions);
    setVerifyStep(0);
    setVerifyInput("");
    setVerifyError("");
    setScreen("seed-verify");
  };

  const handleVerifySubmit = (e: FormEvent) => {
    e.preventDefault();
    const words = seedPhrase.split(" ");
    const targetPos = verifyPositions[verifyStep];
    const expected = words[targetPos]?.toLowerCase().trim();
    const given = verifyInput.toLowerCase().trim();

    if (given === expected) {
      setVerifyInput("");
      setVerifyError("");
      if (verifyStep + 1 >= verifyPositions.length) {
        setScreen("password-create");
      } else {
        setVerifyStep((s) => s + 1);
      }
    } else {
      setVerifyError(`Word #${targetPos + 1} is incorrect. Try again.`);
      setVerifyInput("");
    }
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    const hasLetter = /[a-zA-Z]/.test(masterPassword);
    const hasNumber = /[0-9]/.test(masterPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(masterPassword);

    if (masterPassword.length < 12) {
      setPasswordError("Password must be at least 12 characters.");
      return;
    }
    if (!hasLetter || !hasNumber || !hasSpecial) {
      setPasswordError("Password needs letters, numbers, and a special character.");
      return;
    }
    if (masterPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordError("");
    setScreen("vault-name");
  };

  const handleVaultNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = vaultName.trim() || "Main Vault";
    setScreen("forging");
    try {
      const address = await invoke<string>("create_vault", {
        seedPhrase: seedPhrase,
        masterPassword: masterPassword,
        vaultName: name,
      });

      const freshVault: Vault = {
        id: name,
        name,
        address,
        mainEth: "0.00",
        l2Tokens: [],
        transactions: [],
        totalUsd: "$0.00",
        volumeIn: "$0.00",
        volumeOut: "$0.00",
      };

      setSeedPhrase("");
      setMasterPassword("");
      setConfirmPassword("");
      setVerifyInput("");

      setSelectedVault(freshVault);
      setVaultExists(true);
      setScreen("transition");
      setTimeout(() => setScreen("dashboard"), 1500);
    } catch (err) {
      setForgeError(String(err));
      setScreen("vault-name");
    }
  };

  const handleSelectVault = (vault: Vault) => {
    setSelectedVault(vault);
    setScreen("dashboard");
  };

  const handleLockVault = () => {
    setSelectedVault(null);
    setScreen("selector");
  };

  const handleCopyAddress = () => {
    if (!selectedVault) return;
    navigator.clipboard.writeText(selectedVault.address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1500);
  };

  const handleTestConnection = async () => {
    setNetworkStatus("connecting");
    setNetworkError("");
    try {
      const block = await invoke<number>("test_network_connection");
      setBlockNumber(block);
      setNetworkStatus("connected");
    } catch (err) {
      setNetworkStatus("error");
      setNetworkError(String(err));
    }
  };

  const handleSaveNetworkConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!executionRpcInput.trim()) return;
    try {
      await invoke("save_network_config", { executionRpc: executionRpcInput });
      setNetworkConfigured(true);
      handleTestConnection();
    } catch (err) {
      setNetworkError(String(err));
    }
  };

  const handleRefresh = async () => {
    if (!selectedVault) return;
    setIsRefreshing(true);
    setRefreshError("");
    try {
      const balance = await invoke<string>("fetch_balance", { address: selectedVault.address });
      setSelectedVault({ ...selectedVault, mainEth: balance });
    } catch (err) {
      setRefreshError(String(err));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className={`vault-background ${isFlashingRed ? "flash-red" : ""} ${screen === "transition" ? "bloom" : ""}`}>

      {screen === "checking" && (
        <main className="unlock-container">
          <div className="typewriter-text">Checking vault status…</div>
        </main>
      )}

      {screen === "unlock" && (
        <main className="unlock-container">
          <div className="typewriter-text">{displayedText}</div>

          {vaultExists === false && (
            <button className="unlock-button forge-button" onClick={handleStartForge}>
              Forge Your First Vault
            </button>
          )}

          {vaultExists === true && (
            <form className="unlock-form" onSubmit={handleUnlock}>
              <input
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="Enter Master Password"
                className="master-password-input"
              />
              <button type="submit" className="unlock-button">Unlock Vault</button>
            </form>
          )}
        </main>
      )}

      {screen === "seed-display" && (
        <main className="forge-container">
          <h1 className="forge-title">Your 24-Word Seed Phrase</h1>
          <p className="forge-subtitle">Write these down on paper, in order. This is the only copy that will ever be shown.</p>
          <div className="seed-grid">
            {seedPhrase.split(" ").map((word, idx) => (
              <div key={idx} className="seed-word">
                <span className="seed-index">{idx + 1}</span> {word}
              </div>
            ))}
          </div>
          <button className="unlock-button" onClick={handleConfirmWrittenDown}>
            I Have Written These Down
          </button>
        </main>
      )}

      {screen === "seed-verify" && (
        <main className="forge-container">
          <h1 className="forge-title">Verify Your Seed Phrase</h1>
          <p className="forge-subtitle">
            Confirming word {verifyStep + 1} of {verifyPositions.length}
          </p>
          <form className="unlock-form" onSubmit={handleVerifySubmit}>
            <label className="verify-label">Word #{verifyPositions[verifyStep] + 1}</label>
            <input
              type="text"
              value={verifyInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVerifyInput(e.target.value)}
              placeholder="Type the word"
              className="master-password-input"
              autoFocus
            />
            {verifyError && <p className="forge-error">{verifyError}</p>}
            <button type="submit" className="unlock-button">Confirm</button>
          </form>
        </main>
      )}

      {screen === "password-create" && (
        <main className="forge-container">
          <h1 className="forge-title">Create Your Master Password</h1>
          <p className="forge-subtitle">Minimum 12 characters. Letters, numbers, and a special character required.</p>
          <form className="unlock-form" onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={masterPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMasterPassword(e.target.value)}
              placeholder="Master Password"
              className="master-password-input"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Master Password"
              className="master-password-input"
            />
            {passwordError && <p className="forge-error">{passwordError}</p>}
            <button type="submit" className="unlock-button">Continue</button>
          </form>
        </main>
      )}

      {screen === "vault-name" && (
        <main className="forge-container">
          <h1 className="forge-title">Name Your Vault</h1>
          <form className="unlock-form" onSubmit={handleVaultNameSubmit}>
            <input
              type="text"
              value={vaultName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVaultName(e.target.value)}
              placeholder="e.g. Main Vault"
              className="master-password-input"
            />
            {forgeError && <p className="forge-error">{forgeError}</p>}
            <button type="submit" className="unlock-button">Forge Vault</button>
          </form>
        </main>
      )}

      {screen === "forging" && (
        <main className="unlock-container">
          <div className="typewriter-text">Encrypting, writing to disk, and deriving your address…</div>
        </main>
      )}

      {screen === "transition" && (
        <div className="bloom-overlay"><h1 className="bloom-text">Vault Unlocked</h1></div>
      )}

      {screen === "selector" && (
        <main className="selector-container">
          <h1 className="selector-title">Select Your Vault</h1>
          <div className="vault-grid">
            {realVaults.length === 0 && (
              <p className="forge-subtitle">No vaults matched this password.</p>
            )}
            {realVaults.map((vault) => (
              <div key={vault.id} className="vault-card" onClick={() => handleSelectVault(vault)}>
                <h2 className="vault-name">{vault.name}</h2>
                <div className="vault-balances">
                  <div className="balance-row">
                    <span className="balance-token">ETH</span>
                    <span className="balance-amount">{vault.mainEth}</span>
                  </div>
                  {vault.l2Tokens.map((bal, index) => (
                    <div key={index} className="balance-row">
                      <span className="balance-token">{bal.symbol}</span>
                      <span className="balance-amount">{bal.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {screen === "dashboard" && selectedVault && (
        <main className="dashboard-container">
          <header className="dashboard-header">
            <div className="header-left">
              <h1 className="logo-text">WIESNAR</h1>
              <span className="network-status">● Mainnet</span>
              <span className="vault-indicator">/ {selectedVault.name}</span>
            </div>
            <div className="header-right">
              <button className="refresh-btn" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? <span className="spinner"></span> : "Refresh"}
              </button>
              <button className="lock-btn" onClick={handleLockVault}>Lock Vault</button>
            </div>
          </header>

          <section className="dash-card network-card">
            <h3 className="card-label">Network Connection</h3>
            <p className="forge-subtitle">
              Trusted RPC mode (V1) — balances come directly from your configured provider. The zero-trust light client is on the roadmap.
            </p>

            {networkConfigured === false && (
              <form className="unlock-form network-form" onSubmit={handleSaveNetworkConfig}>
                <input
                  type="text"
                  value={executionRpcInput}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setExecutionRpcInput(e.target.value)}
                  placeholder="Execution RPC URL (Alchemy)"
                  className="master-password-input"
                />
                <button type="submit" className="unlock-button">Save & Connect</button>
              </form>
            )}

            {networkConfigured === true && (
              <div className="network-test-row">
                <button className="refresh-btn" onClick={handleTestConnection} disabled={networkStatus === "connecting"}>
                  {networkStatus === "connecting" ? <span className="spinner"></span> : "Test Connection"}
                </button>
                {networkStatus === "connected" && blockNumber !== null && (
                  <p className="forge-subtitle">Connected. Current block: {blockNumber}</p>
                )}
                {networkStatus === "error" && <p className="forge-error">{networkError}</p>}
              </div>
            )}
          </section>

          <div className="dashboard-grid">
            <section className="dash-card vault-card-dash">
              <h3 className="card-label">Total Balance</h3>
              <h2 className="massive-balance">{selectedVault.mainEth} <span className="eth-label">ETH</span></h2>
              {refreshError && <p className="forge-error">{refreshError}</p>}
              <div className="l2-list">
                {selectedVault.l2Tokens.map((token, i) => (
                  <div key={i} className="l2-item">
                    <span className="l2-symbol">{token.symbol}</span>
                    <span className="l2-amount">{token.amount}</span>
                  </div>
                ))}
              </div>
              <div className="address-row">
                <span className="address-label">Receive Address</span>
                <div className="address-value" onClick={handleCopyAddress} title="Click to copy">
                  {selectedVault.address}
                </div>
                {addressCopied && <span className="address-copied">Copied!</span>}
              </div>
            </section>

            <section className="dash-card ledger-card">
              <div className="card-header-row">
                <h3 className="card-label">Recent Transactions</h3>
                <button className="show-all-btn" onClick={() => setShowAllTx(!showAllTx)}>
                  {showAllTx ? "Show Less" : `Show All (${selectedVault.transactions.length})`}
                </button>
              </div>
              <div className="tx-list">
                {selectedVault.transactions.length === 0 && (
                  <p className="forge-subtitle">No transactions yet.</p>
                )}
                {selectedVault.transactions.map((tx, i) => (
                  <div key={i} className={`tx-row ${tx.type === "In" ? "tx-in" : "tx-out"}`}>
                    <span className="tx-type">{tx.type}</span>
                    <span className="tx-asset">{tx.asset}</span>
                    <span className="tx-amount">{tx.amount}</span>
                    <span className="tx-time">{tx.time}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="dash-card analytics-card">
              <h3 className="card-label">Allocation</h3>
              <div className="pie-chart-container">
                <div className="pie-chart"></div>
                <div className="pie-legend">
                  <div className="legend-item"><span className="legend-color eth"></span> ETH</div>
                  <div className="legend-item"><span className="legend-color l2"></span> L2 Tokens</div>
                  <div className="legend-item"><span className="legend-color stable"></span> Stablecoins</div>
                </div>
              </div>
            </section>

            <section className="dash-card bottomline-card">
              <h3 className="card-label">Bottom Line</h3>
              <p className="fiat-total">{selectedVault.totalUsd}</p>
              <div className="fiat-volume-grid">
                <div className="fiat-box in">
                  <span className="fiat-label">Volume In</span>
                  <span className="fiat-value">{selectedVault.volumeIn}</span>
                </div>
                <div className="fiat-box out">
                  <span className="fiat-label">Volume Out</span>
                  <span className="fiat-value">{selectedVault.volumeOut}</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

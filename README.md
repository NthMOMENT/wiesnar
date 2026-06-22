# WIESNAR: Your Personal Ethereum Vault

## What Is This?

Imagine a digital safe for your Ethereum that lives on your computer — and eventually, on a USB drive you can keep in your pocket. Unlike browser wallets that are constantly exposed to the internet, WIESNAR's keys stay encrypted on your own machine, never in a company's cloud. It's like having a bank vault that only you can open.

Named after Stephen Wiesner, the physicist who conceived "quantum money" in the 1970s — currency that's unforgeable because measuring it changes it. We're chasing the same spirit with different math: a wallet where you don't have to trust us, you can verify us.

## What We're Trying to Achieve

Most crypto wallets today have quiet, structural weaknesses:

* Browser extensions are constantly exposed to the websites you visit, widening the attack surface
* Most wallets ask a company's server (Infura, Alchemy, and similar) what your balance is — and simply trust the answer
* Keys are often stored in ways that ultimately depend on trusting Apple, Google, or Microsoft's cloud infrastructure

Our goal is a wallet that removes each of these dependencies, one at a time, and is honest at every step about which ones are removed and which aren't yet. Specifically, we're building toward:

1. **Self-custody with no cloud dependency** — your keys never leave your device. *(Built.)*
2. **A zero-trust connection to Ethereum** — verifying chain data cryptographically instead of trusting a provider's word for it. *(Attempted, currently blocked on upstream tooling stability — see below.)*
3. **The ability to actually send funds**, signed locally, broadcast without a middleman holding your key. *(Not yet built — this is the core of what we're raising funds for.)*
4. **A hardware-wallet-grade experience without hardware-wallet pricing** — an encrypted vault file portable enough to carry on a USB drive. *(Not yet built.)*
5. **Full dApp compatibility** via WalletConnect, so self-custody doesn't mean giving up Uniswap, OpenSea, or the rest of the ecosystem. *(Not yet built.)*

We'd rather ship each of these honestly, in order, than claim a finish line we haven't crossed.

## Built and Working Today

🔐 **Your keys, encrypted, local-only.** A 24-word BIP-39 seed phrase is generated, shown to you once for backup, and verified word-by-word before your wallet is created. Your master password derives an encryption key via Argon2 (a deliberately slow, brute-force-resistant key derivation function), which then encrypts your seed with AES-256-GCM. The result is written to a single file on your machine. No cloud storage, no company servers, no transmission of your seed or password anywhere, ever.

🔑 **Real address derivation.** Your Ethereum receiving address is derived from your seed using the standard path (BIP-44, `m/44'/60'/0'/0/0`) through secp256k1 and Keccak-256, with proper EIP-55 checksum encoding — the same derivation any standard wallet uses, so your funds are never locked into proprietary software.

🛡️ **Memory hygiene during encryption/decryption.** The encryption key derived from your password is explicitly zeroed out of memory (via Rust's `zeroize`) immediately after use, rather than left to linger until garbage collection gets around to it.

🌐 **Live balance checking.** The dashboard can fetch your real ETH balance from the network on demand.

**What "live balance checking" honestly means right now:** we connect to Ethereum through a trusted RPC provider (Alchemy). This means you're trusting that provider to report your balance accurately — the same model nearly every wallet uses today. It is **not yet** the verify-it-yourself, trust-no-one model described in our long-term goals above. We attempted to build that this week using Helios, a real cryptographic light client — and it genuinely worked, briefly, verifying real mainnet data — before hitting an unresolved bug in Helios's own sync-status logic on the current unreleased branch. Helios's own maintainers currently advise against using it for high-value wallet transactions. We made the deliberate call to ship the honest trusted-RPC version rather than ship something fragile and call it trustless. Closing this gap is one of the things we're asking funding for.

## What We're Raising Funds to Build

* **Transaction signing and broadcasting.** Currently, WIESNAR can receive and display funds — it cannot yet send them. This is the single largest remaining piece of core functionality.
* **The zero-trust light client.** Finishing the Helios integration (or an equivalent), so balance and transaction data is cryptographically verified rather than trusted from a provider.
* **USB-portable hardware-wallet mode.** Carrying your encrypted vault file on removable media, so your keys are physically absent from any machine when unplugged.
* **WalletConnect support**, so WIESNAR can approve transactions for dApps (Uniswap, OpenSea, etc.) without your keys ever touching a browser.
* **An independent security audit.** Everything built so far is real, working cryptography — written quickly, by a small team, under no outside review yet. Before this holds anyone's real funds at scale, it needs eyes that aren't ours.
* **Automated test coverage.** Current testing has been thorough but manual. A wallet handling real money needs a real test suite.

## How It Works So Far

**Forging a vault:** Generate a 24-word seed phrase, write it down, prove you wrote it down correctly by retyping five random words. Set a master password (12+ characters, letters + numbers + symbol). Your seed is encrypted and saved locally. Your Ethereum address is derived and shown immediately.

**Unlocking a vault:** Enter your master password. WIESNAR tries it against every vault file on your machine; only the correct password decrypts the matching one. Nothing is sent anywhere during this process.

**Checking your balance:** WIESNAR asks a configured Ethereum RPC provider for your current balance and displays it.

## Who Is This For?

* Crypto natives who want strong security without buying a $100+ hardware wallet
* Privacy advocates who don't want a company's server logging every balance check
* Anyone who believes "not your keys, not your coins" — and wants the software to actually live up to that, not just say it

## Built By

WIESNAR is built by the team behind [**Fourier**](https://fouriers.xyz) ([reports on GitHub](https://github.com/NthMOMENT/Fourier.u)), an EVM gas-optimization research practice. Eleven major protocols analyzed to date — including Uniswap V3, Aave V4, GMX Synthetics, Lido, Euler, and Circle's CCTP — with every finding published publicly rather than kept behind a paywall. That work is what this project draws its standard for "read the code, don't take our word for it" from.

## Our Promise

We're building this in the open, on GitHub, for the community to inspect — including, deliberately, the parts that aren't finished yet. No hidden backdoors, no corporate agenda, and no claiming a feature works before it does.

## Getting Started

Currently runs from source in development mode (`npm run tauri dev`) — there is no packaged release yet. A GitHub Releases build, with installers, is part of what funding would let us prioritize.

## Support This Project

We're applying for funding (Ethereum Foundation, Gitcoin) to close the gaps listed above — most urgently, transaction signing and the zero-trust light client. If you believe in self-custody that's honest about its own progress, we'd welcome your support.

Your keys. Eventually, your USB drive. Always your rules.

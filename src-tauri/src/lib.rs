use tauri::{command, Emitter, Manager, State, Window};
use tauri_plugin_oauth::start;
use tauri_plugin_stronghold::stronghold::Stronghold;

// All API keys/tokens live in this single Stronghold client. The Vault file
// itself (`credentials.hold` under the app-data dir) is XChaCha20-Poly1305
// encrypted; only the OS user account boundary protects the machine.
const VAULT_CLIENT_PATH: &[u8] = b"narrative-sprout-credentials";
const VAULT_SNAPSHOT_FILE: &str = "credentials.hold";
// Windows Credential Manager entry holding the random Vault password.
const VAULT_PASSWORD_SERVICE: &str = "dev.pages.narrative-sprout";
const VAULT_PASSWORD_ACCOUNT: &str = "stronghold-vault-password";

#[command]
async fn start_server(window: Window) -> Result<u16, String> {
    start(move |url| {
        // Because of the unprotected localhost port, you must verify the URL here.
        // Preferebly send back only the token, or nothing at all if you can handle everything else in Rust.
        let _ = window.emit("redirect_uri", url);
    })
    .map_err(|err| err.to_string())
}

/// Returns the 32-byte Vault password, generating and storing a random one on
/// first run. The password lives in the OS credential store — never in a file
/// and never asked from the user (Phase 7 / A1 decision).
///
/// Two hard constraints shape this function:
/// - Stronghold's key store only accepts exactly 32-byte keys
///   (`NC_DATA_SIZE`; anything else aborts setup with "illegal
///   non-contiguous size"), so the keyring holds the hex encoding and both
///   paths below decode it back to the same 32 raw bytes.
/// - The same bytes must be used on every launch (an earlier version mixed
///   raw and hex bytes, breaking every second launch).
fn vault_password() -> Result<Vec<u8>, String> {
    let entry = keyring::Entry::new(VAULT_PASSWORD_SERVICE, VAULT_PASSWORD_ACCOUNT)
        .map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(stored) => hex::decode(stored.trim())
            .map_err(|err| format!("stored vault password is corrupt: {}", err)),
        Err(keyring::Error::NoEntry) => {
            let mut raw = [0u8; 32];
            getrandom::getrandom(&mut raw).map_err(|err| err.to_string())?;
            let stored = hex::encode(raw);
            entry.set_password(&stored).map_err(|err| err.to_string())?;
            // Re-read instead of trusting our own write: a concurrent first
            // launch may have overwritten the entry after our check — every
            // process must converge on the value actually stored now.
            // (Single-instance normally makes this unreachable.)
            let stored = entry.get_password().map_err(|err| err.to_string())?;
            hex::decode(stored.trim())
                .map_err(|err| format!("stored vault password is corrupt: {}", err))
        }
        Err(err) => Err(err.to_string()),
    }
}

fn open_vault_client(stronghold: &Stronghold) -> Result<iota_stronghold::Client, String> {
    // Already live in this session?
    if let Ok(client) = stronghold.get_client(VAULT_CLIENT_PATH) {
        return Ok(client);
    }
    // Persisted in the snapshot file? (Stronghold::new loads snapshot data
    // but not clients — without this every reload sees an empty vault.)
    if let Ok(client) = stronghold.load_client(VAULT_CLIENT_PATH) {
        return Ok(client);
    }
    // Brand new vault — or lost a creation race with another call.
    match stronghold.create_client(VAULT_CLIENT_PATH) {
        Ok(client) => Ok(client),
        Err(_) => stronghold
            .get_client(VAULT_CLIENT_PATH)
            .map_err(|err| err.to_string()),
    }
}

/// Reads one credential from the Vault (missing key → null, never an error).
#[command]
async fn credential_get(
    stronghold: State<'_, Stronghold>,
    key: String,
) -> Result<Option<String>, String> {
    let client = open_vault_client(&stronghold)?;
    match client
        .store()
        .get(key.as_bytes())
        .map_err(|err| err.to_string())?
    {
        Some(bytes) => Ok(Some(String::from_utf8(bytes).map_err(|err| err.to_string())?)),
        None => Ok(None),
    }
}

/// Inserts/overwrites one credential and persists the Vault snapshot.
#[command]
async fn credential_set(
    stronghold: State<'_, Stronghold>,
    key: String,
    value: String,
) -> Result<(), String> {
    let client = open_vault_client(&stronghold)?;
    client
        .store()
        .insert(key.as_bytes().to_vec(), value.as_bytes().to_vec(), None)
        .map_err(|err| err.to_string())?;
    stronghold.save().map_err(|err| err.to_string())
}

/// Removes one credential (missing key is a no-op) and persists the snapshot.
#[command]
async fn credential_delete(stronghold: State<'_, Stronghold>, key: String) -> Result<(), String> {
    let client = open_vault_client(&stronghold)?;
    client
        .store()
        .delete(key.as_bytes())
        .map_err(|err| err.to_string())?;
    stronghold.save().map_err(|err| err.to_string())
}

fn setup_error(message: String) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, message)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Guards the Vault round-trip that broke 7.3 startup: the snapshot
    /// password must be exactly 32 bytes (`NC_DATA_SIZE`), or Stronghold
    /// aborts with "illegal non-contiguous size". Uses a temp dir and a
    /// fixed password — never touches the OS keyring.
    #[test]
    fn vault_snapshot_roundtrip() {
        // Same setting as setup(): snapshot file encryption must not scrypt
        // (process-global; tests never run setup()).
        iota_stronghold::engine::snapshot::try_set_encrypt_work_factor(0).unwrap();
        let dir = std::env::temp_dir().join(format!("ns-vault-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let snapshot = dir.join("credentials.hold");
        let password = vec![7u8; 32];
        assert_eq!(password.len(), 32);

        let stronghold = Stronghold::new(&snapshot, password.clone()).unwrap();
        let client = open_vault_client(&stronghold).unwrap();
        client
            .store()
            .insert(b"key".to_vec(), b"value".to_vec(), None)
            .unwrap();
        stronghold.save().unwrap();
        drop(client);
        drop(stronghold);

        let reloaded = Stronghold::new(&snapshot, password).unwrap();
        let client = open_vault_client(&reloaded).unwrap();
        let value = client.store().get(b"key").unwrap();
        assert_eq!(value, Some(b"value".to_vec()));

        std::fs::remove_dir_all(&dir).unwrap();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_cors_fetch::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .invoke_handler(tauri::generate_handler![
            start_server,
            credential_get,
            credential_set,
            credential_delete
        ])
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Fail fast: without the Vault the app cannot store API keys,
            // which is a core function — silently continuing would recreate
            // the plaintext-file problem this exists to eliminate.
            // Snapshot file + keyring entry are machine-bound (roaming them
            // to another machine makes the file unloadable there), so they
            // live in LOCAL app data, never Roaming (folder redirection /
            // offline-files staleness has bitten before).
            let snapshot_path = app
                .path()
                .app_local_data_dir()
                .map_err(|err| setup_error(err.to_string()))?
                .join(VAULT_SNAPSHOT_FILE);
            if let Some(parent) = snapshot_path.parent() {
                std::fs::create_dir_all(parent).map_err(|err| setup_error(err.to_string()))?;
            }
            let password = vault_password().map_err(setup_error)?;
            // Snapshot file encryption uses age/scrypt with a deliberately
            // heavy default work factor (tens of seconds per save/load even
            // in release builds). That stretching only protects weak human
            // passwords against brute force — our Vault password is 256-bit
            // CSPRNG output, so it buys nothing here while making every
            // launch and every credential write hang. Lower it to zero; the
            // file itself stays age-encrypted (XChaCha20-Poly1305), and the
            // decrypt path accepts any work factor, so older files still load.
            iota_stronghold::engine::snapshot::try_set_encrypt_work_factor(0)
                .map_err(|err| setup_error(err.to_string()))?;
            let stronghold = Stronghold::new(&snapshot_path, password).map_err(|err| {
                setup_error(format!(
                    "vault snapshot failed to load ({}): {}. If the file is from an older \
                     build or got corrupted, delete it and re-enter API keys once.",
                    snapshot_path.display(),
                    err
                ))
            })?;
            app.manage(stronghold);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

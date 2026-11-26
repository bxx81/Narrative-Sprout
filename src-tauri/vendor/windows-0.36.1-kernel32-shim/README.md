# `windows` 0.36.1 kernel32 shim

This is a **path-patched stand-in** for the `windows` crate v0.36.1, wired up in
`src-tauri/Cargo.toml` via `[patch.crates-io]`.

## Why this exists

`stronghold-runtime` 2.0.1 (a transitive dependency of `iota_stronghold`, used
for the Stronghold vault) is the only crate in the tree that depends on
`windows` 0.36.1. That crate's generated bindings are annotated with
`#[link(name = "windows")]`, which pulls in the combined
`windows.lib` from `windows_x86_64_msvc` 0.36.1.

That import library contains an import descriptor for **`vertdll.dll`** (the
"VSM enclave runtime DLL") for `WaitOnAddress` and `WakeByAddressAll`. Because
`windows.lib` is passed *first* on the MSVC link line, those definitions win
over the correct ones, and the produced executable imports `vertdll.dll`.

`vertdll.dll` is only meant to be loaded inside a Virtualization Based Security
enclave. When a normal process loads it, it starts a worker thread that
dereferences a null pointer and the process dies with
`STATUS_ACCESS_VIOLATION` (`0xC0000005`) shortly after startup — the app shows a
white window and disappears.

This became a hard crash on Windows builds where `vertdll.dll` was updated
(observed with `10.0.26100.9974`, KB5132061/KB5132688, November 2026). The bad
import was present in earlier releases too, so every build made with
`windows` 0.36.1 is affected on such systems.

## What this crate does

It implements only the handful of Win32 APIs that `stronghold-runtime` uses:

- `windows::Win32::Foundation`: `HANDLE`, `INVALID_HANDLE_VALUE`, `BOOL`,
  `WIN32_ERROR` and the error constants, `GetLastError`, `CloseHandle`
- `windows::Win32::System::Memory`: `CreateFileMappingW`, `MapViewOfFile`,
  `UnmapViewOfFile`, `VirtualAlloc`, `VirtualFree` and the flag constants
- `windows::core`: `PCWSTR`, `Error`, `Result`

Everything is bound to `kernel32.dll` (which is always on the link line) instead
of the combined `windows.lib`. It deliberately has **no**
`#[link(name = "windows")]`, so `windows.lib` — and therefore `vertdll.dll` —
is never linked.

## Verification

```powershell
cargo build --bin narrative-sprout
& dumpbin /imports .\target\debug\narrative-sprout.exe | Select-String vertdll
```

The second command must print nothing. If `vertdll.dll` shows up again, some
other dependency started linking a combined `windows.lib`; re-check
`cargo tree -i windows@0.36.1` and the linker map (`/MAP`).

## Removal

Delete the `[patch.crates-io]` entry and this directory once
`iota_stronghold`/`stronghold-runtime` stop depending on `windows` 0.36 (or
switch to a version that uses `raw-dylib`/`windows-sys`). There is no newer
`stronghold-runtime` release as of writing (2.0.1 is the latest).

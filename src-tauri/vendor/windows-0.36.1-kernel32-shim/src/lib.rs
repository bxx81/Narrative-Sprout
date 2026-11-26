//! Minimal stand-in for the `windows` crate v0.36.1.
//!
//! See `README.md` for the full rationale. In short: `stronghold-runtime` 2.0.1
//! is the only user of `windows` 0.36.1 in this workspace, and that crate's
//! combined `windows.lib` makes the executable import `vertdll.dll`
//! (`WaitOnAddress` / `WakeByAddressAll`), which crashes the process on current
//! Windows builds. This crate exposes the same tiny API surface, bound to
//! `kernel32.dll` instead, and never links `windows.lib`.
//!
//! Only the items used by `stronghold-runtime` 2.0.1's
//! `src/memories/frag.rs` are implemented. If `stronghold-runtime` is ever
//! updated and starts using more of the Win32 API, this crate will fail to
//! compile — that is intentional, so the shim cannot silently drift.

#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![allow(non_upper_case_globals)]

pub mod core {
    use std::fmt;

    /// Pointer to a null-terminated UTF-16 string.
    #[repr(transparent)]
    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
    pub struct PCWSTR(pub *const u16);

    /// Win32 error, constructed from the thread's last error code.
    #[derive(Clone, Copy, Debug)]
    pub struct Error {
        code: u32,
    }

    impl Error {
        /// Captures the calling thread's last Win32 error.
        pub fn from_win32() -> Self {
            Self {
                code: unsafe { crate::Windows::Win32::Foundation::GetLastError().0 },
            }
        }

        /// Raw Win32 error code.
        pub fn code(self) -> u32 {
            self.code
        }
    }

    impl fmt::Display for Error {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(formatter, "Win32 error 0x{:08X}", self.code)
        }
    }

    impl std::error::Error for Error {}

    pub type Result<T> = std::result::Result<T, Error>;
}

pub mod Windows {
    pub mod Win32 {
        pub mod Foundation {
            /// Kernel object handle (`isize` sized, as in the Win32 ABI).
            #[repr(transparent)]
            #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
            pub struct HANDLE(pub isize);

            impl HANDLE {
                pub fn is_invalid(&self) -> bool {
                    self.0 == -1 || self.0 == 0
                }
            }

            pub const INVALID_HANDLE_VALUE: HANDLE = HANDLE(-1);

            /// Win32 `BOOL` (a 32-bit int, unlike Rust's `bool`).
            #[repr(transparent)]
            #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
            pub struct BOOL(pub i32);

            impl BOOL {
                pub fn as_bool(self) -> bool {
                    self.0 != 0
                }
            }

            /// Win32 error code (`DWORD`).
            #[repr(transparent)]
            #[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
            pub struct WIN32_ERROR(pub u32);

            pub const ERROR_INVALID_HANDLE: WIN32_ERROR = WIN32_ERROR(6);
            pub const ERROR_INVALID_PARAMETER: WIN32_ERROR = WIN32_ERROR(87);
            pub const ERROR_ALREADY_EXISTS: WIN32_ERROR = WIN32_ERROR(183);
            pub const ERROR_INVALID_ADDRESS: WIN32_ERROR = WIN32_ERROR(487);
            pub const ERROR_COMMITMENT_LIMIT: WIN32_ERROR = WIN32_ERROR(1455);

            #[link(name = "kernel32")]
            extern "system" {
                pub fn GetLastError() -> WIN32_ERROR;
                pub fn CloseHandle(hobject: HANDLE) -> BOOL;
            }
        }

        pub mod System {
            pub mod Memory {
                use crate::core::{Error, PCWSTR, Result};
                use crate::Windows::Win32::Foundation::{BOOL, HANDLE};
                use std::ffi::c_void;

                pub const PAGE_READWRITE: u32 = 0x0000_0004;
                pub const FILE_MAP_ALL_ACCESS: u32 = 0x000F_001F;
                pub const MEM_COMMIT: u32 = 0x0000_1000;
                pub const MEM_RESERVE: u32 = 0x0000_2000;
                pub const MEM_RELEASE: u32 = 0x0000_8000;

                #[link(name = "kernel32")]
                extern "system" {
                    #[link_name = "CreateFileMappingW"]
                    fn create_file_mapping_w(
                        hfile: HANDLE,
                        lpfilemappingattributes: *const c_void,
                        flprotect: u32,
                        dwmaximumsizehigh: u32,
                        dwmaximumsizelow: u32,
                        lpname: PCWSTR,
                    ) -> HANDLE;

                    #[link_name = "MapViewOfFile"]
                    fn map_view_of_file(
                        hfilemappingobject: HANDLE,
                        dwdesiredaccess: u32,
                        dwfileoffsethigh: u32,
                        dwfileoffsetlow: u32,
                        dwnumberofbytestomap: usize,
                    ) -> *mut c_void;

                    #[link_name = "UnmapViewOfFile"]
                    fn unmap_view_of_file(lpbaseaddress: *const c_void) -> BOOL;

                    #[link_name = "VirtualAlloc"]
                    fn virtual_alloc(
                        lpaddress: *const c_void,
                        dwsize: usize,
                        flallocationtype: u32,
                        flprotect: u32,
                    ) -> *mut c_void;

                    #[link_name = "VirtualFree"]
                    fn virtual_free(lpaddress: *mut c_void, dwsize: usize, dwfreetype: u32) -> BOOL;
                }

                /// Creates or opens a named or unnamed file mapping object.
                pub unsafe fn CreateFileMappingW(
                    hfile: HANDLE,
                    lpfilemappingattributes: *const c_void,
                    flprotect: u32,
                    dwmaximumsizehigh: u32,
                    dwmaximumsizelow: u32,
                    lpname: PCWSTR,
                ) -> Result<HANDLE> {
                    let handle = create_file_mapping_w(
                        hfile,
                        lpfilemappingattributes,
                        flprotect,
                        dwmaximumsizehigh,
                        dwmaximumsizelow,
                        lpname,
                    );
                    if handle.is_invalid() {
                        Err(Error::from_win32())
                    } else {
                        Ok(handle)
                    }
                }

                /// Maps a view of a file mapping into the address space.
                pub unsafe fn MapViewOfFile(
                    hfilemappingobject: HANDLE,
                    dwdesiredaccess: u32,
                    dwfileoffsethigh: u32,
                    dwfileoffsetlow: u32,
                    dwnumberofbytestomap: usize,
                ) -> *mut c_void {
                    map_view_of_file(
                        hfilemappingobject,
                        dwdesiredaccess,
                        dwfileoffsethigh,
                        dwfileoffsetlow,
                        dwnumberofbytestomap,
                    )
                }

                /// Unmaps a mapped view of a file.
                pub unsafe fn UnmapViewOfFile(lpbaseaddress: *const c_void) -> BOOL {
                    unmap_view_of_file(lpbaseaddress)
                }

                /// Reserves, commits, or changes the state of a region of pages.
                pub unsafe fn VirtualAlloc(
                    lpaddress: *const c_void,
                    dwsize: usize,
                    flallocationtype: u32,
                    flprotect: u32,
                ) -> *mut c_void {
                    virtual_alloc(lpaddress, dwsize, flallocationtype, flprotect)
                }

                /// Releases, decommits, or changes the state of a region of pages.
                pub unsafe fn VirtualFree(
                    lpaddress: *mut c_void,
                    dwsize: usize,
                    dwfreetype: u32,
                ) -> BOOL {
                    virtual_free(lpaddress, dwsize, dwfreetype)
                }
            }
        }
    }
}

// The real `windows` crate exposes `Win32` (and friends) at the crate root.
pub use Windows::*;

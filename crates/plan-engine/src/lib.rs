//! Pure transaction planning and recovery policy for Liiiraa Boost.
//!
//! This crate owns deterministic domain decisions only. Windows effects,
//! privileged services, renderer concerns, networking, and fixtures remain in
//! downstream adapters.

#![forbid(unsafe_code)]

pub mod dependency;
pub mod domain;
pub mod executor;
pub mod promotion;
pub mod reconcile;
pub mod revision;
pub mod risk;

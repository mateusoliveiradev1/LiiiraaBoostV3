use std::{path::Path, time::Duration};

use rusqlite::{
    Connection, OpenFlags, OptionalExtension, TransactionBehavior, params, types::Type,
};
use serde_json::Value;

const BUSY_TIMEOUT: Duration = Duration::from_secs(2);
const SCHEMA_VERSION: i64 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FaultPoint {
    None,
    AfterReserve,
    AfterDispatch,
}

#[derive(Debug)]
pub enum StoreError {
    Database,
    Integrity,
    Migration,
}

#[derive(Debug, PartialEq)]
pub enum Reservation {
    New,
    Terminal(Value),
    ObservationRequired,
    Conflict,
    Replay,
}

#[derive(Debug)]
pub struct DedupStore {
    connection: Connection,
}

pub struct ReserveRequest<'a> {
    pub transaction_id: &'a str,
    pub step_id: &'a str,
    pub request_hash: &'a str,
    pub operation_version_id: &'a str,
    pub principal_id: &'a str,
    pub request_nonce: &'a str,
    pub counter: u32,
    pub created_at: i64,
}

impl DedupStore {
    pub fn open(path: &Path) -> Result<Self, StoreError> {
        let connection = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_FULL_MUTEX,
        )
        .map_err(|_| StoreError::Database)?;
        connection
            .busy_timeout(BUSY_TIMEOUT)
            .map_err(|_| StoreError::Database)?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|_| StoreError::Database)?;
        let foreign_keys: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .map_err(|_| StoreError::Database)?;
        if foreign_keys != 1 {
            return Err(StoreError::Database);
        }

        let journal_mode: String = connection
            .pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get(0))
            .map_err(|_| StoreError::Database)?;
        if !journal_mode.eq_ignore_ascii_case("wal") {
            return Err(StoreError::Database);
        }
        connection
            .pragma_update(None, "synchronous", "FULL")
            .map_err(|_| StoreError::Database)?;
        let synchronous: i64 = connection
            .pragma_query_value(None, "synchronous", |row| row.get(0))
            .map_err(|_| StoreError::Database)?;
        if synchronous != 2 {
            return Err(StoreError::Database);
        }

        migrate(&connection)?;
        verify_integrity(&connection)?;
        Ok(Self { connection })
    }

    pub fn reserve(&mut self, request: ReserveRequest<'_>) -> Result<Reservation, StoreError> {
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| StoreError::Database)?;
        let existing = transaction
            .query_row(
                "SELECT request_mac_hash, operation_version_id, state, result_json
                 FROM broker_dedup
                 WHERE transaction_id = ?1 AND step_id = ?2",
                params![request.transaction_id, request.step_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .optional()
            .map_err(|_| StoreError::Database)?;

        if let Some((stored_hash, stored_operation, state, result)) = existing {
            transaction.commit().map_err(|_| StoreError::Database)?;
            if stored_hash != request.request_hash
                || stored_operation != request.operation_version_id
            {
                return Ok(Reservation::Conflict);
            }
            return match state.as_str() {
                "terminal" => result
                    .ok_or(StoreError::Integrity)
                    .and_then(|json| serde_json::from_str(&json).map_err(|_| StoreError::Integrity))
                    .map(Reservation::Terminal),
                "reserved" | "unknown-after-crash" => Ok(Reservation::ObservationRequired),
                _ => Err(StoreError::Integrity),
            };
        }

        let highest_counter = transaction
            .query_row(
                "SELECT highest_counter FROM broker_replay_counters WHERE principal_id = ?1",
                params![request.principal_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|_| StoreError::Database)?;
        let nonce_seen = transaction
            .query_row(
                "SELECT 1 FROM broker_replay_nonces
                 WHERE principal_id = ?1 AND request_nonce = ?2",
                params![request.principal_id, request.request_nonce],
                |_| Ok(()),
            )
            .optional()
            .map_err(|_| StoreError::Database)?
            .is_some();
        if highest_counter.is_some_and(|highest| i64::from(request.counter) <= highest)
            || nonce_seen
        {
            transaction.commit().map_err(|_| StoreError::Database)?;
            return Ok(Reservation::Replay);
        }

        transaction
            .execute(
                "INSERT INTO broker_dedup (
                    transaction_id, step_id, request_mac_hash, operation_version_id,
                    state, result_json, created_at, completed_at,
                    retention_eligible, recovery_referenced
                 ) VALUES (?1, ?2, ?3, ?4, 'reserved', NULL, ?5, NULL, 0, 0)",
                params![
                    request.transaction_id,
                    request.step_id,
                    request.request_hash,
                    request.operation_version_id,
                    request.created_at
                ],
            )
            .map_err(|_| StoreError::Database)?;
        transaction
            .execute(
                "INSERT INTO broker_replay_counters (principal_id, highest_counter)
                 VALUES (?1, ?2)
                 ON CONFLICT(principal_id) DO UPDATE SET highest_counter = excluded.highest_counter",
                params![request.principal_id, i64::from(request.counter)],
            )
            .map_err(|_| StoreError::Database)?;
        transaction
            .execute(
                "INSERT INTO broker_replay_nonces (principal_id, request_nonce, first_seen_at)
                 VALUES (?1, ?2, ?3)",
                params![
                    request.principal_id,
                    request.request_nonce,
                    request.created_at
                ],
            )
            .map_err(|_| StoreError::Database)?;
        transaction.commit().map_err(|_| StoreError::Database)?;
        Ok(Reservation::New)
    }

    pub fn next_counter(&self, principal_id: &str) -> Result<u32, StoreError> {
        let highest = self
            .connection
            .query_row(
                "SELECT highest_counter FROM broker_replay_counters WHERE principal_id = ?1",
                params![principal_id],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .map_err(|_| StoreError::Database)?;
        match highest {
            None => Ok(1),
            Some(value) => u32::try_from(value)
                .ok()
                .and_then(|value| value.checked_add(1))
                .ok_or(StoreError::Integrity),
        }
    }

    pub fn mark_unknown_after_dispatch(
        &mut self,
        transaction_id: &str,
        step_id: &str,
    ) -> Result<(), StoreError> {
        let changed = self
            .connection
            .execute(
                "UPDATE broker_dedup
                 SET state = 'unknown-after-crash'
                 WHERE transaction_id = ?1 AND step_id = ?2 AND state = 'reserved'",
                params![transaction_id, step_id],
            )
            .map_err(|_| StoreError::Database)?;
        if changed != 1 {
            return Err(StoreError::Integrity);
        }
        Ok(())
    }

    pub fn record_terminal(
        &mut self,
        transaction_id: &str,
        step_id: &str,
        result: &Value,
        completed_at: i64,
    ) -> Result<(), StoreError> {
        let canonical = serde_json::to_string(result).map_err(|_| StoreError::Integrity)?;
        let transaction = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| StoreError::Database)?;
        let changed = transaction
            .execute(
                "UPDATE broker_dedup
                 SET state = 'terminal', result_json = ?3, completed_at = ?4,
                     retention_eligible = 1
                 WHERE transaction_id = ?1 AND step_id = ?2
                   AND state IN ('reserved', 'unknown-after-crash')",
                params![transaction_id, step_id, canonical, completed_at],
            )
            .map_err(|_| StoreError::Database)?;
        if changed != 1 {
            return Err(StoreError::Integrity);
        }
        transaction.commit().map_err(|_| StoreError::Database)?;
        Ok(())
    }

    pub fn set_recovery_reference(
        &mut self,
        transaction_id: &str,
        step_id: &str,
        referenced: bool,
    ) -> Result<(), StoreError> {
        let changed = self
            .connection
            .execute(
                "UPDATE broker_dedup SET recovery_referenced = ?3
                 WHERE transaction_id = ?1 AND step_id = ?2",
                params![transaction_id, step_id, i64::from(referenced)],
            )
            .map_err(|_| StoreError::Database)?;
        if changed != 1 {
            return Err(StoreError::Integrity);
        }
        Ok(())
    }

    pub fn prune_terminal_before(&mut self, cutoff: i64) -> Result<usize, StoreError> {
        self.connection
            .execute(
                "DELETE FROM broker_dedup
                 WHERE state = 'terminal'
                   AND retention_eligible = 1
                   AND recovery_referenced = 0
                   AND completed_at IS NOT NULL
                   AND completed_at < ?1",
                params![cutoff],
            )
            .map_err(|_| StoreError::Database)
    }

    pub fn count(&self) -> Result<usize, StoreError> {
        self.connection
            .query_row("SELECT COUNT(*) FROM broker_dedup", [], |row| {
                row.get::<_, i64>(0)
            })
            .map_err(|_| StoreError::Database)
            .and_then(|count| usize::try_from(count).map_err(|_| StoreError::Integrity))
    }
}

fn migrate(connection: &Connection) -> Result<(), StoreError> {
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|_| StoreError::Migration)?;
    match version {
        0 => {
            connection
                .execute_batch(
                    "BEGIN IMMEDIATE;
                     CREATE TABLE broker_dedup (
                       transaction_id TEXT NOT NULL,
                       step_id TEXT NOT NULL,
                       request_mac_hash TEXT NOT NULL CHECK(length(request_mac_hash) = 64),
                       operation_version_id TEXT NOT NULL,
                       state TEXT NOT NULL CHECK(state IN (
                         'reserved', 'terminal', 'unknown-after-crash'
                       )),
                       result_json TEXT,
                       created_at INTEGER NOT NULL,
                       completed_at INTEGER,
                       retention_eligible INTEGER NOT NULL CHECK(retention_eligible IN (0, 1)),
                       recovery_referenced INTEGER NOT NULL CHECK(recovery_referenced IN (0, 1)),
                       PRIMARY KEY (transaction_id, step_id),
                       CHECK(
                         (state = 'terminal' AND result_json IS NOT NULL AND completed_at IS NOT NULL)
                         OR
                         (state <> 'terminal' AND result_json IS NULL AND completed_at IS NULL)
                       )
                     ) STRICT;
                     CREATE INDEX broker_dedup_retention_idx
                       ON broker_dedup(state, retention_eligible, recovery_referenced, completed_at);
                     CREATE TABLE broker_replay_counters (
                       principal_id TEXT PRIMARY KEY,
                       highest_counter INTEGER NOT NULL
                         CHECK(highest_counter BETWEEN 0 AND 4294967295)
                     ) STRICT;
                     CREATE TABLE broker_replay_nonces (
                       principal_id TEXT NOT NULL,
                       request_nonce TEXT NOT NULL,
                       first_seen_at INTEGER NOT NULL,
                       PRIMARY KEY (principal_id, request_nonce)
                     ) STRICT;
                     PRAGMA user_version = 1;
                     COMMIT;",
                )
                .map_err(|_| StoreError::Migration)?;
        }
        SCHEMA_VERSION => {}
        _ => return Err(StoreError::Migration),
    }
    Ok(())
}

fn verify_integrity(connection: &Connection) -> Result<(), StoreError> {
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| match error {
            rusqlite::Error::FromSqlConversionFailure(_, Type::Text, _) => StoreError::Integrity,
            _ => StoreError::Database,
        })?;
    if integrity != "ok" {
        return Err(StoreError::Integrity);
    }
    Ok(())
}

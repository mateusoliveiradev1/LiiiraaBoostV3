#[path = "evidence_store/migrations.rs"]
mod migrations;

use std::{path::Path, time::Duration};

use liiiraa_contracts_rust::validate_hardware_evidence_document;
use rusqlite::{
    Connection, Error as SqliteError, ErrorCode, OptionalExtension, Transaction, params,
};
use serde_json::Value;
use sha2::{Digest, Sha256};

const BUSY_TIMEOUT: Duration = Duration::from_millis(50);
const MAX_CHUNK_BYTES: usize = 1_048_576;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EvidenceLifecycle {
    Incomplete,
    Completed,
    Degraded,
    Invalid,
    Immutable,
}

impl EvidenceLifecycle {
    fn as_str(self) -> &'static str {
        match self {
            Self::Incomplete => "incomplete",
            Self::Completed => "completed",
            Self::Degraded => "degraded",
            Self::Invalid => "invalid",
            Self::Immutable => "immutable",
        }
    }

    fn parse(value: &str) -> Result<Self, EvidenceStoreError> {
        match value {
            "incomplete" => Ok(Self::Incomplete),
            "completed" => Ok(Self::Completed),
            "degraded" => Ok(Self::Degraded),
            "invalid" => Ok(Self::Invalid),
            "immutable" => Ok(Self::Immutable),
            _ => Err(EvidenceStoreError::ContractRejected),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReferenceKind {
    Comparison,
    Report,
    Claim,
}

impl ReferenceKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Comparison => "comparison",
            Self::Report => "report",
            Self::Claim => "claim",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvidenceStoreError {
    Busy,
    ContractRejected,
    HashMismatch,
    ForeignKeyRejected,
    NotFound,
    InvalidTransition,
    Migration,
    Storage,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StoredEvidence {
    pub evidence_id: String,
    pub document_kind: String,
    pub schema_version: String,
    pub lifecycle: EvidenceLifecycle,
    pub canonical_json: Vec<u8>,
    pub content_hash: String,
}

pub struct EvidenceStore {
    connection: Connection,
}

impl EvidenceStore {
    pub fn open(path: &Path) -> Result<Self, EvidenceStoreError> {
        let mut connection = Connection::open(path).map_err(map_sqlite_error)?;
        connection
            .busy_timeout(BUSY_TIMEOUT)
            .map_err(map_sqlite_error)?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;\n\
                 PRAGMA journal_mode = WAL;\n\
                 PRAGMA synchronous = NORMAL;",
            )
            .map_err(map_sqlite_error)?;
        migrations::migrations()
            .to_latest(&mut connection)
            .map_err(map_migration_error)?;
        connection
            .execute_batch("BEGIN IMMEDIATE; ROLLBACK;")
            .map_err(map_sqlite_error)?;

        let integrity: String = connection
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .map_err(map_sqlite_error)?;
        if integrity != "ok" {
            return Err(EvidenceStoreError::HashMismatch);
        }

        Ok(Self { connection })
    }

    pub fn append_document(
        &mut self,
        document: &Value,
        lifecycle: EvidenceLifecycle,
        created_order: i64,
    ) -> Result<StoredEvidence, EvidenceStoreError> {
        validate_hardware_evidence_document(document)
            .map_err(|_| EvidenceStoreError::ContractRejected)?;
        ensure_lifecycle(document, lifecycle)?;

        let evidence_id = document_id(document)?;
        let document_kind = required_string(document, "kind")?.to_owned();
        let schema_version = required_string(document, "schemaVersion")?.to_owned();
        let canonical_json = canonical_json(document)?;
        let content_hash = hash_bytes(&canonical_json);
        let completed_order = (lifecycle != EvidenceLifecycle::Incomplete).then_some(created_order);

        self.connection
            .execute(
                "INSERT INTO evidence_documents (
                    evidence_id, document_kind, schema_version, lifecycle, canonical_json,
                    content_hash, created_order, completed_order
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    evidence_id,
                    document_kind,
                    schema_version,
                    lifecycle.as_str(),
                    canonical_json,
                    content_hash,
                    created_order,
                    completed_order,
                ],
            )
            .map_err(map_sqlite_error)?;

        self.get(&evidence_id)
    }

    pub fn get(&self, evidence_id: &str) -> Result<StoredEvidence, EvidenceStoreError> {
        let stored = self
            .connection
            .query_row(
                "SELECT evidence_id, document_kind, schema_version, lifecycle, canonical_json, content_hash
                 FROM evidence_documents WHERE evidence_id = ?1",
                [evidence_id],
                |row| {
                    let lifecycle: String = row.get(3)?;
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        lifecycle,
                        row.get::<_, Vec<u8>>(4)?,
                        row.get::<_, String>(5)?,
                    ))
                },
            )
            .optional()
            .map_err(map_sqlite_error)?
            .ok_or(EvidenceStoreError::NotFound)?;

        if hash_bytes(&stored.4) != stored.5 {
            return Err(EvidenceStoreError::HashMismatch);
        }
        let document: Value =
            serde_json::from_slice(&stored.4).map_err(|_| EvidenceStoreError::HashMismatch)?;
        validate_hardware_evidence_document(&document)
            .map_err(|_| EvidenceStoreError::HashMismatch)?;

        Ok(StoredEvidence {
            evidence_id: stored.0,
            document_kind: stored.1,
            schema_version: stored.2,
            lifecycle: EvidenceLifecycle::parse(&stored.3)?,
            canonical_json: stored.4,
            content_hash: stored.5,
        })
    }

    pub fn admissible_session_ids(&self) -> Result<Vec<String>, EvidenceStoreError> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT evidence_id FROM evidence_documents
                 WHERE document_kind = 'measurement-session' AND lifecycle = 'completed'
                 ORDER BY completed_order, evidence_id",
            )
            .map_err(map_sqlite_error)?;
        let candidates = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(map_sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite_error)?;

        Ok(candidates
            .into_iter()
            .filter(|id| self.get(id).is_ok())
            .collect())
    }

    pub fn complete_session(
        &mut self,
        document: &Value,
        completed_order: i64,
    ) -> Result<StoredEvidence, EvidenceStoreError> {
        validate_hardware_evidence_document(document)
            .map_err(|_| EvidenceStoreError::ContractRejected)?;
        ensure_lifecycle(document, EvidenceLifecycle::Completed)?;
        let session_id = document_id(document)?;
        let chunks = document
            .get("chunks")
            .and_then(Value::as_array)
            .ok_or(EvidenceStoreError::ContractRejected)?;
        let prepared_chunks = prepare_chunks(chunks)?;
        let canonical_document = canonical_json(document)?;
        let document_hash = hash_bytes(&canonical_document);
        let schema_version = required_string(document, "schemaVersion")?.to_owned();

        let transaction = self.connection.transaction().map_err(map_sqlite_error)?;
        ensure_incomplete_session(&transaction, &session_id)?;
        transaction
            .execute(
                "DELETE FROM sample_chunks WHERE session_id = ?1",
                [&session_id],
            )
            .map_err(map_sqlite_error)?;
        for chunk in prepared_chunks {
            transaction
                .execute(
                    "INSERT INTO sample_chunks (
                        session_id, sequence, schema_version, canonical_json, content_hash, byte_length
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        session_id,
                        chunk.sequence,
                        schema_version,
                        chunk.canonical_json,
                        chunk.content_hash,
                        chunk.byte_length,
                    ],
                )
                .map_err(map_sqlite_error)?;
        }
        let updated = transaction
            .execute(
                "UPDATE evidence_documents SET
                    lifecycle = 'completed', canonical_json = ?1, content_hash = ?2,
                    completed_order = ?3
                 WHERE evidence_id = ?4 AND lifecycle = 'incomplete'",
                params![
                    canonical_document,
                    document_hash,
                    completed_order,
                    session_id
                ],
            )
            .map_err(map_sqlite_error)?;
        if updated != 1 {
            return Err(EvidenceStoreError::InvalidTransition);
        }
        transaction.commit().map_err(map_sqlite_error)?;

        self.get(&session_id)
    }

    pub fn chunk_sequences(&self, session_id: &str) -> Result<Vec<i64>, EvidenceStoreError> {
        let mut statement = self
            .connection
            .prepare("SELECT sequence FROM sample_chunks WHERE session_id = ?1 ORDER BY sequence")
            .map_err(map_sqlite_error)?;
        statement
            .query_map([session_id], |row| row.get::<_, i64>(0))
            .map_err(map_sqlite_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite_error)
    }

    pub fn link(
        &mut self,
        owner_id: &str,
        target_id: &str,
        kind: ReferenceKind,
    ) -> Result<(), EvidenceStoreError> {
        self.connection
            .execute(
                "INSERT INTO evidence_references (owner_id, target_id, reference_kind)
                 VALUES (?1, ?2, ?3)",
                params![owner_id, target_id, kind.as_str()],
            )
            .map(|_| ())
            .map_err(|error| {
                if is_constraint_error(&error) {
                    EvidenceStoreError::ForeignKeyRejected
                } else {
                    map_sqlite_error(error)
                }
            })
    }

    pub fn prune_unreferenced_before(
        &mut self,
        cutoff_order: i64,
        limit: usize,
    ) -> Result<usize, EvidenceStoreError> {
        let transaction = self.connection.transaction().map_err(map_sqlite_error)?;
        let candidates = {
            let mut statement = transaction
                .prepare(
                    "SELECT evidence_id FROM evidence_documents d
                     WHERE d.created_order < ?1
                       AND NOT EXISTS (SELECT 1 FROM evidence_references r WHERE r.owner_id = d.evidence_id)
                       AND NOT EXISTS (SELECT 1 FROM evidence_references r WHERE r.target_id = d.evidence_id)
                       AND NOT EXISTS (
                           SELECT 1 FROM retention_leases l
                           WHERE l.evidence_id = d.evidence_id AND l.retained_until_order >= ?1
                       )
                     ORDER BY d.created_order, d.evidence_id
                     LIMIT ?2",
                )
                .map_err(map_sqlite_error)?;
            statement
                .query_map(params![cutoff_order, limit as i64], |row| {
                    row.get::<_, String>(0)
                })
                .map_err(map_sqlite_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(map_sqlite_error)?
        };

        let mut removed = 0;
        for evidence_id in candidates {
            removed += transaction
                .execute(
                    "DELETE FROM evidence_documents WHERE evidence_id = ?1",
                    [evidence_id],
                )
                .map_err(map_sqlite_error)?;
        }
        transaction.commit().map_err(map_sqlite_error)?;
        Ok(removed)
    }
}

struct PreparedChunk {
    sequence: i64,
    canonical_json: Vec<u8>,
    content_hash: String,
    byte_length: i64,
}

fn prepare_chunks(chunks: &[Value]) -> Result<Vec<PreparedChunk>, EvidenceStoreError> {
    chunks
        .iter()
        .enumerate()
        .map(|(expected_sequence, chunk)| {
            let sequence = chunk
                .get("sequence")
                .and_then(Value::as_i64)
                .ok_or(EvidenceStoreError::ContractRejected)?;
            if sequence != expected_sequence as i64 {
                return Err(EvidenceStoreError::ContractRejected);
            }
            let canonical_json = canonical_json(chunk)?;
            if canonical_json.is_empty() || canonical_json.len() > MAX_CHUNK_BYTES {
                return Err(EvidenceStoreError::ContractRejected);
            }
            Ok(PreparedChunk {
                sequence,
                content_hash: hash_bytes(&canonical_json),
                byte_length: canonical_json.len() as i64,
                canonical_json,
            })
        })
        .collect()
}

fn ensure_incomplete_session(
    transaction: &Transaction<'_>,
    session_id: &str,
) -> Result<(), EvidenceStoreError> {
    let lifecycle = transaction
        .query_row(
            "SELECT lifecycle FROM evidence_documents
             WHERE evidence_id = ?1 AND document_kind = 'measurement-session'",
            [session_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(map_sqlite_error)?
        .ok_or(EvidenceStoreError::NotFound)?;
    if lifecycle != "incomplete" {
        return Err(EvidenceStoreError::InvalidTransition);
    }
    Ok(())
}

fn ensure_lifecycle(
    document: &Value,
    lifecycle: EvidenceLifecycle,
) -> Result<(), EvidenceStoreError> {
    let kind = required_string(document, "kind")?;
    let expected = if kind == "measurement-session" {
        match required_string(document, "status")? {
            "incomplete" => EvidenceLifecycle::Incomplete,
            "completed" => EvidenceLifecycle::Completed,
            "degraded" => EvidenceLifecycle::Degraded,
            "invalid" => EvidenceLifecycle::Invalid,
            _ => return Err(EvidenceStoreError::ContractRejected),
        }
    } else {
        EvidenceLifecycle::Immutable
    };

    if lifecycle != expected {
        return Err(EvidenceStoreError::InvalidTransition);
    }
    Ok(())
}

fn document_id(document: &Value) -> Result<String, EvidenceStoreError> {
    let field = match required_string(document, "kind")? {
        "inventory-snapshot" => "evidenceId",
        "measurement-session" => "sessionId",
        "evidence-comparison" => "comparisonId",
        "evidence-report" => "reportId",
        "claim-admission" => "claimId",
        _ => return Err(EvidenceStoreError::ContractRejected),
    };
    Ok(required_string(document, field)?.to_owned())
}

fn required_string<'a>(document: &'a Value, field: &str) -> Result<&'a str, EvidenceStoreError> {
    document
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or(EvidenceStoreError::ContractRejected)
}

fn canonical_json(document: &Value) -> Result<Vec<u8>, EvidenceStoreError> {
    serde_json::to_vec(&canonicalize(document)).map_err(|_| EvidenceStoreError::ContractRejected)
}

fn canonicalize(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(canonicalize).collect()),
        Value::Object(values) => {
            let mut keys = values.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            let mut canonical = serde_json::Map::new();
            for key in keys {
                canonical.insert(key.clone(), canonicalize(&values[key]));
            }
            Value::Object(canonical)
        }
        _ => value.clone(),
    }
}

fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut encoded = String::with_capacity(71);
    encoded.push_str("sha256:");
    for byte in digest {
        use std::fmt::Write;
        write!(&mut encoded, "{byte:02x}").expect("write SHA-256 hex");
    }
    encoded
}

fn is_constraint_error(error: &SqliteError) -> bool {
    matches!(
        error,
        SqliteError::SqliteFailure(inner, _) if inner.code == ErrorCode::ConstraintViolation
    )
}

fn map_sqlite_error(error: SqliteError) -> EvidenceStoreError {
    match error {
        SqliteError::SqliteFailure(inner, _)
            if matches!(
                inner.code,
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked
            ) =>
        {
            EvidenceStoreError::Busy
        }
        _ => EvidenceStoreError::Storage,
    }
}

fn map_migration_error(error: rusqlite_migration::Error) -> EvidenceStoreError {
    match error {
        rusqlite_migration::Error::RusqliteError { err, .. } => map_sqlite_error(err),
        _ => EvidenceStoreError::Migration,
    }
}

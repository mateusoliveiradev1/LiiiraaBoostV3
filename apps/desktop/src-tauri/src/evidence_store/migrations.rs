use rusqlite_migration::{M, Migrations};

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(
        r#"
        CREATE TABLE evidence_documents (
          evidence_id TEXT PRIMARY KEY NOT NULL,
          document_kind TEXT NOT NULL,
          schema_version TEXT NOT NULL,
          lifecycle TEXT NOT NULL CHECK (
            lifecycle IN ('incomplete', 'completed', 'degraded', 'invalid', 'immutable')
          ),
          canonical_json BLOB NOT NULL,
          content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
          created_order INTEGER NOT NULL,
          completed_order INTEGER,
          CHECK (
            (lifecycle = 'incomplete' AND completed_order IS NULL)
            OR (lifecycle <> 'incomplete' AND completed_order IS NOT NULL)
          )
        ) STRICT;

        CREATE TABLE sample_chunks (
          session_id TEXT NOT NULL,
          sequence INTEGER NOT NULL CHECK (sequence >= 0),
          schema_version TEXT NOT NULL,
          canonical_json BLOB NOT NULL,
          content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
          byte_length INTEGER NOT NULL CHECK (byte_length > 0 AND byte_length <= 1048576),
          PRIMARY KEY (session_id, sequence),
          FOREIGN KEY (session_id) REFERENCES evidence_documents(evidence_id) ON DELETE RESTRICT
        ) STRICT;

        CREATE TABLE evidence_references (
          owner_id TEXT NOT NULL,
          target_id TEXT NOT NULL,
          reference_kind TEXT NOT NULL CHECK (
            reference_kind IN ('comparison', 'report', 'claim')
          ),
          PRIMARY KEY (owner_id, target_id, reference_kind),
          FOREIGN KEY (owner_id) REFERENCES evidence_documents(evidence_id) ON DELETE RESTRICT,
          FOREIGN KEY (target_id) REFERENCES evidence_documents(evidence_id) ON DELETE RESTRICT
        ) STRICT;

        CREATE TABLE retention_leases (
          evidence_id TEXT NOT NULL,
          lease_owner TEXT NOT NULL,
          retained_until_order INTEGER NOT NULL CHECK (retained_until_order >= 0),
          PRIMARY KEY (evidence_id, lease_owner),
          FOREIGN KEY (evidence_id) REFERENCES evidence_documents(evidence_id) ON DELETE CASCADE
        ) STRICT;

        CREATE INDEX evidence_documents_lifecycle_order
          ON evidence_documents(lifecycle, created_order);
        CREATE INDEX evidence_references_target
          ON evidence_references(target_id);
        CREATE INDEX retention_leases_expiry
          ON retention_leases(retained_until_order);
        "#,
    )])
}

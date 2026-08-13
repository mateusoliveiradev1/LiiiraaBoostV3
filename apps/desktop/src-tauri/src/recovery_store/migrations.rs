use rusqlite_migration::{M, Migrations};

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(
            r#"
            CREATE TABLE recovery_metadata (
              singleton INTEGER PRIMARY KEY NOT NULL CHECK (singleton = 1),
              database_id TEXT NOT NULL UNIQUE CHECK (length(database_id) BETWEEN 16 AND 128)
            ) STRICT;

            CREATE TABLE journal_events (
              sequence INTEGER PRIMARY KEY NOT NULL CHECK (sequence BETWEEN 0 AND 4294967295),
              record_id TEXT NOT NULL UNIQUE CHECK (length(record_id) BETWEEN 1 AND 128),
              event_kind TEXT NOT NULL CHECK (length(event_kind) BETWEEN 1 AND 96),
              document_sequence INTEGER CHECK (
                document_sequence IS NULL OR document_sequence BETWEEN 0 AND 4294967295
              ),
              transaction_id TEXT,
              canonical_json BLOB NOT NULL CHECK (length(canonical_json) BETWEEN 2 AND 1048576),
              content_hash TEXT NOT NULL CHECK (
                length(content_hash) = 71 AND content_hash GLOB 'sha256:[0-9a-f]*'
              ),
              key_id TEXT NOT NULL CHECK (length(key_id) BETWEEN 1 AND 64),
              key_epoch INTEGER NOT NULL CHECK (key_epoch BETWEEN 1 AND 4294967295),
              previous_mac TEXT NOT NULL CHECK (
                length(previous_mac) = 76 AND previous_mac GLOB 'hmac-sha256:[0-9a-f]*'
              ),
              event_mac TEXT NOT NULL CHECK (
                length(event_mac) = 76 AND event_mac GLOB 'hmac-sha256:[0-9a-f]*'
              )
            ) STRICT;

            CREATE TABLE plan_revisions (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              plan_id TEXT NOT NULL,
              revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 4294967295),
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              UNIQUE (plan_id, revision),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE plan_operations (
              record_id TEXT NOT NULL,
              operation_version_id TEXT NOT NULL,
              dependency_group_id TEXT NOT NULL,
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              PRIMARY KEY (record_id, operation_version_id),
              FOREIGN KEY (record_id) REFERENCES plan_revisions(record_id) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE approval_events (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              plan_id TEXT NOT NULL,
              plan_revision INTEGER NOT NULL CHECK (plan_revision BETWEEN 1 AND 4294967295),
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT,
              FOREIGN KEY (plan_id, plan_revision) REFERENCES plan_revisions(plan_id, revision) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE transactions (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              plan_id TEXT NOT NULL,
              plan_revision INTEGER NOT NULL CHECK (plan_revision BETWEEN 1 AND 4294967295),
              approval_id TEXT NOT NULL,
              intent TEXT NOT NULL,
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT,
              FOREIGN KEY (approval_id) REFERENCES approval_events(record_id) ON DELETE RESTRICT,
              FOREIGN KEY (plan_id, plan_revision) REFERENCES plan_revisions(plan_id, revision) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE recovery_checkpoints (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              transaction_id TEXT NOT NULL,
              plan_id TEXT NOT NULL,
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT,
              FOREIGN KEY (transaction_id) REFERENCES transactions(record_id) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE receipts (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              transaction_id TEXT NOT NULL,
              plan_id TEXT NOT NULL,
              operation_version_id TEXT NOT NULL,
              human_summary TEXT NOT NULL CHECK (length(human_summary) BETWEEN 1 AND 512),
              technical_summary TEXT NOT NULL CHECK (length(technical_summary) BETWEEN 1 AND 512),
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT,
              FOREIGN KEY (transaction_id) REFERENCES transactions(record_id) ON DELETE RESTRICT
            ) STRICT;

            CREATE TABLE operation_promotions (
              record_id TEXT PRIMARY KEY NOT NULL,
              integrity_sequence INTEGER NOT NULL UNIQUE,
              operation_version_id TEXT NOT NULL,
              stage TEXT NOT NULL,
              verdict TEXT NOT NULL,
              canonical_json BLOB NOT NULL,
              content_hash TEXT NOT NULL CHECK (length(content_hash) = 71),
              FOREIGN KEY (integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT
            ) STRICT;

            CREATE UNIQUE INDEX journal_transaction_document_sequence
              ON journal_events(transaction_id, document_sequence)
              WHERE transaction_id IS NOT NULL AND document_sequence IS NOT NULL;
            CREATE INDEX journal_events_kind_sequence ON journal_events(event_kind, sequence);
            CREATE INDEX transactions_plan_revision ON transactions(plan_id, plan_revision);
            CREATE INDEX recovery_checkpoints_transaction ON recovery_checkpoints(transaction_id);
            CREATE INDEX receipts_transaction ON receipts(transaction_id);
            CREATE INDEX operation_promotions_version_stage
              ON operation_promotions(operation_version_id, stage);
            "#,
        ),
        M::up(
            r#"
            CREATE TABLE executor_projection (
              transaction_id TEXT PRIMARY KEY NOT NULL,
              document_sequence INTEGER NOT NULL CHECK (
                document_sequence BETWEEN 0 AND 4294967295
              ),
              state TEXT NOT NULL,
              source_integrity_sequence INTEGER NOT NULL UNIQUE,
              source_event_mac TEXT NOT NULL CHECK (length(source_event_mac) = 76),
              FOREIGN KEY (source_integrity_sequence) REFERENCES journal_events(sequence) ON DELETE RESTRICT
            ) STRICT;

            CREATE TRIGGER recovery_metadata_no_update
            BEFORE UPDATE ON recovery_metadata BEGIN SELECT RAISE(ABORT, 'append-only recovery metadata'); END;
            CREATE TRIGGER recovery_metadata_no_delete
            BEFORE DELETE ON recovery_metadata BEGIN SELECT RAISE(ABORT, 'append-only recovery metadata'); END;

            CREATE TRIGGER journal_events_no_update
            BEFORE UPDATE ON journal_events BEGIN SELECT RAISE(ABORT, 'append-only journal events'); END;
            CREATE TRIGGER journal_events_no_delete
            BEFORE DELETE ON journal_events BEGIN SELECT RAISE(ABORT, 'append-only journal events'); END;

            CREATE TRIGGER plan_revisions_no_update
            BEFORE UPDATE ON plan_revisions BEGIN SELECT RAISE(ABORT, 'append-only plan revisions'); END;
            CREATE TRIGGER plan_revisions_no_delete
            BEFORE DELETE ON plan_revisions BEGIN SELECT RAISE(ABORT, 'append-only plan revisions'); END;
            CREATE TRIGGER plan_operations_no_update
            BEFORE UPDATE ON plan_operations BEGIN SELECT RAISE(ABORT, 'append-only plan operations'); END;
            CREATE TRIGGER plan_operations_no_delete
            BEFORE DELETE ON plan_operations BEGIN SELECT RAISE(ABORT, 'append-only plan operations'); END;
            CREATE TRIGGER approval_events_no_update
            BEFORE UPDATE ON approval_events BEGIN SELECT RAISE(ABORT, 'append-only approval events'); END;
            CREATE TRIGGER approval_events_no_delete
            BEFORE DELETE ON approval_events BEGIN SELECT RAISE(ABORT, 'append-only approval events'); END;
            CREATE TRIGGER transactions_no_update
            BEFORE UPDATE ON transactions BEGIN SELECT RAISE(ABORT, 'append-only transactions'); END;
            CREATE TRIGGER transactions_no_delete
            BEFORE DELETE ON transactions BEGIN SELECT RAISE(ABORT, 'append-only transactions'); END;
            CREATE TRIGGER recovery_checkpoints_no_update
            BEFORE UPDATE ON recovery_checkpoints BEGIN SELECT RAISE(ABORT, 'append-only recovery checkpoints'); END;
            CREATE TRIGGER recovery_checkpoints_no_delete
            BEFORE DELETE ON recovery_checkpoints BEGIN SELECT RAISE(ABORT, 'append-only recovery checkpoints'); END;
            CREATE TRIGGER receipts_no_update
            BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT, 'append-only receipts'); END;
            CREATE TRIGGER receipts_no_delete
            BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT, 'append-only receipts'); END;
            CREATE TRIGGER operation_promotions_no_update
            BEFORE UPDATE ON operation_promotions BEGIN SELECT RAISE(ABORT, 'append-only operation promotions'); END;
            CREATE TRIGGER operation_promotions_no_delete
            BEFORE DELETE ON operation_promotions BEGIN SELECT RAISE(ABORT, 'append-only operation promotions'); END;
            "#,
        ),
    ])
}

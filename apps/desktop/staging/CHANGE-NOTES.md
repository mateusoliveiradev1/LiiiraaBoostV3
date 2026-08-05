# Internal #023001 change notes

This numbered build projects the Phase 4 identity, commerce, device, and administration flows against the exact staging API and contract version 1.0.

Access is restricted to explicitly invited PCs. The installer is not published, uses development-only signing truth, has no public trust or SmartScreen reputation, and is not eligible for Stable, Beta, Experimental, or production distribution.

Rollback targets the immutable `internal-023000` manifest identity. The checked-in manifest records the frozen channel evidence used by CI; CI must reject any identity, authority, entitlement key, trust, or rollback mismatch before producing build output.

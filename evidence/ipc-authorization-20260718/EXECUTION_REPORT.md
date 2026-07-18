# OpenClaw authorization IPC process evidence

All 14 recorded assertions passed against real invarosd PID 1837274 and client-harness PID 1837256. DENY left the sentinel hash unchanged; ALLOW and the concurrent ALLOW produced the two recorded executions. Correlation, transmitted parameter digest/length, peer PID, duplicate replay, collision denial, stale denial, concurrency, cleanup, and daemon-unavailable failure passed.

This package does not contain a live OpenClaw Gateway HTTP run: deployment of the new plugin artifact was blocked by unavailable non-interactive sudo authentication. The historical native-hook evidence is separate. Logs are redacted operational evidence, not cryptographic or tamper-proof receipts.

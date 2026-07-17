# **InvarOS Dell Server Pilot Engineering Execution Plan**

## **1\. Executive Engineering Decision**

The engineering objective defined for the Germany × Canada AI for Real Impact Challenge pilot requires the delivery of a highly constrained, verifiable two-minute demonstration of the InvarOS platform operating securely on local hardware. The fundamental scenario being built is a locally hosted OpenClaw agent, driven by a quantized Qwen large language model, which attempts two distinct operations: an authorized local file-read action that successfully executes, and a prohibited state-changing network-egress action that is deterministically intercepted and blocked by the InvarOS governance architecture prior to execution. The resulting denial must yield a cryptographically verifiable refusal receipt, proving that the decision was driven by declared intent rather than arbitrary heuristics.  
The recommended primary implementation path centers on the deployment of an interception adapter embedded directly within the OpenClaw tool-calling sequence. This adapter will act as the absolute enforcement boundary, extracting the agent's capability requests, suspending the execution thread, and executing a synchronous Unix domain socket connection to a locally running InvarOS daemon (invarosd). This daemon will function as the bridge between the asynchronous Python execution environment and the deterministic C++ mathematical core, evaluating the extracted capability request against a pre-loaded intent baseline.  
The fallback implementation path, invoked only if the OpenClaw architecture proves structurally hostile to synchronous thread suspension, involves the deployment of a FastMCP interception proxy. This proxy would interpose itself between the agent and the Model Context Protocol layer, intercepting standardized messages prior to host OS execution.  
The earliest go/no-go viability gate for the entire pilot is the immediate empirical validation of the pre-execution thread-pause mechanism. If the application environment cannot reliably await an inter-process communication (IPC) response without failing open or crashing the agent, the fundamental fail-closed security posture cannot be mathematically guaranteed.  
The minimum reusable architecture extracted from this pilot comprises the permanent capability schemas, the IPC socket listener bridging the environment, the canonical Python-to-C++ evaluation interface, and the cryptographic receipt generation module. Challenge-specific scaffolding will be strictly isolated from these core components. Pilot completion is decisively achieved when the authorized action succeeds, the prohibited action is intercepted before any OS-level side effects manifest, the system fails closed upon daemon termination, and the cryptographic refusal receipt can be independently verified by a standalone validation utility. Major non-goals explicitly excluded from this plan involve general commercialization features, Kubernetes deployments, new universal C application binary interfaces, or dynamic system-wide topology discovery.

## **1.1 Required Analysis and Component Verification**

Prior to establishing the dependency-ordered engineering milestones, a rigorous evaluation of the provided operational intelligence is necessary to categorize the implementation state of all referenced components. The operating environment is a Dell host (yozi) running Ubuntu 24.04.4 LTS on an Intel Core i5-7300HQ CPU, equipped with 7.4 GiB of total physical memory and an NVIDIA GeForce GTX 1050 Ti Mobile GPU.1  
The following analytical determinations form the baseline for the implementation strategy. Assertions have been strictly labeled according to the evidentiary standard established by the host telemetry.  
The host operating system, processor architecture, available memory, and NVIDIA driver ecosystem (version 535.309.01, CUDA 12.2) are classified as verified from provided evidence.1 The presence of active loopback and isolated Docker bridge interfaces (docker0 at 172.17.0.1/16) is similarly verified from provided evidence, providing a reliable sandbox for the mock receiver.1  
The deployment of Ollama, the Qwen model quantization strategy, the OpenClaw installation, and the OpenClaw before\_tool\_call interception hook are classified as proposed but unverified. The current documentation provides no operational evidence that these components are running or configured on the host.  
The current invarosd daemon, the Python-to-C++ path, the TBoM artifacts, and the receipt generation schema are classified as partially implemented or proposed but unverified, pending direct operational validation on the Dell server. The assumption that the existing C++ mathematical core can support a synchronous decision flow without creating a second enforcement architecture is classified as likely but requires validation. The four-core Intel i5 CPU without hyperthreading 1 may experience severe thread starvation during active LLM token generation, potentially disrupting synchronous IPC timing.  
The single technical uncertainty serving as the earliest pilot viability gate is whether the OpenClaw execution loop genuinely permits a blocking, synchronous pause during tool evaluation without defaulting to a timeout failure that inadvertently drops the governance context. If this hook is unreliable, FastMCP interception is evaluated as a sound fallback, providing a standardized protocol boundary that can be proxied and paused without interfering with the internal logic of the OpenClaw agent itself.  
Finally, regarding requirements for the challenge video versus what is merely desirable, dynamic topology discovery and automated policy compilation are deemed not required for this pilot. A manually authored, static intent representation is sufficient for the demonstration, allowing extensive engineering effort to be deferred until after submission.

## **2\. Current-State to Target-State Matrix**

The translation of the current host environment into the target demonstration state requires precise engineering interventions. The following matrix delineates the required modifications, their operational locations, and the rigorous evidence required to consider each component complete. The analysis strictly factors in the hardware constraints, notably the limitation of 6.1 GiB available memory and 4096 MiB of GPU VRAM.1

| Component | Current Verified State | Pilot Target State | Required Engineering Change | Repository / Location | Reusability Classification | Evidence Required for Completion |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Dell Host Environment** | Verified: Ubuntu 24.04.4, i5-7300HQ, 7.4GB RAM, GTX 1050 Ti.1 | Stable, low-latency baseline supporting concurrent inference and IPC. | Isolate LLM execution to GPU to preserve the 6.1GB available RAM for daemon stability. | Host OS (yozi) | Permanent platform capability | htop indicates continuous system stability without swap-thrashing during active inference. |
| **Ollama Inference Engine** | Proposed but unverified. | Local API serving quantized LLM without external egress. | Install binary, bind explicitly to local loopback 127.0.0.1:11434. | Host OS / User namespace | Reusable integration | API responds successfully to /api/tags via local curl. |
| **Qwen Model** | Proposed but unverified. | Loaded entirely into the 4096 MiB VRAM.1 | Pull and quantize a 1.5B or 1.8B Int4 variant to ensure context window fits alongside weights. | Ollama localized storage | Test infrastructure | Model generates syntactically valid JSON tool calls in under 5000 milliseconds. |
| **OpenClaw Agent** | Proposed but unverified. | Primary agent execution framework. | Configure system prompts to exclusively utilize the designated pilot tools. | OpenClaw deployment | Reusable integration | Agent consistently attempts to trigger tools when prompted with target phrases. |
| **OpenClaw Interception** | Proposed but unverified. | Pre-execution deterministic pause. | Implement before\_tool\_call hook to intercept arguments and suspend thread pending IPC. | OpenClaw / Adapter repo | Reusable integration | Execution halts indefinitely until the IPC socket returns an explicit payload. |
| **invarosd Daemon** | Proposed but unverified. | Privileged background listener handling governance. | Deploy Unix domain socket listener inside /run/user/1000/ tmpfs.1 | InvarOS daemon repo | Permanent platform capability | Process accepts, decodes, and logs length-prefixed IPC connections. |
| **Unix Socket / IPC Interface** | Not implemented. | Low-latency, unprivileged communication channel. | Establish length-prefixed JSON schema transmission over AF\_UNIX sockets. | Core adapter repo | Permanent platform capability | Empty payload round-trip times consistently measure below 10 milliseconds. |
| **Python Adapter Layer** | Likely but requires validation. | Bridge mapping IPC data to C++ ABI. | Expose evaluation methods to the asynchronous socket loop without blocking the Global Interpreter Lock. | Python bindings | Permanent platform capability | Python layer invokes C++ methods continuously without segmentation faults. |
| **C++ Mathematical Core** | Likely but requires validation. | Evaluates exact intent matching. | Ensure execution path strictly avoids dynamic memory allocation spikes and network calls. | Core C++ repo | Permanent platform capability | Identical capability requests generate identical cryptographic digests across multiple runs. |
| **Intent Representation** | Proposed but unverified. | Fixed, memory-resident policy baseline. | Instantiate a static YAML/JSON dictionary representing the allowed tool baseline. | TBoM artifacts | Challenge scaffolding | Daemon successfully loads and parses the static baseline upon initialization. |
| **Receipt Generation** | Proposed but unverified. | Cryptographic refusal proof. | Integrate ES256 signing logic using the ecdsa library triggered explicitly by DENY states. | Core daemon repo | Permanent platform capability | System outputs a verifiable signature corresponding exactly to the rejected payload hash. |
| **Public Minimal Artifact** | Proposed but unverified. | Verifiable schema stripping internal paths. | Redact raw argument paths while maintaining the deterministic hash output. | Explorer / Tools | Reusable integration | Standalone scripts can verify the signature using only public parameters. |
| **Receipt Validator** | Proposed but unverified. | Independent verification mechanism. | Author a standalone CLI tool to recalculate the payload hash and verify the ECDSA signature. | Tools directory | Reusable integration | Executing the script against the JSON receipt outputs a definitive boolean validity. |
| **Mock Receiver** | Not implemented. | Captive endpoint for prohibited egress attempts. | Deploy a lightweight Python HTTP server bound explicitly to the docker0 bridge at 172.17.0.1.1 | Test infrastructure | Test infrastructure | Server transaction logs record zero received bytes during interception events. |
| **Deterministic Test Harness** | Not implemented. | Repeatable trigger bypassing LLM non-determinism. | Author injection scripts passing static JSON payloads directly to the OpenClaw execution queue. | Test infrastructure | Test infrastructure | The full authorization and interception flows execute successfully without loading Ollama into memory. |
| **Explorer Interface** | Partially implemented. | Observable audit trail for video capture. | Streamline existing terminal interfaces or tmux panes to highlight the receipt JSON clearly. | Explorer repo | Challenge scaffolding | The final video capture displays the cryptographic proof without requiring manual scrolling. |

## **3\. Architecture Decision Records**

The following detailed Architecture Decision Records document the engineering rationale required to navigate the hardware constraints of the target deployment environment while satisfying the immutable security postulates of the InvarOS platform.

### **ADR 1: OpenClaw Native Hooking versus FastMCP Protocol Interception**

The contextual problem involves establishing the exact point of governance intervention. The InvarOS platform requires an intercept after the large language model has fully formulated its capability request but absolutely before the host operating system processes the system call. The decision is to attempt the implementation of a native before\_tool\_call hook directly inside the OpenClaw execution pipeline as the primary path. The alternative considered was deploying a FastMCP proxy to intercept Model Context Protocol messages over a localized network layer. The native hook is preferred because it avoids the overhead of parsing standard protocol buffers and provides the deepest possible integration with the agent's internal state machine, aligning with the mandate to maximize reusable InvarOS platform capability. The consequences of this choice involve an increased risk of framework instability if OpenClaw handles asynchronous thread suspension poorly. If Milestone PILOT-003 demonstrates that the framework cannot reliably pause execution while awaiting governance resolution, the reversal condition dictates an immediate architectural pivot to the FastMCP proxy fallback.

### **ADR 2: Unix Domain Sockets versus HTTP REST IPC Interfacing**

The contextual problem requires bridging the OpenClaw interception adapter with the invarosd background service securely and with minimal latency. The decision is to utilize local Unix domain sockets (specifically utilizing the tmpfs mounts available within /run/user/1000 as verified on the host 1) employing a length-prefixed binary framing protocol. The alternatives considered included local HTTP REST interfaces or gRPC over standard TCP loopbacks. The Unix domain socket approach is heavily preferred because it completely bypasses the kernel's TCP/IP stack overhead, directly mitigating latency risks caused by the constrained four-core Intel i5 CPU.1 Furthermore, Unix sockets natively inherit operating system file permissions, allowing the communication channel to be rigidly locked to the invaros user account without requiring complex application-layer authentication protocols. The consequence is that the adapter and daemon must permanently reside on the same filesystem instance. Should the existing Python asynchronous libraries severely complicate socket lifecycle management, the reversal condition permits falling back to a lightweight HTTP server.

### **ADR 3: Active Policy Enforcement versus Hardcoded Demonstration Logic**

The contextual problem balances the need for a rapid video production cycle against the fundamental technical honesty of the demonstration. The challenge requires blocking a prohibited action. The decision is to enforce this block utilizing the actual C++ mathematical core evaluating the capability request against a loaded intent baseline. The alternative considered was hardcoding a brittle string-matching algorithm purely to trigger the denial screen for the camera. The policy-driven decision is preferred because hardcoding bypasses the actual InvarOS intellectual property, directly violating the core engineering principle of the pilot. The consequence is a necessary increase in data normalization complexity to ensure the JSON payloads perfectly match the expected evaluation schemas. A hardcoded block will only be permitted as a reversal condition during the initial feasibility tests in PILOT-003, and must be completely excised prior to the final integration milestones.

### **ADR 4: Deterministic Harness Testing versus Live LLM Evaluation**

The contextual problem is validating continuous integration builds and performance metrics on a heavily resource-constrained host featuring only 4096 MiB of GPU VRAM.1 The decision establishes a dual-track methodology: the final video will utilize live LLM execution via Ollama, while all engineering development, debugging, and validation will be executed via a deterministic test harness that injects syntactically perfect JSON tool calls directly into the OpenClaw pipeline. Relying entirely on LLM execution during development was considered and rejected. The deterministic approach is preferred because large language models introduce severe non-determinism and timing variations that obscure underlying system latency, particularly when memory offloading occurs. The consequence is the requirement to build an injection scaffolding layer. There is no reversal condition for this decision; deterministic testing is mandatory for system stability.

### **ADR 5: Fail-Closed Timeout Parameterization**

The contextual problem requires defining the exact behavior of the system if the governance daemon becomes unreachable, either through malice or system failure. The decision mandates a strict fail-closed posture implementing a 500-millisecond socket timeout limit. Any connection refusal, protocol timeout, or malformed daemon response will instantly default to a secure denial state flagged with an ERROR\_FAIL\_CLOSED reason code. Failing open or implementing indefinite retry loops were considered but rejected as fundamental violations of the InvarOS security thesis. The fail-closed posture is preferred as it mathematically guarantees safety even during total framework degradation. The consequence of a strict 500-millisecond timeout is the risk of false-positive denials if the Intel i5 CPU 1 experiences severe scheduling delays during active token inference. If host telemetry indicates that thread starvation routinely causes legitimate evaluation latency to exceed 500 milliseconds, the reversal condition permits extending the timeout to a maximum of 2000 milliseconds strictly for this specific Dell hardware environment.

### **ADR 6: Elliptic Curve Cryptography for Receipt Generation**

The contextual problem requires generating a mathematically verifiable refusal receipt on a CPU without leveraging external key management infrastructure. The decision selects the ES256 algorithm (ECDSA using the P-256 curve and SHA-256 hash algorithm) executed via the Python ecdsa library. The alternatives considered included RSA-2048 or Ed25519. ES256 is preferred due to its ubiquitous standard library support and significantly lower computational overhead for signature generation compared to RSA, which is critical given the shared utilization of the host CPU.1 The consequence is the requirement to securely manage the private ECDSA key on the host filesystem. The reversal condition dictates a shift to Ed25519 if latency profiling indicates the P-256 curve implementation causes IPC timeouts.

### **ADR 7: Static TBoM Generation versus Dynamic Topology Discovery**

The contextual problem addresses how the system acquires the baseline of allowed behaviors. The decision is to manually author a static intent baseline (a simplified TBoM) for the two-minute demonstration. The alternative considered was implementing a full dynamic discovery agent to trace local application behaviors and compile the policy automatically. The static approach is preferred because building reliable process-tracing infrastructure across the Ubuntu environment vastly exceeds the scope required to demonstrate the core interception capability. The consequence is a temporary reliance on manual data entry for the demonstration baseline. There is no reversal condition; dynamic discovery is explicitly deferred to post-pilot phases.

### **ADR 8: Native Python Bindings versus Universal C ABI Expansion**

The contextual problem requires moving data from the Python daemon into the C++ mathematical core. The decision is to reuse the existing ctypes or pybind11 integration layer explicitly designed for the current platform iterations. The alternative considered was pausing development to architect a new universal C application binary interface designed to support future Rust and Go clients. The native reuse is preferred because expanding the ABI introduces massive risk to the pilot timeline without directly contributing to the immediate demonstration requirements. The consequence is continued technical debt within the Python integration layer. The reversal condition is triggered only if the existing bindings exhibit severe memory leakage or unresolvable segmentation faults during continuous deterministic testing.

## **4\. Dependency-Ordered Engineering Milestones**

The successful execution of this pilot requires strict adherence to a dependency-ordered critical path. Concurrent development must be tightly constrained to avoid integration failures. Each milestone defines the precise actions, verifications, and architectural constraints necessary to progress the system toward the target state.  
**PILOT-000: Freeze the Pilot Contract and Scenario** The objective of this foundational milestone is to define the exact, immutable technical scenario for the demonstration. This prevents scope creep and ensures all integration points align against a static target. No physical code repositories are modified. The implementation work consists of authoring a definitive Markdown document specifying the permitted action (e.g., executing a local file read operation against /etc/os-release) and the prohibited action (e.g., executing a network transmission targeting the internal Docker bridge at 172.17.0.1:9090 1). The model selected must be explicitly restricted to a 1.5B or 1.8B Int4 Qwen variant to respect the 4096 MiB VRAM boundary.1 The acceptance criteria demand a fully populated scenario document containing the exact JSON schemas the LLM will be prompted to output. This milestone constitutes challenge-specific presentation scaffolding. The blocking risk is the selection of a scenario too complex for a heavily quantized model to navigate reliably. No application code shall be written during this phase.  
**PILOT-001: Validate the Dell Host and Local Model Baseline** The objective is to prove the underlying hardware can support the designated inference workload. Given the 7.4 GiB total physical memory and the constraints of the GTX 1050 Ti 1, an out-of-memory error during generation represents an immediate pilot failure. The work involves the host operating system and the local Ollama deployment. Implementation requires installing the Ollama binary, downloading the quantized Qwen model, and executing a sustained 200-token generation sequence. Manual validation mandates monitoring nvidia-smi to ensure VRAM utilization remains below 3.8 GiB and utilizing the free \-m utility to verify system RAM does not drop below 200 MiB available.1 The acceptance criteria require the model to generate coherent output in less than ten seconds without inducing system swap-thrashing. If the model fails to load or execution exceeds acceptable latency thresholds, the failure path dictates an immediate reduction in model parameter count. This work represents critical test infrastructure.  
**PILOT-002: Validate OpenClaw Tool Execution Without InvarOS** The objective establishes the baseline functionality of the unprotected agent application. The system must prove capability execution organically before governance is introduced. The relevant repository is the OpenClaw deployment environment. Implementation involves configuring the agent with the two defined tools and deploying a lightweight Python Flask server bound explicitly to the docker0 interface 1 to serve as the mock receiver. The agent is then prompted via the command line to trigger both the permitted read and the prohibited egress. The acceptance criteria require verifiable proof that the local file contents are read into the agent context, and that the mock receiver logs the receipt of an HTTP POST payload. This validation infrastructure guarantees that subsequent denials are the result of InvarOS enforcement, rather than inherent application routing failures.  
**PILOT-003: Prove Pre-Execution Interception Viability** This milestone represents the earliest and most critical viability gate. The objective is to validate that the OpenClaw execution thread can be paused synchronously without collapsing the framework. The work occurs within the OpenClaw adapter directory. Implementation requires injecting a minimal script into the before\_tool\_call hook. This script must invoke a hardcoded two-second blocking sleep(), print an intercept string to standard output, and forcefully return a hardcoded denial structure. Manual validation observes the console output to ensure the intercept string appears, followed by the pause, followed by the agent gracefully absorbing the denial without crashing. The acceptance criteria demand that the mock receiver logs absolutely zero bytes during this operation. If the framework ignores the hook or faults, the rollback path initiates an immediate architectural pivot to the FastMCP proxy design. This mechanism constitutes a permanent platform capability, though the hardcoded logic will be discarded.  
**PILOT-004: Define the Stable Canonical Capability Request Schema** The objective is to standardize the data structures passed across the inter-process boundary. The C++ mathematical core mandates rigorous input predictability. The relevant repositories are the core schema definitions. Implementation work involves drafting rigorous JSON Schema definitions encompassing necessary fields such as the cryptographic request identifier, epoch timestamps, session identifiers, tool nominal designations, structured arguments, and actor identity strings. Acceptance requires the schema to pass structural validation tests and seamlessly support heavily nested capability arguments. This milestone produces a permanent platform capability. Development of the socket transport layer must be strictly deferred until the schema is finalized.  
**PILOT-005: Establish Synchronous Local IPC with invarosd** The objective connects the interception adapter to a structural prototype of the background daemon, validating communication latency and channel stability. The work spans the daemon repository and the OpenClaw adapter layer. Implementation requires deploying a Python Unix socket server inside invarosd bound to the verified tmpfs path /run/user/1000/invaros.sock.1 The client mechanism is instantiated within the OpenClaw adapter, strictly enforcing the 500-millisecond protocol timeout. Automated tests will execute a high-frequency sequence of 1,000 blank requests across the socket. The acceptance criteria require zero dropped connections and a consistently observed round-trip latency under 10 milliseconds. This establishes the permanent platform communication capability.  
**PILOT-006: Implement and Validate Fail-Closed Behavior** The objective mathematically proves the foundational security posture under severe failure conditions. A primary requirement of the pilot is the fail-closed mandate. Implementation requires executing a sequence of destructive actions: forcefully terminating the invarosd process, corrupting the Unix socket permissions via chmod 000, and modifying the daemon prototype to deliberately sleep for 600 milliseconds to trigger the timeout threshold. Under each condition, the agent will be prompted to execute a capability. The acceptance criteria require the interception adapter to catch the socket exceptions in all scenarios, swallow the framework errors, and yield a clean structural denial back to the OpenClaw agent. Evidence artifacts will consist of terminal logs verifying the exception traces resolving to blocked executions. This mechanism represents a permanent platform capability.  
**PILOT-007: Connect the Existing Python Layer and C++ Core** The objective integrates the actual deterministic mathematical evaluator into the daemon flow. The relevant repositories include the Python daemon layer and the core C++ engine. Implementation work involves loading the existing C++ shared object library utilizing Python ctypes within the invarosd memory space. The normalized JSON payload transmitted over the IPC channel must be structurally mapped to the C++ memory layout. The acceptance criteria require the daemon to pass arguments across the foreign function boundary and receive structural responses without triggering segmentation faults or observable memory leaks. The primary blocking risk is application binary interface mismatches resulting from differing compiler toolchains. This connection is a permanent platform capability.  
**PILOT-008: Replace Hardcoded Interception with Policy-Driven Decisions** The objective achieves true end-to-end governance. This fulfills the mandate for deterministic decisions evaluated against declared intent. Implementation requires the manual authoring of a static intent file that structurally permits the local file read operation while denying the network egress operation. This file is loaded into the C++ core during the daemon initialization sequence. The adapter's IPC request is subsequently routed entirely through the C++ mathematical evaluation engine. The acceptance criteria require the OpenClaw agent to attempt the local file read, receive an ALLOW decision from the C++ core, and successfully execute the action. Conversely, the network egress attempt must be deterministically denied by the C++ core, blocking execution. This fulfills the permanent platform capability requirement.  
**PILOT-009: Generate Cryptographic Refusal Evidence** The objective creates the verifiable receipt fundamental to the InvarOS transparency thesis. The work occurs within the core daemon. Implementation requires the Python daemon to intercept the DENY signal from the C++ core, hash the exact canonical capability request string using SHA-256, and generate an ES256 signature utilizing a securely stored local private key. This data is structured into a normalized JSON receipt. The acceptance criteria demand that the IPC response to the adapter contains a fully populated receipt object directly linking the cryptographic signature to the payload digest and the active intent policy identifier. This logic creates a permanent platform capability.  
**PILOT-010: Verify the Public Minimal Artifact Independently** The objective proves the cryptographically sound nature of the receipt to third-party observers. The relevant location is the tools directory. Implementation involves authoring a standalone Python script designed to ingest the public ECDSA key and the generated receipt JSON. The script must recalculate the SHA-256 payload hash from the visible arguments and strictly verify the mathematical validity of the ES256 signature. The acceptance criteria require the script to print VALID for authentic receipts and cleanly output INVALID if a single bit of the verified payload is deliberately altered. This utility serves as a reusable integration capability.  
**PILOT-011: Build a Deterministic Repeatable Test Harness** The objective stabilizes the demonstration and the continuous integration pipeline by decoupling the testing workflow from LLM latency constraints. The work creates a localized test infrastructure. Implementation involves building a shell injection script capable of passing exact, syntactically perfect JSON capability requests directly into the OpenClaw execution queue, bypassing the Ollama generation phase entirely. The acceptance criteria require the full execution of both the authorization and denial flows in under 2000 milliseconds, automatically verifying the state of the mock receiver. This component is essential test infrastructure.  
**PILOT-012: Establish the Minimum Discovery-to-Intent Workflow** The objective visually contextualizes the origin of the enforcement policy for the demonstration. Implementation involves finalizing the manually authored JSON representation of the permitted system baseline, ensuring it adheres visually to the broader InvarOS TBoM structures. The acceptance criteria demand a clean, readable policy file that can be displayed during the video capture. Building automated system-wide discovery daemons is explicitly prohibited during this milestone. This output is classified strictly as disposable challenge scaffolding.  
**PILOT-013: Collect Performance and Enforcement Measurements** The objective scientifically guarantees that all claims made during the video presentation are grounded in empirical hardware reality. Implementation utilizes the deterministic test harness (PILOT-011) to execute one hundred iterations of the enforcement loop. Metrics regarding IPC latency, C++ evaluation duration, and cryptographic generation time must be meticulously recorded. The acceptance criteria mandate the compilation of a performance ledger, proving that the overhead remains invisible to the user and that the invarosd resident set size operates well within the 6.1 GiB available system memory.1  
**PILOT-014: Prepare the Explorer or Terminal Evidence Views** The objective organizes the internal system state into an observable format suitable for public demonstration. The operational environment is the host terminal. Implementation involves configuring a robust tmux windowing session. The layout will feature four distinct panes: the agent interaction prompt, the live invarosd execution logs displaying cryptographic operations, the transaction logs of the mock receiver, and the output console for the validation script. The acceptance criteria require this layout to launch predictably from a single script. This is challenge-specific presentation scaffolding.  
**PILOT-015: Execute Rehearsal and Final Video Capture** The final objective records the immutable artifact required for the challenge submission. Implementation involves executing the documented workflow live on the hardware while capturing the screen and the synchronized audio narration. The acceptance criteria require a crisp, continuous two-minute video sequence proving the success of the authorized action, the pre-execution interception of the prohibited action, the fail-closed reliability, and the standalone cryptographic verification.

## **5\. Interface Specifications and Pseudocode**

The architectural stability of the pilot relies on the precise specification of the interfaces spanning the OpenClaw application environment and the secure InvarOS daemon boundary. The following implementation schemas and logic flows define the rigid operational mechanics.

### **5.1 OpenClaw Interception Adapter**

The interception layer operates deep within the asynchronous Python environment of the OpenClaw framework. It must execute rapid data canonicalization, manage synchronous socket operations without dropping the internal application state, and rigidly enforce the mathematical fail-closed timeout logic if the daemon fails to respond within the designated execution window.

Python  
import socket  
import json  
import time  
from typing import Dict, Any

\# Binds specifically to the ephemeral tmpfs mount mapped to the user  
SOCKET\_PATH \= "/run/user/1000/invaros.sock"  
\# Crucial enforcement window; guards against CPU scheduling starvation  
TIMEOUT\_MS \= 500

def before\_tool\_call(tool\_name: str, arguments: Dict\[str, Any\], session\_id: str) \-\> Dict\[str, Any\]:  
    """  
    Synchronous lifecycle hook invoked immediately prior to OS execution.  
    Thread suspension occurs upon socket connection.  
    """  
      
    \# 1\. Canonicalization: Imposes structural rigidity on the LLM output  
    request\_payload \= {  
        "schema\_version": "1.0",  
        "timestamp": int(time.time()),  
        "session\_id": session\_id,  
        "tool\_name": tool\_name,  
        "arguments": arguments, \# Deterministic dictionary sorting occurs within the C++ layer  
    }  
      
    \# 2\. IPC Request bridging to the secure daemon with Fail-Closed behavior  
    try:  
        client \= socket.socket(socket.AF\_UNIX, socket.SOCK\_STREAM)  
        client.settimeout(TIMEOUT\_MS / 1000.0)  
        client.connect(SOCKET\_PATH)  
          
        req\_bytes \= json.dumps(request\_payload).encode('utf-8')  
          
        \# Implementation of 4-byte big-endian length-prefixed framing   
        \# Prevents stream fragmentation errors over the local socket  
        client.sendall(len(req\_bytes).to\_bytes(4, byteorder='big') \+ req\_bytes)  
          
        \# 3\. Synchronous Read Response  
        length\_bytes \= client.recv(4)  
        if not length\_bytes:  
            raise ConnectionError("Daemon terminated connection unexpectedly.")  
              
        resp\_len \= int.from\_bytes(length\_bytes, byteorder='big')  
        resp\_bytes \= client.recv(resp\_len)  
        response \= json.loads(resp\_bytes.decode('utf-8'))  
          
        client.close()  
          
    except Exception as e:  
        \# FAIL-CLOSED POSTURE ENFORCEMENT  
        \# A mathematical absolute: if the policy cannot be queried, execution is lethal.  
        return {  
            "action": "DENY",  
            "reason\_code": "ERROR\_FAIL\_CLOSED",  
            "message": f"Governance daemon unreachable or threshold timeout exceeded: {str(e)}"  
        }

    \# 4\. Route Execution based on deterministic policy evaluation  
    if response.get("action") \== "ALLOW":  
        return {"action": "ALLOW"}  
    else:  
        return {  
            "action": "DENY",  
            "reason\_code": response.get("reason\_code", "DENY\_POLICY\_VIOLATION"),  
            "receipt": response.get("receipt")  
        }

### **5.2 Canonical Capability Request**

The data structure crossing the process boundary must be strongly typed to survive the transition into the C++ ABI without triggering memory faults. The schema emphasizes cryptographic identification and payload isolation.

JSON  
{  
  "$schema": "http://json-schema.org/draft-07/schema\#",  
  "title": "InvarOS Capability Request Core Schema",  
  "type": "object",  
  "required": \["schema\_version", "request\_id", "timestamp", "tool\_name", "arguments"\],  
  "properties": {  
    "schema\_version": {   
      "type": "string",   
      "const": "1.0",  
      "description": "Immutable schema definition version."  
    },  
    "request\_id": {   
      "type": "string",   
      "format": "uuid",  
      "description": "Unique cryptographic identifier preventing replay attacks."  
    },  
    "timestamp": {   
      "type": "integer",  
      "description": "Epoch timestamp of the interception event."  
    },  
    "session\_id": { "type": "string" },  
    "actor\_identity": { "type": "string" },  
    "tool\_name": {   
      "type": "string",  
      "description": "The exact binary or function nominal designation."  
    },  
    "arguments": {   
      "type": "object",  
      "description": "Unsorted parameter dictionary extracted from the LLM context."  
    },  
    "intent\_fingerprint": { "type": "string" }  
  }  
}

### **5.3 invarosd Decision Handler and Receipt Workflow**

The daemon must safely bridge the asynchronous Python I/O layer with the high-performance C++ evaluation context. When a capability request violates the mathematical intent boundary, the system must independently generate the ES256 signature to guarantee the non-repudiation of the enforcement action.

Python  
import hashlib  
import json  
import ecdsa \# Pure python implementation supporting the P-256 curve

def handle\_ipc\_request(payload: dict, cpp\_evaluator, private\_ecdsa\_key) \-\> dict:  
    """  
    Ingests the structured IPC payload, triggers the C++ validation core,  
    and structures the cryptographic refusal artifact.  
    """  
      
    \# Enforce strict alphabetical sorting of nested dictionaries to ensure  
    \# the JSON string representation is cryptographically deterministic.  
    normalized\_args \= json.dumps(payload\['arguments'\], sort\_keys=True, separators=(',', ':'))  
      
    \# Cross the memory boundary into the C++ structural context  
    decision \= cpp\_evaluator.evaluate\_intent(  
        payload\['tool\_name'\],   
        normalized\_args  
    )  
      
    if decision.is\_allowed:  
        return {  
            "action": "ALLOW",  
            "reason\_code": "INTENT\_MATCH\_VALIDATED",  
            "latency\_ms": decision.latency\_microseconds / 1000.0  
        }  
    else:  
        \# Initiate the Cryptographic Receipt Generation Sequence  
        \# The digest input strictly links the unique request, the tool, and the exact arguments  
        digest\_input \= f"{payload\['request\_id'\]}:{payload\['tool\_name'\]}:{normalized\_args}"  
          
        \# Generate the SHA-256 payload hash  
        payload\_hash \= hashlib.sha256(digest\_input.encode('utf-8')).digest()  
          
        \# Generate the mathematically verifiable ES256 signature   
        signature \= private\_ecdsa\_key.sign(payload\_hash, hashfunc=hashlib.sha256)  
          
        receipt\_artifact \= {  
            "request\_digest": payload\_hash.hex(),  
            "policy\_fingerprint": decision.policy\_hash,  
            "signature": signature.hex(),  
            "public\_minimal\_artifact": True  
        }  
          
        return {  
            "action": "DENY",  
            "reason\_code": decision.reason\_code,  
            "receipt": receipt\_artifact,  
            "latency\_ms": decision.latency\_microseconds / 1000.0  
        }

## **6\. Testing and Evidence Plan**

To isolate the underlying InvarOS stability from the variable latency inherent to generative large language models, the testing sequence is strictly bifurcated. Continuous integration relies heavily on the deterministic test harness, which directly inserts JSON requests into the adapter layer. End-to-end testing integrating Ollama operations is minimized to prevent thermal throttling on the host environment.1 Every test outcome must be verifiably logged.

| Test Identifier | Setup Context | Trigger Action | Expected Decision State | Expected Environmental Side Effect | Verifiable Evidence Collected | Automation Status |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **TST-01** | Daemon active, local static intent loaded. | Inject permitted read\_local\_file action targeting /etc/os-release. | ALLOW | Host file contents stream back into the application context safely. | IPC server logs recording the ALLOW structure and microsecond latency. | Integration (Harness) |
| **TST-02** | Daemon active, local static intent loaded. | Inject prohibited network\_request action targeting 172.17.0.1:9090.1 | DENY | No network transmission is executed by the host OS layer. | The captive mock receiver log remains utterly empty. Receipt JSON is written. | Integration (Harness) |
| **TST-03** | Daemon active. | Inject prohibited network\_request utilizing alternate string syntax or obfuscated IP. | DENY | No network transmission is executed by the host OS layer. | Receipt JSON generated featuring the newly computed argument digest. | Integration (Harness) |
| **TST-04** | invarosd process actively terminated via SIGKILL. | Agent attempts permitted read\_local\_file action. | ERROR\_FAIL\_CLOSED | The execution thread is forcefully blocked. | Adapter logs display the timeout exception trace and forced denial return. | End-to-End |
| **TST-05** | Intent policy file deliberately corrupted with malformed YAML. | Agent attempts permitted action. | ERROR\_FAIL\_CLOSED | The execution thread is forcefully blocked. | C++ core error logs indicating structural parser failure on load. | Integration (Harness) |
| **TST-06** | Valid receipt artifact extracted directly from TST-02 logs. | Execute standalone verify\_receipt.py passing the artifact path. | N/A | The validator algorithm mathematically confirms the signature origin. | Terminal console explicitly prints VALID. | Unit |
| **TST-07** | Signature hex sequence within TST-02 receipt deliberately altered by one character. | Execute standalone verify\_receipt.py passing the artifact path. | N/A | The validator algorithm mathematically rejects the modified signature. | Terminal console explicitly prints INVALID. | Unit |

## **7\. Measurement Plan**

The demonstration claims must be strictly bound to empirical measurements extracted directly from the Dell hardware profile. Data fabrication is absolutely prohibited. To ensure the baseline performance metrics remain honest, timing logic utilizing the Python time.perf\_counter() will bracket the critical execution paths during deterministic testing. The framework will measure IPC latency tracking the temporal delta between the socket connection initiation and payload deserialization, targeting a threshold beneath fifteen milliseconds. The internal evaluation time of the C++ logic must be traced using microsecond timers, targeting completion beneath five milliseconds.  
Cryptographic overhead represents a specific risk on the Intel CPU.1 The duration required for the ES256 signature generation will be isolated and logged, aiming for completion beneath ten milliseconds. Furthermore, passive OS telemetry will monitor the structural integrity of the environment. The resident set size (RSS) of the invarosd background process must be monitored via top to ensure memory consumption remains beneath 150 MiB, preserving the constrained 6.1 GiB available to the active model.1 Egress tracking relies on executing tcpdump \-i docker0 port 9090 continuously during prohibition tests to absolutely confirm that the mock receiver byte count remains at exactly zero during denial events.

## **8\. Reusability and Technical-Debt Ledger**

The core engineering principle of this pilot demands the maximization of permanent platform assets and the ruthless isolation of temporary demonstration logic. Every component created during this execution cycle is mapped according to its expected lifespan and accumulated technical debt.

| Implemented Artifact | Classification Category | Intended Repository Target | Future Platform Value | Technical Debt Analysis / Promotion Strategy |
| :---- | :---- | :---- | :---- | :---- |
| **OpenClaw Adapter Hook** | Reusable integration | invaros-openclaw-plugin | High. Acts as the primary pattern for integrating native application frameworks. | Minimal debt. Architected specifically for long-term production utilization. |
| **FastMCP Fallback Adapter** | Disposable logic | Uncommitted branch | Low. Only maintained if the native hook fundamentally fails. | Discard immediately if PILOT-003 confirms native hook viability. |
| **IPC Payload Schema** | Permanent platform | invaros-schemas | High. Standardizes the internal data ontology for all subsequent local daemon communications. | Zero debt. Designed to be version-controlled and immutable. |
| **invarosd Socket Endpoint** | Permanent platform | invaros-daemon | High. The structural foundation for all secure local governance workflows. | Future phases require TLS integration for multi-node deployments across unverified network boundaries. |
| **Cryptographic Receipt Generator** | Permanent platform | invaros-daemon | High. Instantiates the core intellectual property of verifiable denial. | Substantial hardware debt. Long-term strategy dictates migrating the ES256 generation into dedicated hardware security modules (TPMs). |
| **Receipt Validator Script** | Reusable integration | invaros-cli-tools | Medium. Functions as the developmental seed for automated third-party explorer auditing. | Migrate the raw verification logic into the compiled C++ core in later phases. |
| **Deterministic Test Harness** | Test infrastructure | invaros-testing | High. Becomes the core engine for the continuous integration and deployment pipeline. | Expand parameterization to natively cover diverse LLM application frameworks. |
| **Static Intent TBoM File** | Throwaway code | Local host filesystem | Zero. Serves exclusively to pass the immediate demonstration requirement. | Delete entirely post-submission. Replace immediately with the dynamic topology discovery engine in future phases. |
| **tmux Recording Scripts** | Challenge scaffolding | Challenge repo | Zero. Visual arrangement serves only the video capture aesthetic. | Discard entirely following successful video rendering. |

## **9\. Repository and File-Level Change Map**

The implementation logic requires strict segregation across the version control ecosystem to ensure the core InvarOS engine remains uncontaminated by pilot-specific configurations. The following mapping delineates the expected file-level modifications based strictly on the verified architecture.  
The existing invaros-daemon repository holds primary responsibility for the background enforcement engine. Expected additions include src/ipc\_server.py and src/receipt\_signer.py. Modifications will touch src/main.py to initiate the Unix socket loop and update src/config.yaml. The existing invaros-cpp-core repository is targeted for reuse. No structural additions are anticipated unless the binary interface fundamentally lacks evaluation bindings. Modifications must be strictly limited to ensuring C-compatible data exports to maintain stability against the Python ctypes bridge.  
A newly proposed repository, invaros-openclaw-adapter, will manage the agent integration. This repo will contain plugin.py encompassing the before\_tool\_call logic, and a schemas/ directory housing the JSON request definitions. A secondary proposed repository, invaros-validator, will contain the standalone verify.py script and the necessary Python requirement definitions.  
The physical host configuration on the yozi machine 1 requires specific modifications to sustain the background operation. The deployment necessitates authoring /etc/systemd/system/invarosd.service, rigidly configured to execute under the invaros user context. The creation of the socket endpoint inside the volatile /run/user/1000/ directory guarantees filesystem isolation. The existing network namespaces, routing tables, and the wlp3s0 wireless configuration must remain untouched.1

## **10\. Critical Path and Effort Estimate**

The minimum credible path to pilot execution prioritizes the absolute stabilization of the IPC and cryptographic boundaries, deliberately deferring generalized deployment scaffolding until post-submission phases. The recommended durable path runs linearly from hardware validation (PILOT-001) through interception confirmation (PILOT-003), schema definition (PILOT-004), and C++ integration (PILOT-007) before stabilizing the cryptographic evidence layer (PILOT-009).  
The effort allows for specific parallelization. Hardware validation and Ollama loading must occur first. Once the environment is stable, the definition of the IPC schema and the exploratory implementation of the OpenClaw interception hook can be engineered concurrently by distinct resources. However, the connection of the Python daemon to the C++ core cannot commence until the synchronous IPC loop passes the high-frequency stability tests defined in PILOT-005.  
The likely engineering effort ranges between eight and twelve engineering days. Designing the interception adapter and the IPC boundary represents three days of effort. Core integration, memory mapping, and cryptographic signing require four days of concentrated engineering. Hardening the fail-closed scenarios and testing loop requires three days, while preparing the demonstration environments and capturing the final video require two days.  
The largest structural uncertainty threatening the deadline is the timing constraint embedded within the OpenClaw plugin ecosystem. If the framework severely destabilizes during synchronous thread pauses, the mandatory rollback to the FastMCP architecture will cost approximately three engineering days, introducing acute deadline risk.

## **11\. Pilot Completion Checklist**

The pilot is considered successfully executed and ready for submission only when the following binary conditions are empirically met and proven within the recorded artifact.

* \[ \] The localized Qwen model is successfully loaded entirely within the 4096 MiB VRAM boundary without invoking system swap.  
* \[ \] The authorized local action (read\_local\_file) executes successfully, returning contextual data to the agent prompt.  
* \[ \] The prohibited state-changing action (network\_request) is definitively intercepted before any host operating system system call executes.  
* \[ \] The docker0 network interface records precisely zero transferred bytes during the execution of the prohibited request.  
* \[ \] The ALLOW and DENY governance decisions are demonstrably driven by the deterministic evaluation of the loaded static TBoM intent file.  
* \[ \] The arbitrary termination of the invarosd daemon forces the system into a mathematically secure fail-closed posture (ERROR\_FAIL\_CLOSED).  
* \[ \] The enforcement pipeline successfully generates a formatted JSON cryptographic refusal receipt linking the payload hash to the policy hash.  
* \[ \] The standalone validation script independently recalculates the payload hash and mathematically verifies the ES256 cryptographic signature.  
* \[ \] The complete end-to-end demonstration sequence resets to a clean operational state within five seconds.  
* \[ \] All public claims regarding system latency and memory consumption are supported by measured evidence extracted from the host telemetry.  
* \[ \] The two-minute video sequence is captured smoothly without requiring manual improvisation, terminal scrolling, or narrative adjustments.

## **12\. Deferred Work**

To prevent severe scope creep from compromising the pilot delivery window, several technically advantageous but strictly non-essential engineering tracks are aggressively deferred.  
The implementation of automated dynamic topology discovery is explicitly deferred. Generating system-wide behavioral graphs across the Ubuntu filesystem introduces profound systemic complexity entirely unnecessary for proving the base interception capability against a mocked target. A generalized universal C application binary interface rewrite is deferred. While standardizing the ABI for Rust and Go clients is a long-term commercial requirement, the existing Python ctypes bindings are sufficient to bridge the evaluation core for the pilot scope.  
The deployment of the architecture utilizing Kubernetes orchestration or isolated cloud environments is deferred. The pilot operates exclusively within the local context of the yozi host utilizing systemd structures 1, accurately reflecting the "AI for Real Impact" focus on secured endpoint operations. Furthermore, the integration of Hardware Security Modules (HSMs) or local Trusted Platform Modules (TPMs) for cryptographic key storage is deferred. For the purposes of the demonstration, file-based private keys secured by stringent filesystem permissions are acceptable.

## **13\. Final Recommendation**

The definitive execution of this architectural plan begins strictly with the deployment of PILOT-001, validating the operational threshold of the heavily constrained Dell hardware. This must be rapidly followed by PILOT-003, establishing the pre-execution interception viability. The entire trajectory of the project rests upon this initial go/no-go decision. If the OpenClaw execution pipeline natively supports synchronous thread suspension, the platform architecture proceeds to integrate the tightly coupled IPC adapter, bridging the application directly into the existing C++ mathematical core.  
The recommended permanent architecture relies on minimizing framework middleware and pushing the enforcement boundary as close to the initial LLM output evaluation as functionally possible. Challenge-specific scaffolding has been ruthlessly minimized, limited exclusively to terminal visualization configurations and a static intent baseline. Assuming the existing C++ native bindings remain stable during testing, the engineering duration will not exceed two calendar weeks. Systemic success is unequivocally defined by the generation of standalone cryptographic proof that the InvarOS platform deterministically blocked an unauthorized LLM execution attempt on constrained edge hardware, ensuring total network isolation without fracturing the host application state.

#### **Works cited**

1. OPENCLAW\_DEPLOYMENT\_CONFIG\_FULL.md
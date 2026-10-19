# What HomeXDR borrows from Wazuh, Velociraptor and Suricata

HomeXDR is a clean-room project. No code is copied from these projects (Wazuh and
Suricata are GPLv2, Velociraptor is AGPLv3); this document records the design ideas we
took from each and the ones we deliberately left behind.

## Wazuh (XDR + SIEM)

What it does well:

- **Agent / manager split with central config.** Agents are grouped, and each group gets a
  shared `agent.conf` pushed from the manager. Wazuh 5.0 moved agent traffic from its own
  AES protocol (1514/1515) to HTTPS on 1517, which validates plain HTTPS for agent comms.
- **Rule levels + compliance tags.** Every rule has a level (0-15) and tags mapping it to
  MITRE ATT&CK, PCI DSS, HIPAA, etc. Analysts filter by level, not by rule name.
- **Decoders for third-party logs.** Syslog from firewalls, routers and apps is parsed by
  decoders into named fields before rules run.
- **FIM (syscheck), SCA and inventory** as first-class agent modules, not plugins.
- **Active response.** Rules can trigger scripts on the agent (block IP, disable user).

What we do differently:

- Wazuh's process-level EDR view is thin: there is no process tree, and endpoint telemetry
  is mostly log-derived. HomeXDR collects process/network/file telemetry natively and builds
  process trees from `process.entity_id`.
- Wazuh rules are a bespoke XML format. HomeXDR uses **Sigma**, so the thousands of
  community rules in SigmaHQ work unchanged.
- Wazuh needs an OpenSearch cluster (JVM, multiple GB of RAM). HomeXDR uses ClickHouse,
  or SQLite in "lite" mode, so it fits on a homelab box next to everything else.

Taken: central agent config with versioning, rule severity + MITRE tags on every alert,
syslog decoders, FIM, inventory, response actions triggered by humans (and later by rules).

## Velociraptor (DFIR / hunting)

What it does well:

- **Artifacts.** Collection logic is packaged as named, parameterized YAML "artifacts"
  (VQL queries) with descriptions and per-platform variants. Analysts run artifacts, not raw
  commands.
- **Hunts.** One artifact, many hosts: a hunt targets a label set and gathers results
  centrally as the hosts check in, including hosts that are offline when it starts.
- **Flows have states and results**, and every collection is audited.
- **HTTP long-polling** client comms that work through proxies and NAT, with the server
  never needing to reach into the client network.
- **Labels** as the main way to group clients.
- 0.77 added interactive shell sessions; we treat remote shell as off-by-default and gated
  by local agent policy.

What we do differently:

- No general-purpose query language on the endpoint (VQL is powerful but a large attack
  surface and learning curve). HomeXDR ships a fixed catalog of built-in collectors with
  typed parameters; the catalog grows over time.
- Telemetry streaming is the default, not an add-on: Velociraptor's event monitoring is
  optional, HomeXDR's sensors always stream.

Taken: artifact catalog (name, description, params, platforms), hunts targeting labels,
command lifecycle states, long-poll transport, labels, audit log of every response action.

## Suricata (network IDS)

What it does well:

- **EVE JSON.** One flat JSON record per event with an `event_type` discriminator
  (`alert`, `flow`, `dns`, `http`, `tls`, `fileinfo`, `anomaly`). Easy to ship and to parse.
- **Community ID.** A standard hash of the flow 5-tuple (`1:base64(sha1(...))`) that
  Suricata, Zeek and others can emit, so records from different tools join on one key.
- **Rule metadata.** `sid`, `rev`, `classtype`, `metadata` give every alert a stable ID,
  version and category.
- OPNsense ships Suricata as its IDS/IPS, so homelab users often already run it.

What we do differently:

- HomeXDR does not do packet inspection. It ingests Suricata EVE and OPNsense `filterlog`
  over syslog and correlates them with endpoint telemetry.

Taken: Community ID computed on every endpoint network event (so a Suricata alert joins to
the process that opened the connection), EVE ingestion, stable rule IDs and revisions.

## The resulting design rules

1. Endpoint telemetry uses ECS-style field names; detections use Sigma field names, mapped
   server-side.
2. Every network event carries `network.community_id`.
3. Every process has a stable `process.entity_id`; parents are referenced by entity ID.
4. Agents only talk outbound over HTTPS with mutual TLS; the server never connects to them.
5. Response actions are signed by the server and checked against a **local agent policy**
   that the server cannot change, so a compromised server cannot get arbitrary code
   execution unless the agent owner allowed it.
6. One `docker compose up` brings up the whole backend.

## Sources

- Wazuh 5.0 architecture: https://documentation.wazuh.com/5.0-rc/getting-started/architecture.html
- Wazuh agent (5.0): https://documentation.wazuh.com/5.0-rc/getting-started/components/wazuh-agent.html
- Velociraptor 0.77 release notes: https://docs.velociraptor.app/blog/2026/2026-05-31-release-notes-0.77/
- Suricata EVE JSON output: https://docs.suricata.io/en/latest/output/eve/eve-json-output.html

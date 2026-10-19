package detect

import (
	"strings"
)

// Mitre is one ATT&CK mapping derived from a rule's tags.
type Mitre struct {
	Tactic      string `json:"tactic,omitempty"`
	TechniqueID string `json:"technique_id,omitempty"`
	Technique   string `json:"technique,omitempty"`
}

var tacticNames = map[string]string{
	"reconnaissance":       "Reconnaissance",
	"resource_development": "Resource Development",
	"initial_access":       "Initial Access",
	"execution":            "Execution",
	"persistence":          "Persistence",
	"privilege_escalation": "Privilege Escalation",
	"defense_evasion":      "Defense Evasion",
	"credential_access":    "Credential Access",
	"discovery":            "Discovery",
	"lateral_movement":     "Lateral Movement",
	"collection":           "Collection",
	"command_and_control":  "Command and Control",
	"exfiltration":         "Exfiltration",
	"impact":               "Impact",
}

// techniqueNames covers techniques used by the built-in rules; others show their ID only.
var techniqueNames = map[string]string{
	"T1003":     "OS Credential Dumping",
	"T1003.001": "LSASS Memory",
	"T1021":     "Remote Services",
	"T1021.004": "SSH",
	"T1027":     "Obfuscated Files or Information",
	"T1033":     "System Owner/User Discovery",
	"T1036":     "Masquerading",
	"T1046":     "Network Service Discovery",
	"T1053":     "Scheduled Task/Job",
	"T1053.003": "Cron",
	"T1053.005": "Scheduled Task",
	"T1059":     "Command and Scripting Interpreter",
	"T1059.001": "PowerShell",
	"T1059.003": "Windows Command Shell",
	"T1059.004": "Unix Shell",
	"T1070":     "Indicator Removal",
	"T1070.001": "Clear Windows Event Logs",
	"T1078":     "Valid Accounts",
	"T1082":     "System Information Discovery",
	"T1087":     "Account Discovery",
	"T1098":     "Account Manipulation",
	"T1098.004": "SSH Authorized Keys",
	"T1105":     "Ingress Tool Transfer",
	"T1110":     "Brute Force",
	"T1112":     "Modify Registry",
	"T1136":     "Create Account",
	"T1140":     "Deobfuscate/Decode Files or Information",
	"T1218":     "System Binary Proxy Execution",
	"T1218.011": "Rundll32",
	"T1490":     "Inhibit System Recovery",
	"T1543":     "Create or Modify System Process",
	"T1543.002": "Systemd Service",
	"T1543.003": "Windows Service",
	"T1547":     "Boot or Logon Autostart Execution",
	"T1547.001": "Registry Run Keys / Startup Folder",
	"T1548":     "Abuse Elevation Control Mechanism",
	"T1548.003": "Sudo and Sudo Caching",
	"T1562":     "Impair Defenses",
	"T1562.001": "Disable or Modify Tools",
	"T1562.004": "Disable or Modify System Firewall",
	"T1574":     "Hijack Execution Flow",
	"T1574.006": "Dynamic Linker Hijacking",
	"T1571":     "Non-Standard Port",
	"T1572":     "Protocol Tunneling",
	"T1595":     "Active Scanning",
}

// MitreFromTags converts Sigma tags ("attack.execution", "attack.t1059.001") to mappings.
// Tactics and techniques are listed in tag order.
func MitreFromTags(tags []string) []Mitre {
	out := []Mitre{}
	for _, t := range tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if !strings.HasPrefix(t, "attack.") {
			continue
		}
		v := strings.TrimPrefix(t, "attack.")
		if name, ok := tacticNames[strings.ReplaceAll(v, "-", "_")]; ok {
			out = append(out, Mitre{Tactic: name})
			continue
		}
		if len(v) > 1 && v[0] == 't' && v[1] >= '0' && v[1] <= '9' {
			id := strings.ToUpper(v)
			out = append(out, Mitre{TechniqueID: id, Technique: techniqueNames[id]})
		}
	}
	return out
}

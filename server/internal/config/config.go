// Package config loads server settings from HOMEXDR_* environment variables.
package config

import (
	"fmt"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config is the server configuration.
type Config struct {
	DataDir       string         // HOMEXDR_DATA_DIR
	HTTPAddr      string         // HOMEXDR_HTTP_ADDR: console + REST API
	AgentAddr     string         // HOMEXDR_AGENT_ADDR: agent API (TLS)
	SyslogAddr    string         // HOMEXDR_SYSLOG_ADDR: UDP+TCP syslog; "" disables
	SyslogAllow   []netip.Prefix // HOMEXDR_SYSLOG_ALLOW: comma list of CIDRs/IPs allowed to send syslog
	ServerNames   []string       // HOMEXDR_SERVER_NAMES: DNS names / IPs for the agent TLS cert
	AgentURL      string         // HOMEXDR_AGENT_URL: URL agents use to reach AgentAddr
	EventStore    string         // HOMEXDR_EVENT_STORE: sqlite | clickhouse
	ClickHouseDSN string         // HOMEXDR_CLICKHOUSE_DSN
	RetentionDays int            // HOMEXDR_RETENTION_DAYS
	RulesDir      string         // HOMEXDR_RULES_DIR: built-in Sigma rules
	DownloadsDir  string         // HOMEXDR_DOWNLOADS_DIR: agent binaries served to hosts
	WebDir        string         // HOMEXDR_WEB_DIR: serve the console from disk instead of the embedded copy
	SecureCookies bool           // HOMEXDR_SECURE_COOKIES: set when the console is behind HTTPS
	LogLevel      string         // HOMEXDR_LOG_LEVEL: debug | info | warn | error
}

// Load reads the environment and applies defaults.
func Load() (Config, error) {
	c := Config{
		DataDir:       env("HOMEXDR_DATA_DIR", "data"),
		HTTPAddr:      env("HOMEXDR_HTTP_ADDR", ":8080"),
		AgentAddr:     env("HOMEXDR_AGENT_ADDR", ":8443"),
		SyslogAddr:    env("HOMEXDR_SYSLOG_ADDR", ":5514"),
		EventStore:    strings.ToLower(env("HOMEXDR_EVENT_STORE", "sqlite")),
		ClickHouseDSN: env("HOMEXDR_CLICKHOUSE_DSN", "clickhouse://default:@localhost:9000/homexdr"),
		RulesDir:      env("HOMEXDR_RULES_DIR", firstExisting("rules", "../rules", "/usr/share/homexdr/rules")),
		DownloadsDir:  env("HOMEXDR_DOWNLOADS_DIR", firstExisting("downloads", "/usr/share/homexdr/downloads")),
		WebDir:        os.Getenv("HOMEXDR_WEB_DIR"),
		LogLevel:      env("HOMEXDR_LOG_LEVEL", "info"),
	}
	if v, ok := os.LookupEnv("HOMEXDR_SYSLOG_ADDR"); ok {
		c.SyslogAddr = v
	}

	days, err := strconv.Atoi(env("HOMEXDR_RETENTION_DAYS", "30"))
	if err != nil || days < 1 {
		return c, fmt.Errorf("HOMEXDR_RETENTION_DAYS must be a positive integer")
	}
	c.RetentionDays = days

	c.SecureCookies, _ = strconv.ParseBool(env("HOMEXDR_SECURE_COOKIES", "false"))

	for _, s := range strings.Split(os.Getenv("HOMEXDR_SYSLOG_ALLOW"), ",") {
		if s = strings.TrimSpace(s); s == "" {
			continue
		}
		p, err := netip.ParsePrefix(s)
		if err != nil {
			a, aerr := netip.ParseAddr(s)
			if aerr != nil {
				return c, fmt.Errorf("HOMEXDR_SYSLOG_ALLOW: %q is not an IP or CIDR", s)
			}
			p = netip.PrefixFrom(a, a.BitLen())
		}
		c.SyslogAllow = append(c.SyslogAllow, p.Masked())
	}

	for _, n := range strings.Split(os.Getenv("HOMEXDR_SERVER_NAMES"), ",") {
		if n = strings.TrimSpace(n); n != "" {
			c.ServerNames = append(c.ServerNames, n)
		}
	}
	if len(c.ServerNames) == 0 {
		if h, err := os.Hostname(); err == nil && h != "" {
			c.ServerNames = append(c.ServerNames, h)
		}
		c.ServerNames = append(c.ServerNames, "localhost", "127.0.0.1")
	}

	c.AgentURL = os.Getenv("HOMEXDR_AGENT_URL")
	if c.AgentURL == "" {
		_, port, err := net.SplitHostPort(c.AgentAddr)
		if err != nil || port == "" {
			port = "8443"
		}
		c.AgentURL = "https://" + net.JoinHostPort(c.ServerNames[0], port)
	}

	switch c.EventStore {
	case "sqlite", "clickhouse":
	default:
		return c, fmt.Errorf("HOMEXDR_EVENT_STORE must be sqlite or clickhouse, got %q", c.EventStore)
	}

	if c.DataDir, err = filepath.Abs(c.DataDir); err != nil {
		return c, err
	}
	return c, nil
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func firstExisting(paths ...string) string {
	for _, p := range paths {
		if st, err := os.Stat(p); err == nil && st.IsDir() {
			return p
		}
	}
	return paths[len(paths)-1]
}

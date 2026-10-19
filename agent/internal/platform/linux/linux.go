//go:build linux

// Package linux is the Linux platform.
package linux

import (
	"context"
	"os"
	"runtime"

	"github.com/Doodlebug12/homexdr/agent/internal/platform"
	"github.com/Doodlebug12/homexdr/shared/api"
	"github.com/Doodlebug12/homexdr/shared/event"
	"golang.org/x/sys/unix"
)

// Platform implements platform.Platform for Linux.
type Platform struct{}

// New returns the Linux platform.
func New() *Platform { return &Platform{} }

// Name returns "linux".
func (*Platform) Name() string { return event.PlatformLinux }

// Paths returns default locations.
func (*Platform) Paths() platform.Paths {
	return platform.Paths{
		ConfigFile:   "/etc/homexdr/agent.json",
		DataDir:      "/var/lib/homexdr",
		FIMDefaults:  []string{"/etc", "/usr/bin", "/usr/sbin", "/usr/local/bin", "/root/.ssh"},
		FileDefaults: []string{"/etc", "/tmp", "/var/tmp", "/dev/shm", "/home", "/root"},
	}
}

// HostInfo returns host details.
func (*Platform) HostInfo(context.Context) api.HostInfo {
	h, _ := os.Hostname()
	info := api.HostInfo{Hostname: h, OS: event.OS{Platform: event.PlatformLinux}, Arch: runtime.GOARCH, CPUs: runtime.NumCPU()}
	var u unix.Utsname
	if unix.Uname(&u) == nil {
		info.OS.Kernel = unix.ByteSliceToString(u.Release[:])
	}
	return info
}

// Sensors returns the Linux sensors.
func (*Platform) Sensors(api.SensorsConfig, platform.Env) []platform.Sensor { return nil }

// Responder returns the Linux responder.
func (*Platform) Responder(platform.Env) platform.Responder { return platform.UnsupportedResponder{} }

// Collectors returns the Linux artifact collectors.
func (*Platform) Collectors(platform.Env) map[string]platform.Collector {
	return map[string]platform.Collector{}
}

// Service returns the systemd integration.
func (*Platform) Service() platform.Service { return platform.UnsupportedService{} }

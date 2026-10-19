//go:build linux

package osplatform

import (
	"github.com/Doodlebug12/homexdr/agent/internal/platform"
	"github.com/Doodlebug12/homexdr/agent/internal/platform/linux"
)

// Current returns the platform this binary was built for.
func Current() platform.Platform { return linux.New() }

//go:build darwin

// Package osplatform selects the platform implementation for the build target.
package osplatform

import (
	"github.com/Doodlebug12/homexdr/agent/internal/platform"
	"github.com/Doodlebug12/homexdr/agent/internal/platform/darwin"
)

// Current returns the platform this binary was built for.
func Current() platform.Platform { return darwin.New() }

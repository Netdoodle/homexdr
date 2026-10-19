// Command homexdr-agent is the HomeXDR endpoint agent.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/Doodlebug12/homexdr/agent/internal/osplatform"
	"github.com/Doodlebug12/homexdr/shared/version"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "version" {
		fmt.Println("homexdr-agent", version.String())
		return
	}
	// Placeholder until the agent core lands: print host info.
	p := osplatform.Current()
	b, _ := json.MarshalIndent(p.HostInfo(context.Background()), "", "  ")
	fmt.Println(string(b))
}

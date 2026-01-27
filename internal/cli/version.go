package cli

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/supercorks/envpull/pkg/version"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Long:  `Print the version, commit, and build date of envpull.`,
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(version.String())
	},
}

package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type moduleCheck struct {
	dir    string
	module string
}

var checks = []moduleCheck{
	{dir: "./_cmd/binder", module: "github.com/wailsapp/wails/v3"},
	{dir: "./_cmd/lite", module: "github.com/wailsapp/wails/v3"},
}

func main() {

	hasError := false

	cliVersion, err := getCLIVersion()
	if err != nil {
		fmt.Fprintf(os.Stderr, "wails3 CLI: %v\n", err)
		hasError = true
	} else {
		fmt.Printf("wails3 CLI: %s\n", cliVersion)
	}

	fmt.Println()

	for _, c := range checks {
		modVersion, err := getModuleVersion(c.dir, c.module)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s (%s): %v\n", c.dir, c.module, err)
			hasError = true
			continue
		}
		match := ""
		if cliVersion != "" && modVersion != cliVersion {
			match = " ** MISMATCH **"
			hasError = true
		}
		fmt.Printf("%s: %s%s\n", c.dir, modVersion, match)
	}

	if hasError {
		fmt.Println()
		fmt.Println("version mismatch detected")
		os.Exit(1)
	}
}

func getCLIVersion() (string, error) {
	out, err := exec.Command("wails3", "version").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to run wails3 version: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func getModuleVersion(dir, module string) (string, error) {
	cmd := exec.Command("go", "list", "-m", module)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to run go list -m: %w", err)
	}
	// "github.com/wailsapp/wails/v3 v3.0.0-alpha.98" -> "v3.0.0-alpha.98"
	parts := strings.Fields(strings.TrimSpace(string(out)))
	if len(parts) < 2 {
		return "", fmt.Errorf("unexpected output: %s", string(out))
	}
	return parts[1], nil
}

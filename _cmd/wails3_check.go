package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type moduleCheck struct {
	name   string
	dir    string
	module string
}

var checks = []moduleCheck{
	{name: "Binder", dir: "./_cmd/binder", module: "github.com/wailsapp/wails/v3"},
	{name: "Binder Lite", dir: "./_cmd/lite", module: "github.com/wailsapp/wails/v3"},
}

const (
	wailsModule   = "github.com/wailsapp/wails/v3"
	variablesFile = "./.github/variables"
)

func main() {

	fmt.Println("=== Wails3 Module Check ===")
	fmt.Println()

	hasError := false
	var mismatches []string

	ciVersion, err := loadCIVersion()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%-14s %v\n", "CI Build:", err)
	} else {
		fmt.Printf("%-14s %s\n", "CI Build:", ciVersion)
	}

	cliVersion, err := getCLIVersion()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%-14s %v\n", "wails3 CLI:", err)
		hasError = true
	} else {
		fmt.Printf("%-14s %s\n", "wails3 CLI:", cliVersion)
	}

	if ciVersion != "" && cliVersion != "" && ciVersion != cliVersion {
		fmt.Println()
		fmt.Printf("  WARNING: CI Build version (%s) != local CLI (%s)\n", ciVersion, cliVersion)
		fmt.Printf("  To match CI:  go install %s/cmd/wails3@%s\n", wailsModule, ciVersion)
		fmt.Printf("  To update CI: edit %s\n", variablesFile)
		hasError = true
	}

	latestVersion, err := getLatestVersion(checks[0].dir, wailsModule)
	if err != nil {
		fmt.Fprintf(os.Stderr, "latest version: %v\n", err)
	} else {
		fmt.Printf("%-14s %s\n", "latest:", latestVersion)
		if ciVersion != "" && ciVersion != latestVersion {
			fmt.Println()
			fmt.Println("CI update:")
			fmt.Printf("  1. edit %s -> WAILS_VERSION=%s\n", variablesFile, latestVersion)
			fmt.Printf("  2. go install %s/cmd/wails3@%s\n", wailsModule, latestVersion)
		}
	}
	fmt.Println()

	baseVersion := ciVersion
	if baseVersion == "" {
		baseVersion = cliVersion
	}

	for _, c := range checks {
		modVersion, err := getModuleVersion(c.dir, c.module)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s (%s): %v\n", c.name, c.module, err)
			hasError = true
			continue
		}
		label := fmt.Sprintf("  %s:", c.name)
		if baseVersion != "" && modVersion != baseVersion {
			fmt.Printf("%-14s %s ** MISMATCH **\n", label, modVersion)
			mismatches = append(mismatches, fmt.Sprintf("  cd %s && go get -u %s@%s && cd ../..", c.dir, c.module, baseVersion))
			hasError = true
		} else {
			fmt.Printf("%-14s %s\n", label, modVersion)
		}
	}

	if len(mismatches) > 0 {
		fmt.Println()
		fmt.Println("Fix:")
		for _, m := range mismatches {
			fmt.Println(m)
		}
	}

	if hasError {
		fmt.Println()
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

func getLatestVersion(dir, module string) (string, error) {
	cmd := exec.Command("go", "list", "-m", "-versions", module)
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to run go list -m -versions: %w", err)
	}
	parts := strings.Fields(strings.TrimSpace(string(out)))
	if len(parts) < 2 {
		return "", fmt.Errorf("no versions found")
	}
	return parts[len(parts)-1], nil
}

func loadCIVersion() (string, error) {
	f, err := os.Open(variablesFile)
	if err != nil {
		return "", fmt.Errorf("cannot open %s: %w", variablesFile, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if ok && strings.TrimSpace(k) == "WAILS_VERSION" {
			return strings.TrimSpace(v), nil
		}
	}
	return "", fmt.Errorf("WAILS_VERSION not found in %s", variablesFile)
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

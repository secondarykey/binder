package main

import (
	"bufio"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	wailsModule      = "github.com/wailsapp/wails/v3"
	variablesRelPath = ".github/variables"
)

// 走査対象から除外するディレクトリ名。
// .claude はワークツリー（.claude/worktrees/）配下の go.mod を拾わないために必須。
var skipDirs = map[string]bool{
	".git":         true,
	".claude":      true,
	"node_modules": true,
	"vendor":       true,
	"testdata":     true,
	"dist":         true,
	"build":        true,
}

type moduleCheck struct {
	name string // 実行位置からの相対パス
	dir  string
}

func main() {

	fmt.Println("=== Wails3 Module Check ===")
	fmt.Println()

	hasError := false
	var mismatches []string

	checks, err := findModules(".", wailsModule)
	if err != nil {
		fmt.Fprintf(os.Stderr, "module scan: %v\n", err)
		os.Exit(1)
	}
	if len(checks) == 0 {
		fmt.Fprintf(os.Stderr, "no go.mod requiring %s found under current directory\n", wailsModule)
		os.Exit(1)
	}

	variablesFile, err := findVariablesFile()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%-14s %v\n", "CI Build:", err)
	}

	var ciVersion string
	if variablesFile != "" {
		ciVersion, err = loadCIVersion(variablesFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%-14s %v\n", "CI Build:", err)
		} else {
			fmt.Printf("%-14s %s\n", "CI Build:", ciVersion)
		}
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

	width := labelWidth(checks)
	for _, c := range checks {
		modVersion, err := getModuleVersion(c.dir, wailsModule)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s (%s): %v\n", c.name, wailsModule, err)
			hasError = true
			continue
		}
		label := fmt.Sprintf("  %s:", c.name)
		if baseVersion != "" && modVersion != baseVersion {
			fmt.Printf("%-*s %s ** MISMATCH **\n", width, label, modVersion)
			mismatches = append(mismatches, fmt.Sprintf("  go -C %s get %s@%s", c.dir, wailsModule, baseVersion))
			hasError = true
		} else {
			fmt.Printf("%-*s %s\n", width, label, modVersion)
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

// findModules は root 配下を走査し、module を直接 require している go.mod を集める。
func findModules(root, module string) ([]moduleCheck, error) {
	var mods []moduleCheck

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if path != root && skipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Name() != "go.mod" {
			return nil
		}

		ok, err := requiresModule(path, module)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}

		dir := filepath.Dir(path)
		mods = append(mods, moduleCheck{
			name: filepath.ToSlash(filepath.Clean(dir)),
			dir:  dir,
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return mods, nil
}

// requiresModule は go.mod が module を直接（非 indirect）require しているかを返す。
func requiresModule(goMod, module string) (bool, error) {
	f, err := os.Open(goMod)
	if err != nil {
		return false, fmt.Errorf("cannot open %s: %w", goMod, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "//") {
			continue
		}
		if strings.Contains(line, "// indirect") {
			continue
		}

		fields := strings.Fields(line)
		// "require mod ver"（単一行）と "mod ver"（require ブロック内）の両方を受ける
		if fields[0] == "require" {
			fields = fields[1:]
		}
		// replace / exclude 行はここで弾かれる
		if len(fields) >= 2 && fields[0] == module {
			return true, nil
		}
	}
	return false, scanner.Err()
}

// findVariablesFile は実行位置から上位へ .github/variables を探す。
func findVariablesFile() (string, error) {
	dir, err := filepath.Abs(".")
	if err != nil {
		return "", err
	}
	for {
		p := filepath.Join(dir, variablesRelPath)
		if _, err := os.Stat(p); err == nil {
			rel, err := filepath.Rel(mustAbs("."), p)
			if err != nil {
				return p, nil
			}
			return filepath.ToSlash(rel), nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("%s not found (searched upward from current directory)", variablesRelPath)
		}
		dir = parent
	}
}

func mustAbs(p string) string {
	abs, err := filepath.Abs(p)
	if err != nil {
		return p
	}
	return abs
}

func labelWidth(checks []moduleCheck) int {
	width := 14
	for _, c := range checks {
		// "  " + name + ":"
		if n := len(c.name) + 3; n > width {
			width = n
		}
	}
	return width
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

func loadCIVersion(variablesFile string) (string, error) {
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

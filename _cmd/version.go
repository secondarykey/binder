package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
)

const (
	configYml   = "./_cmd/binder/build/config.yml"
	configRg    = `version:\s*"([0-9]+\.[0-9]+\.[0-9]+)"`
	configFmt   = `  version: "%v"`
	packJsn     = "./_cmd/binder/frontend/package.json"
	packRg      = `"version":\s*"([0-9]+\.[0-9]+\.[0-9]+)"`
	packFmt     = `  "version": "%v",`
	winInfoJsn  = "./_cmd/binder/build/windows/info.json"
	winInfoRg1  = `"file_version":\s*"([0-9]+\.[0-9]+\.[0-9]+)"`
	winInfoRg2  = `"ProductVersion":\s*"([0-9]+\.[0-9]+\.[0-9]+)"`
	winInfoFmt1 = `        "file_version": "%v"`
	winInfoFmt2 = `            "ProductVersion": "%v",`
)

const inqury = `
Now Version: %s

  Enter   -> Patch Version
  1:Patch -> %s
  2:Minor -> %s
  3:Major -> %s 
  Other   -> Cancel

Please select the upgrade version(1-3)[1]:`

type ver struct {
	major int
	minor int
	patch int
}

func parseVer(v string) *ver {

	var rtn ver
	rtn.major = -1
	rtn.minor = -1
	rtn.patch = -1

	vals := strings.Split(v, ".")
	if len(vals) == 3 {
		rtn.major = parseInt(vals[0])
		rtn.minor = parseInt(vals[1])
		rtn.patch = parseInt(vals[2])
	}

	return &rtn
}

func parseInt(v string) int {
	val, err := strconv.Atoi(v)
	if err != nil {
		return -1
	}
	return val
}

func (v ver) addMajor() *ver {
	var rtn ver
	rtn.major = v.major + 1
	rtn.minor = 0
	rtn.patch = 0
	return &rtn
}

func (v ver) addMinor() *ver {
	var rtn ver
	rtn.major = v.major
	rtn.minor = v.minor + 1
	rtn.patch = 0
	return &rtn
}

func (v ver) addPatch() *ver {
	var rtn ver
	rtn.major = v.major
	rtn.minor = v.minor
	rtn.patch = v.patch + 1
	return &rtn
}

func (v ver) String() string {
	return fmt.Sprintf("%d.%d.%d", v.major, v.minor, v.patch)
}

func (v *ver) isError() bool {
	if v == nil {
		return true
	}
	if v.major == -1 {
		return true
	}
	return false
}

func main() {

	flag.Parse()
	name := ""
	args := flag.Args()
	if len(args) > 0 {
		name = args[0]
	}

	err := run(name)
	if err != nil {
		fmt.Fprintf(os.Stderr, "run() error: %+v", err)
		os.Exit(1)
	}

	fmt.Println("Success")
}

func run(v string) error {

	var rtn *ver
	if v == "" || v == "print" {
		now, err := parseVersion()
		if err != nil {
			return err
		}

		if v == "print" {
			fmt.Printf("Now Version: %v\n", now)
			return nil
		}
		rtn = inquryVersion(now)

	} else {
		rtn = parseVer(v)
	}

	if rtn.isError() {
		return fmt.Errorf("input version error")
	}

	fmt.Println("Version:", rtn)

	err := write(rtn)
	if err != nil {
		return err
	}

	return nil
}

func inquryVersion(now *ver) *ver {

	major := now.addMajor()
	minor := now.addMinor()
	patch := now.addPatch()

	fmt.Fprintf(os.Stdout, inqury,
		now.String(), patch.String(), minor.String(), major.String())

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Scan()

	str := scanner.Text()

	var rtn *ver
	if str == "" || str == "1" {
		rtn = patch
	} else if str == "2" {
		rtn = minor
	} else if str == "3" {
		rtn = major
	}
	return rtn
}

func parseVersion() (*ver, error) {

	re := regexp.MustCompile(configRg)

	fp, err := os.Open(configYml)
	if err != nil {
		return nil, err
	}
	defer fp.Close()

	scanner := bufio.NewScanner(fp)
	for scanner.Scan() {
		line := scanner.Text()
		match := re.FindStringSubmatch(line)
		if len(match) > 1 {
			v := parseVer(match[1])
			return v, nil
		}
	}

	return nil, nil
}

type op struct {
	input  string
	output string
	v      *ver
	xp     string
	format string
}

func write(v *ver) error {
	ops := []*op{
		&op{configYml, "", v, configRg, configFmt},
		&op{packJsn, "", v, packRg, packFmt},
		&op{winInfoJsn, "", v, winInfoRg1, winInfoFmt1},
		&op{winInfoJsn, "", v, winInfoRg2, winInfoFmt2},
	}

	for _, o := range ops {
		err := writeFile(o)
		if err != nil {
			return err
		}
	}

	for _, o := range ops {
		//os.Rename(o.output, o.input)
		fmt.Println("Rename:", o.input)
	}

	return nil
}

func writeFile(o *op) error {

	re := regexp.MustCompile(o.xp)

	in, err := os.Open(o.input)
	if err != nil {
		return err
	}
	defer in.Close()

	output := o.input + "_tmp"
	o.output = output

	fmt.Println("Write temp:", output)

	out, err := os.Create(output)
	if err != nil {
		return err
	}
	defer out.Close()

	scanner := bufio.NewScanner(in)

	for scanner.Scan() {

		line := scanner.Text()

		match := re.FindStringSubmatch(line)
		if len(match) > 1 {
			line = fmt.Sprintf(o.format, o.v)
		}
		fmt.Fprintln(out, line)
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	return nil
}

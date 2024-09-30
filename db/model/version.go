package model

import (
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/xerrors"
)

type Version struct {
	major int
	minor int
	patch int
	pr    string
	build string
	value string
}

func NewVersion(buf string) (*Version, error) {
	var v Version
	err := v.parse(buf)
	if err != nil {
		return nil, xerrors.Errorf("version parse() error: %w", err)
	}
	return &v, nil
}

func (v *Version) CompareCore(ver *Version) int {

	if v.major < ver.major {
		return -1
	} else if v.major > ver.major {
		return 1
	}

	if v.minor < ver.minor {
		return -1
	} else if v.minor > ver.minor {
		return 1
	}

	if v.patch < ver.patch {
		return -1
	} else if v.patch > ver.patch {
		return 1
	}
	return 0
}

func (v *Version) Lt(ver *Version) bool {
	return v.compare(ver) < 0
}

func (v *Version) Le(ver *Version) bool {
	return v.compare(ver) <= 0
}

func (v *Version) Gt(ver *Version) bool {
	return v.compare(ver) > 0
}

func (v *Version) Ge(ver *Version) bool {
	return v.compare(ver) >= 0
}

func (v *Version) Eq(ver *Version) bool {
	return v.compare(ver) == 0
}

func (v *Version) compare(ver *Version) int {

	rtn := v.CompareCore(ver)
	if rtn != 0 {
		return rtn
	}

	if v.pr == "" && ver.pr != "" {
		//空の場合は大きい
		return 1
	} else if v.pr != "" && ver.pr == "" {
		return -1
	} else if v.pr < ver.pr {
		return -1
	} else if v.pr > ver.pr {
		return 1
	}

	if v.build == ver.build {
		return 0
	}

	if v.build == "" && ver.build != "" {
		//ビルドはない方が小さい？
		return -1
	} else if v.build != "" && ver.build == "" {
		return 1
	} else if v.build < ver.build {
		return -1
	} else if v.build > ver.build {
		return 1
	}

	//到達しない
	return 0
}

func (v *Version) IsMajor(val int) bool {
	if v.major == val {
		return true
	}
	return false
}

func (v *Version) IsMinor(mj, mn int) bool {
	if v.major == mj && v.minor == mn {
		return true
	}
	return false
}

func (v *Version) IsCore(mj, mn, p int) bool {
	if v.major == mj && v.minor == mn && v.patch == p {
		return true
	}
	return false
}

func (v *Version) IsPR(val string) bool {
	if v.pr == val {
		return true
	}
	return false
}

func (v *Version) IsBuild(val string) bool {
	if v.build == val {
		return true
	}
	return false
}

func (v Version) String() string {
	return fmt.Sprintf("%d.%d.%d", v.major, v.minor, v.patch)
}

func (v Version) GoString() string {
	if v.value == "" {
		return v.String()
	}
	return v.value
}

func (v *Version) parse(val string) error {

	v.value = val

	remain := val
	pidx := strings.Index(remain, "+")

	if pidx != -1 {

		build := remain[pidx+1:]
		remain = remain[:pidx]

		err := v.parseBuild(build)
		if err != nil {
			return xerrors.Errorf("v.parsePR() error: %w", err)
		}
	}

	midx := strings.Index(remain, "-")

	if midx != -1 {
		pre := remain[midx+1:]
		remain = remain[:midx]

		err := v.parsePR(pre)
		if err != nil {
			return xerrors.Errorf("v.parsePR() error: %w", err)
		}
	}

	err := v.parseCore(remain)
	if err != nil {
		return xerrors.Errorf("v.parseCore() error: %w", err)
	}

	return nil
}

func (v *Version) parsePR(val string) error {
	idx := strings.Index(val, "+")
	if idx != -1 {
		v.pr = val[:idx]
		build := val[idx+1:]
		err := v.parseBuild(build)
		if err != nil {
			return xerrors.Errorf("parseBuild() error: %w", err)
		}
	} else {
		v.pr = val
	}
	return nil
}

func (v *Version) parseBuild(val string) error {
	v.build = val
	return nil
}

func (v *Version) parseCore(val string) error {

	vals := strings.Split(val, ".")
	if len(vals) != 3 {
		return fmt.Errorf("semantic versioning core is x.x.x(%s)", val)
	}

	major := vals[0]
	minor := vals[1]
	patch := vals[2]

	var err error
	v.major, err = strconv.Atoi(major)
	if err != nil {
		return xerrors.Errorf("Major version not numeric: %s", major)
	}
	v.minor, err = strconv.Atoi(minor)
	if err != nil {
		return xerrors.Errorf("Minor version not numeric: %s", minor)
	}
	v.patch, err = strconv.Atoi(patch)
	if err != nil {
		return xerrors.Errorf("Patch version not numeric: %s", patch)
	}

	return nil
}

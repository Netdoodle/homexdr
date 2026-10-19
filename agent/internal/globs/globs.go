// Package globs matches file paths against exclude patterns used by the FIM and file
// sensors.
//
// Rules:
//   - A pattern without a path separator matches the base name ("*.swp", "*.tmp").
//   - A pattern with a separator matches the full path. "**" matches any number of
//     path segments ("/home/**/.cache").
//   - A path is also excluded when one of its parent directories matches, so
//     "/var/lib/homexdr" or "/proc" exclude everything below them.
//   - Matching is case-insensitive on Windows.
package globs

import (
	"path"
	"path/filepath"
	"runtime"
	"strings"
)

// Set is a compiled list of patterns. The zero value matches nothing.
type Set struct {
	full [][]string // segment lists for full-path patterns
	base []string   // base-name patterns
}

var foldCase = runtime.GOOS == "windows"

func norm(p string) string {
	p = filepath.ToSlash(p)
	if foldCase {
		p = strings.ToLower(p)
	}
	return p
}

// New compiles patterns. Empty patterns are ignored.
func New(patterns ...string) *Set {
	s := &Set{}
	for _, p := range patterns {
		s.Add(p)
	}
	return s
}

// Add adds one pattern.
func (s *Set) Add(p string) {
	p = strings.TrimSpace(p)
	if p == "" {
		return
	}
	p = norm(p)
	if !strings.Contains(p, "/") {
		s.base = append(s.base, p)
		return
	}
	p = strings.TrimSuffix(p, "/")
	if p == "" {
		p = "/"
	}
	s.full = append(s.full, strings.Split(p, "/"))
}

// Empty reports whether the set has no patterns.
func (s *Set) Empty() bool { return s == nil || (len(s.full) == 0 && len(s.base) == 0) }

// Match reports whether p (an absolute path) is excluded.
func (s *Set) Match(p string) bool {
	if s.Empty() {
		return false
	}
	p = norm(p)
	if len(s.base) > 0 {
		b := path.Base(p)
		for _, pat := range s.base {
			if ok, _ := path.Match(pat, b); ok {
				return true
			}
		}
	}
	if len(s.full) == 0 {
		return false
	}
	segs := strings.Split(strings.TrimSuffix(p, "/"), "/")
	for _, pat := range s.full {
		// Match the path itself or any ancestor directory.
		for n := len(segs); n >= 1; n-- {
			if matchSegs(pat, segs[:n]) {
				return true
			}
		}
	}
	return false
}

func matchSegs(pat, segs []string) bool {
	for len(pat) > 0 {
		if pat[0] == "**" {
			rest := pat[1:]
			for i := 0; i <= len(segs); i++ {
				if matchSegs(rest, segs[i:]) {
					return true
				}
			}
			return false
		}
		if len(segs) == 0 {
			return false
		}
		if ok, _ := path.Match(pat[0], segs[0]); !ok {
			return false
		}
		pat, segs = pat[1:], segs[1:]
	}
	return len(segs) == 0
}

// Under reports whether p is root or inside root (both cleaned, absolute).
func Under(p, root string) bool {
	p, root = norm(filepath.Clean(p)), norm(filepath.Clean(root))
	if p == root {
		return true
	}
	if !strings.HasSuffix(root, "/") {
		root += "/"
	}
	return strings.HasPrefix(p, root)
}

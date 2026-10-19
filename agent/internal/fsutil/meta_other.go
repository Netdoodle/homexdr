//go:build !unix

package fsutil

import (
	"os"
	"strconv"
)

// StatMeta returns no owner or inode information on this platform.
func StatMeta(os.FileInfo) Meta { return Meta{} }

// UserName returns the numeric ID; there are no Unix UIDs on this platform.
func UserName(uid uint32) string { return strconv.FormatUint(uint64(uid), 10) }

// GroupName returns the numeric ID; there are no Unix GIDs on this platform.
func GroupName(gid uint32) string { return strconv.FormatUint(uint64(gid), 10) }

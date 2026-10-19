//go:build unix

package fsutil

import (
	"os"
	"os/user"
	"strconv"
	"sync"
	"syscall"
	"time"
)

// StatMeta extracts owner, inode and ctime from a FileInfo returned by os.Stat/Lstat.
func StatMeta(fi os.FileInfo) Meta {
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return Meta{}
	}
	return Meta{
		UID: st.Uid, GID: st.Gid, HasOwner: true,
		Dev: uint64(st.Dev), Inode: uint64(st.Ino), Nlink: uint64(st.Nlink),
		CTime: statCtime(st),
	}
}

func statCtime(st *syscall.Stat_t) time.Time {
	sec, nsec := ctimeParts(st)
	return time.Unix(sec, nsec)
}

var (
	nameMu    sync.Mutex
	userNames = map[uint32]string{}
	grpNames  = map[uint32]string{}
)

// UserName resolves a UID to a name (cached). It returns the numeric ID if unknown.
func UserName(uid uint32) string {
	nameMu.Lock()
	defer nameMu.Unlock()
	if n, ok := userNames[uid]; ok {
		return n
	}
	n := strconv.FormatUint(uint64(uid), 10)
	if u, err := user.LookupId(n); err == nil {
		n = u.Username
	}
	userNames[uid] = n
	return n
}

// GroupName resolves a GID to a name (cached). It returns the numeric ID if unknown.
func GroupName(gid uint32) string {
	nameMu.Lock()
	defer nameMu.Unlock()
	if n, ok := grpNames[gid]; ok {
		return n
	}
	n := strconv.FormatUint(uint64(gid), 10)
	if g, err := user.LookupGroupId(n); err == nil {
		n = g.Name
	}
	grpNames[gid] = n
	return n
}

//go:build linux

package fsutil

import "syscall"

func ctimeParts(st *syscall.Stat_t) (int64, int64) {
	return int64(st.Ctim.Sec), int64(st.Ctim.Nsec)
}

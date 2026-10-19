//go:build unix && !linux

package fsutil

import "syscall"

func ctimeParts(st *syscall.Stat_t) (int64, int64) {
	return int64(st.Ctimespec.Sec), int64(st.Ctimespec.Nsec)
}

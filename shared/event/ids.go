package event

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/binary"
	"strconv"
	"sync"
	"time"
)

var idEncoding = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding)

var (
	idMu   sync.Mutex
	idLast uint64
)

// NewID returns a 26-character, lowercase, time-ordered unique ID (48-bit millisecond
// timestamp followed by 80 random bits, Crockford base32). IDs generated in the same
// process are strictly increasing.
func NewID() string {
	var b [16]byte
	ms := uint64(time.Now().UnixMilli())
	idMu.Lock()
	if ms <= idLast {
		ms = idLast + 1
	}
	idLast = ms
	idMu.Unlock()
	b[0] = byte(ms >> 40)
	b[1] = byte(ms >> 32)
	b[2] = byte(ms >> 24)
	b[3] = byte(ms >> 16)
	b[4] = byte(ms >> 8)
	b[5] = byte(ms)
	if _, err := rand.Read(b[6:]); err != nil {
		panic("event: crypto/rand failed: " + err.Error())
	}
	return idEncoding.EncodeToString(b[:])
}

// ProcessEntityID returns the stable identifier for a process.
//
// startKey must be a value that every sensor on the platform can read for the same
// process, so that events from different sensors join on one entity ID:
//
//   - Linux: process start time in clock ticks since boot, i.e. field 22 of
//     /proc/[pid]/stat (eBPF sensors compute task->start_boottime / (1e9 / USER_HZ)).
//   - Windows: process creation time as a FILETIME (100 ns intervals since 1601).
//   - macOS: process start time in microseconds since the Unix epoch (kinfo_proc p_starttime).
//
// The result is 22 characters of base32 derived from SHA-256(agentID|pid|startKey).
func ProcessEntityID(agentID string, pid int64, startKey uint64) string {
	h := sha256.New()
	h.Write([]byte(agentID))
	h.Write([]byte{'|'})
	h.Write(strconv.AppendInt(nil, pid, 10))
	h.Write([]byte{'|'})
	var k [8]byte
	binary.BigEndian.PutUint64(k[:], startKey)
	h.Write(k[:])
	sum := h.Sum(nil)
	return idEncoding.EncodeToString(sum[:14])[:22]
}

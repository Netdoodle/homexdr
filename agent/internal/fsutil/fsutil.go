// Package fsutil holds small file helpers shared by the agent: atomic writes, file
// metadata that differs per OS (owner, inode, ctime) and hashing.
package fsutil

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// WriteFileAtomic writes data to a temporary file next to path, syncs it and renames it
// over path, so readers never see a partial file.
func WriteFileAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp*")
	if err != nil {
		return err
	}
	tmp := f.Name()
	ok := false
	defer func() {
		if !ok {
			f.Close()
			os.Remove(tmp)
		}
	}()
	if _, err := f.Write(data); err != nil {
		return err
	}
	if err := f.Sync(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp, perm); err != nil {
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		return err
	}
	ok = true
	return nil
}

// WriteJSONAtomic marshals v (indented) and writes it atomically.
func WriteJSONAtomic(path string, v any, perm os.FileMode) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return WriteFileAtomic(path, append(b, '\n'), perm)
}

// ReadJSON decodes a JSON file into v.
func ReadJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

// Meta is OS-specific file metadata. Fields a platform cannot provide are zero.
type Meta struct {
	UID, GID uint32
	HasOwner bool
	Dev      uint64
	Inode    uint64
	CTime    time.Time
	Nlink    uint64
}

// Hashes holds lowercase hex digests.
type Hashes struct {
	MD5, SHA1, SHA256 string
	Size              int64
}

// HashReader computes MD5, SHA-1 and SHA-256 of r in one pass.
func HashReader(r io.Reader) (Hashes, error) {
	m, s1, s256 := md5.New(), sha1.New(), sha256.New()
	n, err := io.Copy(io.MultiWriter(m, s1, s256), r)
	if err != nil {
		return Hashes{}, err
	}
	return Hashes{
		MD5:    hex.EncodeToString(m.Sum(nil)),
		SHA1:   hex.EncodeToString(s1.Sum(nil)),
		SHA256: hex.EncodeToString(s256.Sum(nil)),
		Size:   n,
	}, nil
}

// SHA256File returns the SHA-256 of a file, refusing files larger than max (max <= 0
// means no limit).
func SHA256File(path string, max int64) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	return SHA256Open(f, max)
}

// SHA256Open hashes an open file, refusing files larger than max (max <= 0: no limit).
func SHA256Open(f *os.File, max int64) (string, error) {
	if max > 0 {
		if st, err := f.Stat(); err == nil && st.Size() > max {
			return "", fmt.Errorf("file larger than %d bytes", max)
		}
	}
	h := sha256.New()
	var r io.Reader = f
	if max > 0 {
		r = io.LimitReader(f, max+1)
	}
	n, err := io.Copy(h, r)
	if err != nil {
		return "", err
	}
	if max > 0 && n > max {
		return "", fmt.Errorf("file larger than %d bytes", max)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// ModeString formats permission bits as an octal string, e.g. "0755".
func ModeString(m os.FileMode) string {
	p := uint32(m.Perm())
	if m&os.ModeSetuid != 0 {
		p |= 0o4000
	}
	if m&os.ModeSetgid != 0 {
		p |= 0o2000
	}
	if m&os.ModeSticky != 0 {
		p |= 0o1000
	}
	s := strconv.FormatUint(uint64(p), 8)
	for len(s) < 4 {
		s = "0" + s
	}
	return s
}

// FileType returns "file", "dir", "symlink" or "other".
func FileType(m os.FileMode) string {
	switch {
	case m.IsRegular():
		return "file"
	case m.IsDir():
		return "dir"
	case m&os.ModeSymlink != 0:
		return "symlink"
	}
	return "other"
}

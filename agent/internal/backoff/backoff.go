// Package backoff implements jittered exponential backoff (1s doubling up to 5 minutes by
// default), used by every agent loop that talks to the server or restarts a sensor.
package backoff

import (
	"context"
	"math/rand/v2"
	"time"
)

// Defaults from docs/protocol.md.
const (
	DefaultMin = time.Second
	DefaultMax = 5 * time.Minute
)

// Backoff tracks consecutive failures. The zero value uses the defaults. It is not safe
// for concurrent use; each loop owns its own Backoff.
type Backoff struct {
	Min, Max time.Duration
	n        int
}

// Next returns the delay before the next attempt and counts a failure. The delay is
// drawn uniformly from [d/2, d], where d doubles with every failure up to Max.
func (b *Backoff) Next() time.Duration {
	lo, hi := b.Min, b.Max
	if lo <= 0 {
		lo = DefaultMin
	}
	if hi <= 0 {
		hi = DefaultMax
	}
	d := lo
	for i := 0; i < b.n && d < hi; i++ {
		d *= 2
	}
	if d > hi {
		d = hi
	}
	b.n++
	half := d / 2
	return half + time.Duration(rand.Int64N(int64(half)+1))
}

// Reset clears the failure count after a success.
func (b *Backoff) Reset() { b.n = 0 }

// Failures returns the number of consecutive failures.
func (b *Backoff) Failures() int { return b.n }

// Sleep waits for the next backoff delay or until ctx is done. It returns false if ctx
// ended first.
func (b *Backoff) Sleep(ctx context.Context) bool {
	return SleepCtx(ctx, b.Next())
}

// SleepCtx waits for d or until ctx is done, and reports whether the full wait elapsed.
func SleepCtx(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

package event

import "testing"

func TestNewIDOrderedAndUnique(t *testing.T) {
	seen := make(map[string]bool)
	prev := ""
	for i := 0; i < 10000; i++ {
		id := NewID()
		if len(id) != 26 {
			t.Fatalf("len(%q) = %d, want 26", id, len(id))
		}
		if seen[id] {
			t.Fatalf("duplicate id %q", id)
		}
		seen[id] = true
		if id <= prev {
			t.Fatalf("id %q not greater than previous %q", id, prev)
		}
		prev = id
	}
}

func TestProcessEntityIDStable(t *testing.T) {
	a := ProcessEntityID("agent-1", 1234, 99887766)
	b := ProcessEntityID("agent-1", 1234, 99887766)
	if a != b {
		t.Fatalf("not stable: %q vs %q", a, b)
	}
	if len(a) != 22 {
		t.Fatalf("len = %d, want 22", len(a))
	}
	if a == ProcessEntityID("agent-2", 1234, 99887766) {
		t.Fatal("different agents produced the same entity id")
	}
	if a == ProcessEntityID("agent-1", 1234, 99887767) {
		t.Fatal("different start keys produced the same entity id")
	}
}

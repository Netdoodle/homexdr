package communityid

import (
	"net/netip"
	"testing"
)

func TestComputeSpecExample(t *testing.T) {
	// Example from the Community ID specification README.
	src := netip.MustParseAddr("128.232.110.120")
	dst := netip.MustParseAddr("66.35.250.204")
	const want = "1:LQU9qZlK+B5F3KDmev6m5PMibrg="
	if got := Compute(src, dst, ProtoTCP, 34855, 80); got != want {
		t.Fatalf("Compute = %q, want %q", got, want)
	}
	// Direction must not matter.
	if got := Compute(dst, src, ProtoTCP, 80, 34855); got != want {
		t.Fatalf("reversed Compute = %q, want %q", got, want)
	}
}

func TestComputeStrings(t *testing.T) {
	got := ComputeStrings("128.232.110.120", "66.35.250.204", "tcp", 34855, 80)
	if got != "1:LQU9qZlK+B5F3KDmev6m5PMibrg=" {
		t.Fatalf("ComputeStrings = %q", got)
	}
	if ComputeStrings("not-an-ip", "66.35.250.204", "tcp", 1, 2) != "" {
		t.Fatal("expected empty result for invalid address")
	}
	if ComputeStrings("10.0.0.1", "::1", "tcp", 1, 2) != "" {
		t.Fatal("expected empty result for mixed address families")
	}
}

func TestICMPEchoSymmetric(t *testing.T) {
	a := netip.MustParseAddr("192.168.1.10")
	b := netip.MustParseAddr("8.8.8.8")
	req := Compute(a, b, ProtoICMP, 8, 0)
	rep := Compute(b, a, ProtoICMP, 0, 0)
	if req == "" || req != rep {
		t.Fatalf("echo request %q and reply %q should match", req, rep)
	}
}

func TestMappedIPv4(t *testing.T) {
	v4 := Compute(netip.MustParseAddr("10.0.0.1"), netip.MustParseAddr("10.0.0.2"), ProtoUDP, 5353, 53)
	mapped := Compute(netip.MustParseAddr("::ffff:10.0.0.1"), netip.MustParseAddr("::ffff:10.0.0.2"), ProtoUDP, 5353, 53)
	if v4 != mapped {
		t.Fatalf("IPv4-mapped addresses should hash like IPv4: %q vs %q", v4, mapped)
	}
}

// Package communityid implements Community ID flow hashing, version 1
// (https://github.com/corelight/community-id-spec). Suricata, Zeek and HomeXDR agents
// emit the same value for the same flow, which lets the server join endpoint network
// events to IDS and firewall records.
package communityid

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"net/netip"
)

// IANA protocol numbers.
const (
	ProtoICMP   uint8 = 1
	ProtoTCP    uint8 = 6
	ProtoUDP    uint8 = 17
	ProtoICMPv6 uint8 = 58
	ProtoSCTP   uint8 = 132
)

// ProtoFromName maps a transport name ("tcp", "udp", "icmp", "ipv6-icmp", "icmpv6",
// "sctp") to its IANA number. It returns false for unknown names.
func ProtoFromName(name string) (uint8, bool) {
	switch name {
	case "tcp", "TCP":
		return ProtoTCP, true
	case "udp", "UDP":
		return ProtoUDP, true
	case "icmp", "ICMP":
		return ProtoICMP, true
	case "ipv6-icmp", "icmpv6", "ICMPv6", "IPV6-ICMP":
		return ProtoICMPv6, true
	case "sctp", "SCTP":
		return ProtoSCTP, true
	}
	return 0, false
}

// Compute returns the version 1 Community ID ("1:<base64>") for a flow with seed 0.
// For ICMP and ICMPv6, pass the ICMP type as srcPort and the code as dstPort.
// It returns "" if either address is invalid or the address families differ.
func Compute(src, dst netip.Addr, proto uint8, srcPort, dstPort uint16) string {
	return ComputeSeed(0, src, dst, proto, srcPort, dstPort)
}

// ComputeSeed is Compute with an explicit seed. All tools in a deployment must use the
// same seed for values to match.
func ComputeSeed(seed uint16, src, dst netip.Addr, proto uint8, srcPort, dstPort uint16) string {
	if !src.IsValid() || !dst.IsValid() {
		return ""
	}
	src, dst = src.Unmap(), dst.Unmap()
	if src.Is4() != dst.Is4() {
		return ""
	}

	oneWay := false
	switch proto {
	case ProtoICMP:
		srcPort, dstPort, oneWay = icmp4Equivalent(srcPort, dstPort)
	case ProtoICMPv6:
		srcPort, dstPort, oneWay = icmp6Equivalent(srcPort, dstPort)
	}

	sb, db := src.AsSlice(), dst.AsSlice()
	if !oneWay && !ordered(sb, db, srcPort, dstPort) {
		sb, db = db, sb
		srcPort, dstPort = dstPort, srcPort
	}

	h := sha1.New()
	var u16 [2]byte
	binary.BigEndian.PutUint16(u16[:], seed)
	h.Write(u16[:])
	h.Write(sb)
	h.Write(db)
	h.Write([]byte{proto, 0})
	if hasPorts(proto) {
		binary.BigEndian.PutUint16(u16[:], srcPort)
		h.Write(u16[:])
		binary.BigEndian.PutUint16(u16[:], dstPort)
		h.Write(u16[:])
	}
	return "1:" + base64.StdEncoding.EncodeToString(h.Sum(nil))
}

// ComputeStrings is a convenience wrapper that parses addresses and the transport name.
// It returns "" if anything fails to parse.
func ComputeStrings(srcIP, dstIP, transport string, srcPort, dstPort int) string {
	src, err := netip.ParseAddr(srcIP)
	if err != nil {
		return ""
	}
	dst, err := netip.ParseAddr(dstIP)
	if err != nil {
		return ""
	}
	proto, ok := ProtoFromName(transport)
	if !ok {
		return ""
	}
	if srcPort < 0 || srcPort > 65535 || dstPort < 0 || dstPort > 65535 {
		return ""
	}
	return Compute(src, dst, proto, uint16(srcPort), uint16(dstPort))
}

func hasPorts(proto uint8) bool {
	switch proto {
	case ProtoTCP, ProtoUDP, ProtoSCTP, ProtoICMP, ProtoICMPv6:
		return true
	}
	return false
}

func ordered(a, b []byte, ap, bp uint16) bool {
	c := bytes.Compare(a, b)
	return c < 0 || (c == 0 && ap < bp)
}

// ICMP message types that have a request/response counterpart. The counterpart's type
// stands in for the destination port so both directions hash identically.
var icmp4Pairs = map[uint16]uint16{
	8: 0, 0: 8, // echo request / reply
	13: 14, 14: 13, // timestamp
	15: 16, 16: 15, // information
	10: 9, 9: 10, // router solicitation / advertisement
	17: 18, 18: 17, // address mask
}

var icmp6Pairs = map[uint16]uint16{
	128: 129, 129: 128, // echo request / reply
	133: 134, 134: 133, // router solicitation / advertisement
	135: 136, 136: 135, // neighbor solicitation / advertisement
	130: 131, 131: 130, // multicast listener query / report
	144: 145, 145: 144, // home agent address discovery
}

func icmp4Equivalent(typ, code uint16) (uint16, uint16, bool) {
	if peer, ok := icmp4Pairs[typ]; ok {
		return typ, peer, false
	}
	return typ, code, true
}

func icmp6Equivalent(typ, code uint16) (uint16, uint16, bool) {
	if peer, ok := icmp6Pairs[typ]; ok {
		return typ, peer, false
	}
	return typ, code, true
}

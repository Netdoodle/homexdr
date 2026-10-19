package pki

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"strings"
	"testing"
)

func TestLoadIsStableAndSigns(t *testing.T) {
	dir := t.TempDir()
	p1, err := Load(dir, []string{"homexdr.lan", "192.168.1.5"})
	if err != nil {
		t.Fatal(err)
	}
	p2, err := Load(dir, []string{"homexdr.lan", "192.168.1.5"})
	if err != nil {
		t.Fatal(err)
	}
	if p1.CAPin() != p2.CAPin() {
		t.Fatal("CA changed between loads")
	}
	if !strings.HasPrefix(p1.CAPin(), "sha256:") || len(p1.CAPin()) != 7+64 {
		t.Fatalf("bad pin %q", p1.CAPin())
	}
	if !p1.CommandPublicKey().Equal(p2.CommandPublicKey()) {
		t.Fatal("command key changed between loads")
	}
	if p1.serverCert.Leaf.SerialNumber.Cmp(p2.serverCert.Leaf.SerialNumber) != 0 {
		t.Fatal("server cert re-issued without SAN change")
	}
	p3, err := Load(dir, []string{"homexdr.lan", "10.0.0.9"})
	if err != nil {
		t.Fatal(err)
	}
	if p3.serverCert.Leaf.SerialNumber.Cmp(p1.serverCert.Leaf.SerialNumber) == 0 {
		t.Fatal("server cert not re-issued after SAN change")
	}

	msg := []byte(`{"id":"x"}`)
	if !ed25519.Verify(p1.CommandPublicKey(), msg, p1.SignCommand(msg)) {
		t.Fatal("command signature does not verify")
	}
}

func TestSignAgentCSR(t *testing.T) {
	p, err := Load(t.TempDir(), []string{"localhost"})
	if err != nil {
		t.Fatal(err)
	}
	key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	der, err := x509.CreateCertificateRequest(rand.Reader, &x509.CertificateRequest{
		Subject: pkix.Name{CommonName: "ignored"},
	}, key)
	if err != nil {
		t.Fatal(err)
	}
	csrPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE REQUEST", Bytes: der})
	certPEM, serial, err := p.SignAgentCSR(csrPEM, "agent-123")
	if err != nil {
		t.Fatal(err)
	}
	if serial == "" {
		t.Fatal("empty serial")
	}
	block, _ := pem.Decode(certPEM)
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	if cert.Subject.CommonName != "agent-123" {
		t.Fatalf("CN = %q", cert.Subject.CommonName)
	}
	pool := x509.NewCertPool()
	pool.AddCert(p.CACert)
	if _, err := cert.Verify(x509.VerifyOptions{Roots: pool, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}); err != nil {
		t.Fatalf("issued cert does not verify: %v", err)
	}
	if _, _, err := p.SignAgentCSR([]byte("garbage"), "a"); err == nil {
		t.Fatal("expected error for garbage CSR")
	}
}

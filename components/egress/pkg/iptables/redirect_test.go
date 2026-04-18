package iptables

import (
	"net/netip"
	"testing"

	"github.com/alibaba/opensandbox/egress/pkg/constants"
)

func TestBuildRedirectRuleSpecsPreservesDesiredChainOrder(t *testing.T) {
	rules := buildRedirectRuleSpecs(15353, []netip.Addr{
		netip.MustParseAddr("127.0.0.11"),
		netip.MustParseAddr("2001:db8::53"),
	})

	if len(rules) != 12 {
		t.Fatalf("expected 12 rules, got %d", len(rules))
	}

	if rules[0].binary != "iptables" || rules[0].args[5] != "127.0.0.11" {
		t.Fatalf("expected first rule to exempt IPv4 UDP resolver, got %+v", rules[0])
	}
	if rules[1].binary != "iptables" || rules[1].args[1] != "tcp" {
		t.Fatalf("expected second rule to exempt IPv4 TCP resolver, got %+v", rules[1])
	}
	if rules[2].binary != "ip6tables" || rules[2].args[5] != "2001:db8::53" {
		t.Fatalf("expected third rule to exempt IPv6 UDP resolver, got %+v", rules[2])
	}
	if rules[3].binary != "ip6tables" || rules[3].args[1] != "tcp" {
		t.Fatalf("expected fourth rule to exempt IPv6 TCP resolver, got %+v", rules[3])
	}

	if rules[4].args[7] != constants.MarkHex || rules[5].args[7] != constants.MarkHex {
		t.Fatalf("expected mark-bypass rules before redirects, got %+v %+v", rules[4], rules[5])
	}

	if got := rules[6].args[len(rules[6].args)-1]; got != "15353" {
		t.Fatalf("expected IPv4 UDP redirect target 15353, got %s", got)
	}
	if got := rules[10].args[len(rules[10].args)-1]; got != "15353" {
		t.Fatalf("expected IPv6 UDP redirect target 15353, got %s", got)
	}
}

func TestBuildRedirectCommandsInsertAtTopOfOutputChain(t *testing.T) {
	commands := buildRedirectCommands(15353, []netip.Addr{netip.MustParseAddr("127.0.0.11")})

	if len(commands) == 0 {
		t.Fatal("expected redirect commands")
	}

	for _, cmd := range commands {
		if len(cmd) < 6 {
			t.Fatalf("unexpected command shape: %v", cmd)
		}
		if cmd[2] != "nat" || cmd[3] != "-I" || cmd[4] != "OUTPUT" || cmd[5] != "1" {
			t.Fatalf("expected command to insert at OUTPUT position 1, got %v", cmd)
		}
	}
}

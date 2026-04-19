// Copyright 2026 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package iptables

import (
	"fmt"
	"net/netip"
	"os/exec"
	"strconv"

	"github.com/alibaba/opensandbox/egress/pkg/constants"
	"github.com/alibaba/opensandbox/egress/pkg/log"
)

type ruleSpec struct {
	binary string
	args   []string
}

// SetupRedirect installs OUTPUT nat redirect for DNS (udp/tcp 53 -> port).
//
// exemptDst: optional list of destination IPs; traffic to these is not redirected. Packets carrying mark are also RETURNed (proxy's own upstream). Requires CAP_NET_ADMIN.
func SetupRedirect(port int, exemptDst []netip.Addr) error {
	log.Infof("installing iptables DNS redirect: OUTPUT port 53 -> %d (mark %s bypass)", port, constants.MarkHex)
	rules := buildRedirectCommands(port, exemptDst)

	for _, args := range rules {
		if output, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return fmt.Errorf("iptables command failed: %v (output: %s)", err, output)
		}
	}
	log.Infof("iptables DNS redirect installed successfully")
	return nil
}

func buildRedirectRuleSpecs(port int, exemptDst []netip.Addr) []ruleSpec {
	targetPort := strconv.Itoa(port)
	rules := make([]ruleSpec, 0, len(exemptDst)*2+8)

	for _, d := range exemptDst {
		dStr := d.String()
		if d.Is4() {
			rules = append(rules,
				ruleSpec{binary: "iptables", args: []string{"-p", "udp", "--dport", "53", "-d", dStr, "-j", "RETURN"}},
				ruleSpec{binary: "iptables", args: []string{"-p", "tcp", "--dport", "53", "-d", dStr, "-j", "RETURN"}},
			)
			continue
		}

		rules = append(rules,
			ruleSpec{binary: "ip6tables", args: []string{"-p", "udp", "--dport", "53", "-d", dStr, "-j", "RETURN"}},
			ruleSpec{binary: "ip6tables", args: []string{"-p", "tcp", "--dport", "53", "-d", dStr, "-j", "RETURN"}},
		)
	}

	// Keep bypass + redirect rules at the top of OUTPUT so Docker's own OUTPUT jumps
	// (for example 127.0.0.11 -> DOCKER_OUTPUT) do not bypass the proxy.
	rules = append(rules,
		ruleSpec{binary: "iptables", args: []string{"-p", "udp", "--dport", "53", "-m", "mark", "--mark", constants.MarkHex, "-j", "RETURN"}},
		ruleSpec{binary: "iptables", args: []string{"-p", "tcp", "--dport", "53", "-m", "mark", "--mark", constants.MarkHex, "-j", "RETURN"}},
		ruleSpec{binary: "iptables", args: []string{"-p", "udp", "--dport", "53", "-j", "REDIRECT", "--to-port", targetPort}},
		ruleSpec{binary: "iptables", args: []string{"-p", "tcp", "--dport", "53", "-j", "REDIRECT", "--to-port", targetPort}},
		ruleSpec{binary: "ip6tables", args: []string{"-p", "udp", "--dport", "53", "-m", "mark", "--mark", constants.MarkHex, "-j", "RETURN"}},
		ruleSpec{binary: "ip6tables", args: []string{"-p", "tcp", "--dport", "53", "-m", "mark", "--mark", constants.MarkHex, "-j", "RETURN"}},
		ruleSpec{binary: "ip6tables", args: []string{"-p", "udp", "--dport", "53", "-j", "REDIRECT", "--to-port", targetPort}},
		ruleSpec{binary: "ip6tables", args: []string{"-p", "tcp", "--dport", "53", "-j", "REDIRECT", "--to-port", targetPort}},
	)

	return rules
}

func buildRedirectCommands(port int, exemptDst []netip.Addr) [][]string {
	specs := buildRedirectRuleSpecs(port, exemptDst)
	commands := make([][]string, 0, len(specs))

	for i := len(specs) - 1; i >= 0; i-- {
		spec := specs[i]
		args := []string{spec.binary, "-t", "nat", "-I", "OUTPUT", "1"}
		args = append(args, spec.args...)
		commands = append(commands, args)
	}

	return commands
}

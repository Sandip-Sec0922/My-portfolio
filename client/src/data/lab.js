// Single source of truth for the Lab and Roadmap pages.
// status: 'built' | 'in-progress' | 'planned' (roadmap also accepts 'done').
// HONESTY RULE: change a status only when it is true. The badges are shown publicly.

export const lab = {
  summary:
    "An isolated lab for practising the L1 loop: generate attacker activity, see it arrive in the SIEM, write a detection, triage the alert, document it.",
  components: [
    {
      name: "SIEM",
      detail: "Wazuh all-in-one (manager, indexer, dashboard)",
      status: "planned",
    },
    {
      name: "Windows endpoint",
      detail: "Windows 10/11 VM with Sysmon and the Wazuh agent",
      status: "planned",
    },
    {
      name: "Linux server",
      detail:
        "Ubuntu Server with SSH exposed to the lab network and the Wazuh agent",
      status: "planned",
    },
    {
      name: "Attacker",
      detail: "Kali Linux VM (Nmap, Hydra) to generate known-bad activity",
      status: "planned",
    },
    {
      name: "Network",
      detail:
        "Host-only/internal virtual network with no bridge to the home LAN",
      status: "planned",
    },
  ],
};

export const detections = [
  {
    name: "SSH brute force",
    tactic: "Credential Access",
    technique: "T1110.001",
    source: "Linux auth.log",
    logic: "Many failed SSH logins from one source in a short window",
    status: "planned",
  },
  {
    name: "Encoded PowerShell command",
    tactic: "Execution",
    technique: "T1059.001",
    source: "Sysmon event 1 / PowerShell 4104",
    logic: "powershell.exe launched with -EncodedCommand",
    status: "planned",
  },
  {
    name: "Windows event log cleared",
    tactic: "Defense Evasion",
    technique: "T1070.001",
    source: "Security 1102 / System 104",
    logic: "Any log-clear event",
    status: "planned",
  },
  {
    name: "New local user created",
    tactic: "Persistence",
    technique: "T1136.001",
    source: "Security 4720",
    logic: "Account creation outside a change window",
    status: "planned",
  },
  {
    name: "Scheduled task created",
    tactic: "Persistence",
    technique: "T1053.005",
    source: "Security 4698",
    logic: "New task created by a non-admin tool or user",
    status: "planned",
  },
  {
    name: "Network port scan",
    tactic: "Discovery",
    technique: "T1046",
    source: "Firewall / Suricata logs",
    logic: "One source touching many ports or hosts quickly",
    status: "planned",
  },
];

export const roadmap = [
  {
    title: "Introduction to Cybersecurity (Cisco)",
    note: "Fundamentals: threats, CIA triad, basic defences.",
    status: "done",
  },
  {
    title: "Security Operations Center course",
    note: "SOC roles, alert triage, incident handling.",
    status: "done",
  },
  {
    title: "Cyber Intel Board",
    note: "Telegram collection, local-LLM triage, IOC extraction, RAG archive, critical-alert emails.",
    status: "done",
  },
  {
    title: "Secure portfolio platform (this site)",
    note: "Hardened MERN stack behind Nginx with a visible security posture.",
    status: "in-progress",
  },
  {
    title: "Build the home lab",
    note: "Wazuh, Sysmon, Linux server, attacker VM.",
    status: "planned",
  },
  {
    title: "Write and test three detections",
    note: "Each mapped to MITRE ATT&CK and documented.",
    status: "planned",
  },
  {
    title: "Publish the first incident-report write-up",
    note: "From a lab attack: timeline, evidence, verdict, response.",
    status: "planned",
  },
  {
    title: "Entry-level certification",
    note: "For example CompTIA Security+ or Cisco CyberOps Associate. Pick one and set a date.",
    status: "planned",
  },
  { title: "Apply for SOC Analyst L1 roles", note: "", status: "planned" },
];

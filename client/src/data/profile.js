// Single source of truth for static content. Edit this file, not the pages.
export const profile = {
  name: "Sandip Kepchhaki",
  title: "Cybersecurity Enthusiast | Aspiring SOC Analyst L1",
  github: "https://github.com/Sandip-Sec0922",
  linkedin: "https://www.linkedin.com/in/sandip-kepchhaki-9008a1242/",
  email: "sarunmgr77@gmail.com",
  about: [
    "I am working towards a SOC Analyst (L1) role. I started with Cisco's Introduction to Cybersecurity and a Security Operations Center course, then built a threat-intelligence tool to practise the daily SOC loop: collect, triage, enrich, alert.",
    "This website is a project too. Its codebase combines a React application, an Express API, MongoDB, and Redis. The Security page documents controls implemented in the code; the hosting and network setup shown in local reference configuration should not be mistaken for verified production infrastructure.",
  ],
};

// level: 'hands-on' = used in a real project | 'learning' = studying/practising.
// BE HONEST HERE: only list what you can discuss in an interview. Replace these with your real list.
export const skills = {
  "SIEM & Detection": [
    { n: "Wazuh", l: "learning" },
    { n: "Splunk", l: "learning" },
    { n: "ELK", l: "learning" },
    { n: "MITRE ATT&CK", l: "learning" },
  ],
  Networking: [
    { n: "Wireshark", l: "learning" },
    { n: "TCP/IP", l: "learning" },
    { n: "Nmap", l: "learning" },
  ],
  "Operating Systems": [
    { n: "Linux", l: "learning" },
    { n: "Windows event logs", l: "learning" },
  ],
  "Threat Intel": [
    { n: "IOC extraction", l: "hands-on" },
    { n: "NVD / CISA KEV", l: "hands-on" },
    { n: "Telegram OSINT feeds", l: "hands-on" },
  ],
  Scripting: [
    { n: "Python", l: "hands-on" },
    { n: "Bash", l: "learning" },
  ],
  "Applied AI": [
    { n: "Local LLMs (Ollama)", l: "hands-on" },
    { n: "RAG", l: "hands-on" },
    { n: "Streamlit", l: "hands-on" },
  ],
};

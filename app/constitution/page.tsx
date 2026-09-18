import type { Metadata } from "next";
import Link from "next/link";
import { Card, Chip, Separator } from "@heroui/react";
import { ScrollText, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Constitution",
  description:
    "The complete Constitution & Governance Charter of Greymens Club — eighteen parts, eighty-six articles, seven schedules.",
};

interface Article {
  n: string;
  title: string;
  points: string[];
  quote?: string;
}

interface Part {
  n: string;
  title: string;
  articles: Article[];
}

const PARTS: Part[] = [
  {
    n: "I",
    title: "Interpretation & Foundational Definitions",
    articles: [
      {
        n: "1",
        title: "Definitions",
        points: [
          "“Club” means GREYMEN's CLUB; “Institution” means ADYPU and the relevant School authority.",
          "“Faculty Coordinator” coordinates with the Institution; “Faculty Advisor” gives academic and technical mentoring.",
          "“General Body” votes; “Executive Board” governs; “General Council” administers and communicates; “Technical Directorate” builds, led by the CTO.",
          "“Security Activity” covers testing, defensive and offensive-security education, vulnerability analysis, and CTF infrastructure. “Authorized Activity” is one with explicit permission, inside a defined scope.",
          "“Officer” holds formal office; “standing body” continues; project and event teams are temporary. “Good standing” means free of sanctions restricting the relevant participation.",
        ],
      },
      {
        n: "2",
        title: "Interpretation and Hierarchy",
        points: [
          "The Charter serves the Club's purpose while preserving student leadership, institutional accountability, competence, responsible conduct, and continuity.",
          "Where the Charter conflicts with law or binding institutional policy, the higher authority prevails to the extent of the conflict.",
          "Procedures, forms, and technical standards live in the Articles, Schedules, and Appendices — and must never contradict the Charter.",
          "Ambiguity resolves toward compliance, due process, least privilege, participation, and continuity.",
        ],
        quote:
          "No office, committee, project team or individual member may exercise authority that this Charter does not grant or that has not been validly delegated under it.",
      },
    ],
  },
  {
    n: "II",
    title: "Identity, Purpose & Principles",
    articles: [
      {
        n: "3",
        title: "Name, Status and Identity",
        points: [
          "The organization is GREYMEN's CLUB — a student technology organization within ADYPU's School of Engineering, subject to institutional requirements.",
          "Cybersecurity is the central technical identity, with room for AI/ML, software and web, cloud, data, systems, research, and emerging technology.",
          "The Club is interdisciplinary: no program of study limits where a member may contribute, subject to competence and authorization.",
        ],
      },
      {
        n: "4",
        title: "Purpose and Objectives",
        points: [
          "A continuous interdisciplinary community with cybersecurity at its core — where students connect through shared interests to discuss, debate, explore, build, compete, research, and grow.",
          "Learning through practical work, responsible experimentation, projects, competitions, and peer collaboration.",
          "Competence together with judgment, ethics, documentation, communication, and responsible use of technology. Work first; events, certificates, and promotion support the work — never the reverse.",
        ],
      },
      {
        n: "5",
        title: "Foundational Principles",
        points: [
          "Student-led governance within institutional oversight · cybersecurity as core identity · participation without academic boundaries · authorized and responsible technology use · competence-based responsibility and least privilege · proportionate discipline with fairness and the right to respond · documentation, continuity, and handover · non-discriminatory access · protection of people, systems, information, and resources · continuous improvement through review.",
        ],
      },
    ],
  },
  {
    n: "III",
    title: "Membership & General Body",
    articles: [
      {
        n: "6",
        title: "Membership Categories",
        points: [
          "General Member — admitted under the membership process; joins open activities subject to rules.",
          "Active Member — meets published participation requirements; gains voting eligibility and specified opportunities.",
          "Officer — holds elected or appointed office while in good standing.",
          "Project / Specialized Team Member — temporary, scope-limited assignment.",
          "Alumni / Former Member — advisory or honorary; no ordinary vote unless expressly granted.",
        ],
      },
      {
        n: "7",
        title: "Admission, Rights and Responsibilities",
        points: [
          "Admission runs through the Board-approved process, consistent with institutional requirements.",
          "Members access activities fitting their status, and comply with the Charter, Club rules, event instructions, and conditions on technical access.",
          "Credentials, systems, information, and property are protected. Membership alone never authorizes access to or testing of any system.",
          "Members may raise concerns, report in good faith, and take part in the governance open to their category.",
        ],
      },
      {
        n: "8",
        title: "Active Membership and Voting Eligibility",
        points: [
          "Participation criteria (activities, projects, meetings, research, competitions, contribution) must be published well before any election or vote they affect.",
          "Active status must never be used arbitrarily to exclude members or engineer outcomes.",
        ],
      },
      {
        n: "9",
        title: "General Body",
        points: [
          "Comprises members entitled to vote. Elects designated offices; considers amendments and reserved matters.",
          "Does not intervene in day-to-day technical, administrative, or event decisions delegated to the Board and its bodies.",
          "An Annual General Meeting gives every member activity, financial, and leadership updates — and the floor.",
        ],
      },
    ],
  },
  {
    n: "IV",
    title: "Institutional Governance",
    articles: [
      {
        n: "10",
        title: "Faculty Coordinators",
        points: [
          "Ranjana Singh and Suyog Deshmukh, unless the Institution designates otherwise.",
          "Provide coordination and oversight, assist approvals, escalate serious matters, and preserve Club–Institution continuity.",
          "May intervene over material institutional, legal, safety, disciplinary, or reputational concerns. Routine operations stay student-led.",
        ],
      },
      {
        n: "11",
        title: "Faculty Advisors",
        points: [
          "Priya Godse, Prajakta Sitap, Namrata Lanjewar, Aarti Kumari, Amit Nichat, Aarti Killedar, Ravidra Patil, and Vishal Gosavi — subject to continued association and availability.",
          "Give academic, technical, project, research, and mentoring guidance. Advisory status alone carries no executive authority.",
        ],
      },
      {
        n: "12",
        title: "Institutional Compliance and External Authority",
        points: [
          "The Club complies with ADYPU rules, School requirements, event procedures, and safety directions.",
          "Nothing purporting to bind the Institution is entered without the required institutional process.",
          "Incidents possibly needing external reporting are preserved and escalated — never suppressed or settled outside Club authority.",
        ],
      },
    ],
  },
  {
    n: "V",
    title: "Student Executive Governance",
    articles: [
      {
        n: "13",
        title: "Executive Board",
        points: [
          "The principal student governing body: President, Vice President, General Secretary, Treasurer, CTO / Technical Director, Cybersecurity Lead, Research & Projects Director.",
          "May invite divisional and project leads, advisors, or members for expertise — invitees discuss but do not vote by invitation.",
        ],
      },
      {
        n: "14",
        title: "President",
        points: [
          "Overall student leadership; represents the Club where authorized; chairs the Board; works with Faculty Coordinators; drives continuity and Charter compliance.",
          "Tie-breaking only where expressly provided and conflict-free. Office alone never overrides technical or security controls.",
        ],
      },
      {
        n: "15",
        title: "Vice President",
        points: [
          "Supports the President, acts in absence as provided, coordinates cross-directorate work and follow-through, resolves dependencies between council and technical functions, and may coordinate Board task forces.",
        ],
      },
      {
        n: "16",
        title: "General Secretary",
        points: [
          "Principal administrative officer; chairs the General Council; keeps minutes, resolutions, officer records, and amendments; runs membership administration and notices; owns handover and continuity records; keeps subordinate documents consistent with the Charter.",
        ],
      },
      {
        n: "17",
        title: "Treasurer",
        points: [
          "Student-side financial records, budgets, expenditure documentation, sponsorship records; works through institutional finance processes. Cannot commit institutional funds or sign binding agreements without required authorization.",
        ],
      },
      {
        n: "18",
        title: "CTO / Technical Director",
        points: [
          "Overall technical architecture and standards; coordinates divisions, shared practices, and infrastructure; owns reliability and continuity of Club systems; works with the Cybersecurity Lead on sensitive infrastructure; ensures every resource has an owner and a handover.",
        ],
      },
      {
        n: "19",
        title: "Cybersecurity Lead",
        points: [
          "Security activities and governance: labs, authorized testing, responsible disclosure, education; approves controls for security work; coordinates with CTO and Infrastructure on sensitive systems.",
          "May impose temporary access restrictions to contain risk — subject to prompt reporting and review. Guides the CTF & Competitive Security Lead.",
        ],
      },
      {
        n: "20",
        title: "Research & Projects Director",
        points: [
          "Research programs and long-running projects: formation, leads, milestones, review; responsible practices, attribution, and publication quality; interdisciplinary teams and mentoring; portfolio view without micromanagement.",
        ],
      },
    ],
  },
  {
    n: "VI",
    title: "General Council",
    articles: [
      {
        n: "21",
        title: "Purpose and Composition",
        points: [
          "The standing administrative and community body, chaired by the General Secretary: Communications, Editorial, Marketing, Social Media, Documentation, Membership, and Community leads — with the Treasurer standing in on finance and administration.",
          "The Board may create further portfolios by resolution for genuine continuing need, never contradicting the Charter.",
        ],
      },
      {
        n: "22",
        title: "Communications Lead",
        points: [
          "Official internal and external communications on authorized channels; message consistency; sensitive statements routed through proper authority; coordinates with social, documentation, and event teams.",
        ],
      },
      {
        n: "23",
        title: "Editorial Lead and Editorial Board",
        points: [
          "Standing Editorial Board: technical articles, research summaries, project and CTF write-ups, newsletters. Sets review, attribution, and publication standards; works with Research & Projects on research content and Communications on distribution.",
        ],
      },
      {
        n: "24",
        title: "Marketing Lead",
        points: [
          "Outreach and promotion for approved activities — campaigns, collaborations, visibility. No institutional commitments without authorization.",
        ],
      },
      {
        n: "25",
        title: "Social Media Lead",
        points: [
          "Authorized channels; approved content adapted per platform; credential protection and access-control discipline.",
        ],
      },
      {
        n: "26",
        title: "Documentation Lead",
        points: [
          "Operational documentation for events, projects, and major activities; activity reports and archives; coordinates with the General Secretary on records and the Editorial Board on publications.",
        ],
      },
      {
        n: "27",
        title: "Membership Lead",
        points: [
          "Registration and onboarding; membership status records with the General Secretary; eligibility verification for elections and restricted activities where authorized.",
        ],
      },
      {
        n: "28",
        title: "Community Lead",
        points: [
          "Peer learning and engagement; interest groups, volunteers, interdisciplinary participation; works with Membership so newcomers find their path.",
        ],
      },
    ],
  },
  {
    n: "VII",
    title: "Technical, Security & Research Organization",
    articles: [
      {
        n: "29",
        title: "Technical Directorate",
        points: [
          "Operates under the CTO: the standing technical divisions of this Charter plus any the Board validly resolves into being.",
        ],
      },
      {
        n: "30",
        title: "Software & Web Development Lead",
        points: [
          "Software, web, application, API, and automation work with sound development practices — and cybersecurity input wherever projects carry security implications.",
        ],
      },
      {
        n: "31",
        title: "AI/ML & Data Lead",
        points: [
          "AI/ML and data activities; interdisciplinary work where AI meets security, software, and data; responsible experimentation with documented datasets, methods, and results.",
        ],
      },
      {
        n: "32",
        title: "Infrastructure / Systems Lead",
        points: [
          "Club-controlled servers, VMs, networks, deployments, and services within assigned scope; access records and least privilege; containment with the Cybersecurity Lead, direction from the CTO.",
        ],
      },
      {
        n: "33",
        title: "CTF & Competitive Security Lead",
        points: [
          "Competitive security team and CTF participation: practice, preparation, logistics — always inside authorized environments under the Cybersecurity Lead's framework.",
        ],
      },
      {
        n: "34",
        title: "Research and Project Teams",
        points: [
          "Constituted by the Research & Projects Director for defined objectives, each with a named lead, scope, members, outputs, and a closure or review condition. Subordinate to the Charter; establishment alone grants no independent authority.",
        ],
      },
    ],
  },
  {
    n: "VIII",
    title: "Cybersecurity, Responsible Technology & Technical Access",
    articles: [
      {
        n: "35",
        title: "Authorized Activity",
        points: [
          "No member or officer touches a system, network, application, account, device, service, or information resource without explicit authorization — and never beyond its stated target, time, technique, data boundary, or purpose.",
          "Authorized environments include Club labs, purpose-built CTF platforms, systems expressly provided for testing, or systems with written or otherwise verifiable permission.",
        ],
        quote:
          "Club membership is not permission to access, scan, exploit, modify, disrupt, extract data from or otherwise interact with a system. Permission must exist for the specific activity and scope.",
      },
      {
        n: "36",
        title: "Responsible Disclosure",
        points: [
          "Vulnerabilities found through Club activity: preserve evidence, follow the authorized disclosure process, and never publish sensitive details merely because you discovered them. Third-party and institutional findings go through the appropriate authority.",
        ],
      },
      {
        n: "37",
        title: "Technical Access and Least Privilege",
        points: [
          "Access by role, need, and scope; privileged access only for defined responsibility; credentials protected and unshared; access reviewed and revoked when roles end, need ends, or incidents demand it. Club accounts and resources belong to the Club or Institution — never to the individual administering them.",
        ],
      },
      {
        n: "38",
        title: "Security Incident Containment",
        points: [
          "Where a Club system or account may be compromised, the Cybersecurity and Infrastructure leads may act immediately within authority — disabling access, revoking credentials, isolating systems, preserving logs.",
          "Containment protects; it does not prejudge misconduct. Material incidents escalate promptly to the CTO, President, and where appropriate a Faculty Coordinator.",
        ],
      },
      {
        n: "39",
        title: "Technical Infrastructure Ownership",
        points: [
          "Repositories, domains, servers, cloud, CTF infrastructure, shared services, and official accounts are organizational resources — organizational ownership wherever practical, with an identified owner, a backup custodian where possible, and a handover path.",
        ],
      },
    ],
  },
  {
    n: "IX",
    title: "Elections, Appointments, Terms & Succession",
    articles: [
      {
        n: "40",
        title: "Elected Offices",
        points: [
          "President, Vice President, General Secretary, and Treasurer are ordinarily elected by the eligible General Body. Future amendment may elect more offices — technical competence stays an eligibility factor for specialized ones.",
        ],
      },
      {
        n: "41",
        title: "Appointed / Selected Offices",
        points: [
          "CTO, Cybersecurity Lead, Research & Projects Director, divisional leads, and council leads are selected through a documented nomination and appointment process weighing competence, reliability, contribution, conduct, and availability. No appointment may evade a disciplinary restriction.",
        ],
      },
      {
        n: "42",
        title: "Nominations and Selection",
        points: [
          "Selection panels may be established. Anyone with a material conflict of interest takes no part in deciding their own selection, an associate's, or a disputed disciplinary appointment.",
        ],
      },
      {
        n: "43",
        title: "Eligibility for Office",
        points: [
          "Good standing, institutional eligibility, ability to do the work, demonstrated competence for specialized posts — and no eligibility while a sanction barring office stands.",
        ],
      },
      {
        n: "44",
        title: "Term of Office",
        points: [
          "Ordinarily one academic year unless institutional rules or a ratified resolution say otherwise. Re-election or reappointment is possible where permitted — but never automatic for want of a successor.",
        ],
      },
      {
        n: "45",
        title: "Vacancies and Succession",
        points: [
          "President vacant — Vice President acts, then the prescribed election or succession process.",
          "Vice President vacant — President nominates an interim through the appointment process, subject to the next General Body or election requirement.",
          "General Secretary vacant — the Board appoints an interim to preserve records and council continuity.",
          "Technical lead vacant — the relevant executive authority appoints a competent interim.",
          "Every vacancy prioritizes continuity, documented handover, and timely permanent replacement.",
        ],
      },
      {
        n: "46",
        title: "Handover and Continuity",
        points: [
          "Outgoing officers hand over current work, pending matters, resources, contacts, documentation, access transition through approved procedures, and known risks. Critical resources never depend on a personal account. The General Secretary keeps the continuity record; sensitive technical detail stays restricted.",
        ],
      },
    ],
  },
  {
    n: "X",
    title: "Meetings, Quorum & Decision-Making",
    articles: [
      {
        n: "47",
        title: "Meetings of the Executive Board",
        points: [
          "Meets as reasonably required, with a regular cadence in active academic periods. Ordinary meetings carry notice and an agenda; emergencies may be called on shorter notice.",
        ],
      },
      {
        n: "48",
        title: "General Council Meetings",
        points: [
          "Convened by the General Secretary for administrative coordination; each portfolio reports progress, pending tasks, issues, and escalations.",
        ],
      },
      {
        n: "49",
        title: "General Body Meetings and Annual General Meeting",
        points: [
          "The AGM reviews activity, leadership, membership, finances, and future priorities. Special General Body meetings are called as the Charter requires or the eligible voting membership requests.",
        ],
      },
      {
        n: "50",
        title: "Quorum",
        points: [
          "Executive Board and General Council: simple majority of voting members unless institutional rules require more. General Body quorum is set in the ratified election procedures — high enough for legitimacy, practical enough for a student organization.",
        ],
      },
      {
        n: "51",
        title: "Decision-Making and Voting",
        points: [
          "Ordinary decisions pass by simple majority of votes cast with quorum present, unless the Charter demands more. Abstentions count as neither side. Amendments, dissolution, and senior removals may require higher thresholds. Specialized technical decisions belong to the competent office — not to non-technical majority vote.",
        ],
      },
      {
        n: "52",
        title: "Authority Matrix",
        points: [
          "Strategy — President / Board, escalating to Faculty Coordinators on institutional matters. Administration — General Secretary. Finance — Treasurer with Board and institutional process. Technical architecture — CTO. Cybersecurity controls — Cybersecurity Lead. Infrastructure — Infrastructure Lead with CTO and Cybersecurity Lead on security issues. Research — Research & Projects Director. CTF — CTF Lead under the Cybersecurity Lead. Membership — Membership Lead under the General Secretary. Community — Community Lead. Communications — Communications Lead. Publications — Editorial Lead and Board. Projects and events — their leads under the relevant director.",
        ],
      },
      {
        n: "53",
        title: "Conflict Resolution",
        points: [
          "Operational disputes rise from the relevant lead to director or General Secretary / VP, then the President. Matters touching the President — or impartiality itself — go to the Faculty Coordinators or appropriate institutional authority. Security disputes preserve the Cybersecurity Lead's controls pending resolution.",
        ],
      },
    ],
  },
  {
    n: "XI",
    title: "Projects, Events, Competitions & Committees",
    articles: [
      {
        n: "54",
        title: "Projects",
        points: [
          "Defined objective, lead, members, scope, outputs, risk profile, and closure condition. Anything involving security testing, sensitive data, privileged infrastructure, or external systems clears authorization and security review before execution.",
        ],
      },
      {
        n: "55",
        title: "Events and Activities",
        points: [
          "Cybersecurity workshops, discussions, CTFs, debates and case studies, technical workshops, showcases, research sessions, hackathons, awareness work, expert interactions. Each event names a coordinator and, where relevant, separate technical, operations, communications, and documentation hands. Event duties create no permanent offices.",
        ],
      },
      {
        n: "56",
        title: "Temporary Committees and Task Forces",
        points: [
          "The Board may resolve temporary bodies into being — committees, task forces, event, project, and competition teams — naming purpose, lead, membership, authority, output, and termination condition. Their authority never exceeds the grant.",
        ],
      },
    ],
  },
  {
    n: "XII",
    title: "Finance, Assets & Administration",
    articles: [
      {
        n: "57",
        title: "Financial Governance",
        points: [
          "Institutional finance rules govern. The Treasurer keeps accurate records with supporting documentation. Sponsorships and fundraising follow institutional requirements and create no undisclosed obligations.",
        ],
      },
      {
        n: "58",
        title: "Expenditure and Approval",
        points: [
          "Approval before commitment wherever practicable; emergencies follow the institutional emergency process with prompt documentation after. Nobody approves a payment to themselves without independent review or required procedure.",
        ],
      },
      {
        n: "59",
        title: "Assets and Asset Register",
        points: [
          "Physical and digital assets — hardware, lab equipment, books, domains, hosting, repositories, cloud, services — are tracked, and stay with the Club or Institution when officers leave.",
        ],
      },
    ],
  },
  {
    n: "XIII",
    title: "Information, Data, Intellectual Property & Representation",
    articles: [
      {
        n: "60",
        title: "Information and Privacy",
        points: [
          "Personal information, credentials, private communications, and sensitive Club data are handled only for legitimate Club purposes within authorized access — and shared only with those who need them for a defined responsibility.",
        ],
      },
      {
        n: "61",
        title: "Research and Intellectual Contribution",
        points: [
          "Attribution, accurate reporting, responsible authorship, no plagiarism. Ownership, IP, and publication rights follow institutional rules and valid project agreements. The Club claims no automatic ownership of everything members create.",
        ],
      },
      {
        n: "62",
        title: "Official Representation and Branding",
        points: [
          "Only authorized persons speak for the Club or commit it externally. Name, logo, channels, domain, and accounts follow approved branding rules. Personal opinions are never presented as Club positions without authorization.",
        ],
      },
      {
        n: "63",
        title: "External Partnerships and Competitions",
        points: [
          "Collaboration with companies, communities, colleges, and conferences is welcome under institutional procedures. Anything involving contracts, money, data-sharing, branding, or legal commitment follows the required approval process.",
        ],
      },
    ],
  },
  {
    n: "XIV",
    title: "Conduct, Offences & Discipline",
    articles: [
      {
        n: "64",
        title: "Standards of Conduct",
        points: [
          "Professionalism, respect, and integrity in Club activities and channels. No misuse of authority, resources, identity, access, or information. Safety, institutional, and cybersecurity requirements are complied with. No retaliation against good-faith reporters or review participants.",
        ],
      },
      {
        n: "65",
        title: "Offence Categories",
        points: [
          "Level I — Minor: low-impact or administrative breaches such as disruption or first low-level channel misuse; advisory or verbal warning, correction, training.",
          "Level II — Moderate: meaningful, repeated, or negligent misconduct such as misrepresentation or improper disclosure; written warning, probation, restriction, removal from activity or role.",
          "Level III — Major: serious misconduct with substantial harm or risk such as financial misconduct, serious harassment, or deliberate control circumvention; suspension, role removal, access or membership termination, institutional referral.",
          "Level IV — Critical: severe security, safety, legal, or institutional risk such as unauthorized attacks, credential theft, malware, destruction, or serious fraud; immediate protective measures plus suspension, termination, and referral.",
        ],
      },
      {
        n: "66",
        title: "Cybersecurity and Technical Offences",
        points: [
          "Unauthorized or out-of-scope access and attempts; attacking or scanning external targets from Club infrastructure; credential theft, deliberate sharing, or privilege misuse; malware or destructive tooling against unauthorized systems; unauthorized extraction, retention, or disclosure of sensitive information; deliberate control circumvention; concealing or destroying incident evidence; misrepresenting an activity as Club-authorized.",
        ],
      },
      {
        n: "67",
        title: "Other Serious Offences",
        points: [
          "Fraud, theft, or misappropriation; falsifying records, participation, research, or finances; plagiarism or misrepresentation; harassment, threats, intimidation, or serious discrimination; abuse of office for advantage or retaliation; unauthorized disclosure of confidential information; interfering with investigations, destroying evidence, or retaliating against complainants and witnesses.",
        ],
      },
      {
        n: "68",
        title: "Aggravating and Mitigating Factors",
        points: [
          "Intent weighs heavier than accident; harm, financial and security impact, and institutional consequences aggravate. Prompt self-reporting, cooperation, remediation, and genuine correction mitigate. Concealment, retaliation, repetition, and abuse of privilege aggravate — as does the responsibility the member held.",
        ],
      },
      {
        n: "69",
        title: "Warnings and Sanctions",
        points: [
          "Advisory warning · written warning · final warning · probation · access suspension · removal from activity, project, or team · removal from office · membership suspension · membership termination · institutional or external referral.",
        ],
      },
      {
        n: "70",
        title: "Proportionate Discipline",
        points: [
          "Sanctions fit nature, severity, intent, impact, repetition, and circumstance — and may combine, such as access suspension with a warning. Temporary protection never predetermines the final outcome.",
        ],
      },
      {
        n: "71",
        title: "Officer Accountability",
        points: [
          "Misconduct abusing office, privileged access, funds, confidential information, or entrusted authority faces enhanced accountability. Removal from office is distinct from termination of membership.",
        ],
      },
    ],
  },
  {
    n: "XV",
    title: "Complaints, Investigation & Appeals",
    articles: [
      {
        n: "72",
        title: "Reporting and Complaints",
        points: [
          "Complaints go to the General Secretary, President, relevant senior officer, or a Faculty Coordinator as the matter fits. Where the complaint touches the ordinary recipient, report to another authority — nobody is asked to decide their own case. Good-faith reporting is never misconduct for proving unsubstantiated.",
        ],
      },
      {
        n: "73",
        title: "Preliminary Assessment",
        points: [
          "Establishes Club jurisdiction, whether immediate protection is needed, and whether the Institution must receive the matter.",
        ],
      },
      {
        n: "74",
        title: "Interim Protective Measures",
        points: [
          "Temporary suspension of technical access; removal from a project, competition, or event; restrictions on systems or credentials; preservation of records and logs; other proportionate measures protecting people, systems, or information.",
        ],
      },
      {
        n: "75",
        title: "Review and Opportunity to Respond",
        points: [
          "Before serious final sanctions: notice of the allegation and a reasonable opportunity to respond, subject to institutional rules and necessary interim protection. Evidence is weighed with minimal disclosure of sensitive information.",
        ],
      },
      {
        n: "76",
        title: "Conflict of Interest",
        points: [
          "Nobody is the sole decision-maker in a disciplinary matter involving themselves or a material conflict of interest.",
        ],
      },
      {
        n: "77",
        title: "Decision",
        points: [
          "Decisions record the finding, applicable rule, sanction, and effective date — documented confidentially and retained per Club and institutional practice.",
        ],
      },
      {
        n: "78",
        title: "Appeals",
        points: [
          "Serious decisions may be appealed on material procedural unfairness, relevant new evidence, significant conflict of interest, or clearly disproportionate sanction — reviewed by different authorized hands wherever practicable.",
        ],
      },
      {
        n: "79",
        title: "Confidentiality and Referral",
        points: [
          "Disciplinary information reaches only those who reasonably need it for governance, safeguarding, compliance, legal duty, or the review. Confidentiality never blocks required reporting to the Institution or competent authority.",
        ],
      },
    ],
  },
  {
    n: "XVI",
    title: "Records, Documentation & Organizational Continuity",
    articles: [
      {
        n: "80",
        title: "Official Records",
        points: [
          "Constitution, amendments, and ratification · Board and Council minutes and resolutions · appointment and election records · membership records · annual activity and financial records · asset and infrastructure ownership · project and event records · access-restricted disciplinary records.",
        ],
      },
      {
        n: "81",
        title: "Documentation Responsibilities",
        points: [
          "The General Secretary custodies the governance record; the Documentation Lead maintains operational documentation, reports, and archives; the CTO, Cybersecurity Lead, and Infrastructure Lead maintain technical documentation with sensitive material appropriately restricted.",
        ],
      },
      {
        n: "82",
        title: "Annual Governance Review",
        points: [
          "The Charter is reviewed at least each academic year — or whenever major structural, institutional, or operational change demands it — testing whether offices stay useful, authority stays clear, discipline stays workable, and access and continuity controls stay adequate.",
        ],
      },
    ],
  },
  {
    n: "XVII",
    title: "Amendments, Interpretation & Dissolution",
    articles: [
      {
        n: "83",
        title: "Amendments",
        points: [
          "Proposed in writing with sufficient notice before a vote; higher approval thresholds than ordinary decisions; institutional approval where required; every approved amendment recorded with date, description, and approving authority.",
        ],
      },
      {
        n: "84",
        title: "Subordinate Rules and Operating Documents",
        points: [
          "Procedures, technical standards, event and CTF rules, and forms live inside this Charter — its schedules and appendices. Nothing subordinate may contradict the Charter or institutional requirements, and office-created procedures are documented for the people expected to follow them.",
        ],
      },
      {
        n: "85",
        title: "Interpretive Authority",
        points: [
          "The Executive Board first considers questions of meaning and application, under Faculty Coordinator and institutional oversight. Interpretation never smuggles in a new permanent office, financial authority, or disciplinary power — those need formal amendment.",
        ],
      },
      {
        n: "86",
        title: "Dissolution",
        points: [
          "Dissolution follows the applicable institutional process and voting threshold. Assets, funds, records, accounts, infrastructure, and intellectual materials transfer, archive, or dispose per institutional requirements — never informally among individuals.",
        ],
      },
    ],
  },
  {
    n: "XVIII",
    title: "Appendices and Organizational Schedules",
    articles: [
      {
        n: "A",
        title: "Founding Record",
        points: [
          "Founding Student Coordinator and President — Aditya Yadav (URN E25B021436, BCA 2025 – BCA Cybersecurity). Faculty Coordinators — Ranjana Singh, Suyog Deshmukh.",
        ],
      },
      {
        n: "B",
        title: "Faculty Advisors",
        points: [
          "Priya Godse · Prajakta Sitap · Namrata Lanjewar · Aarti Kumari · Amit Nichat · Aarti Killedar · Ravidra Patil · Vishal Gosavi.",
        ],
      },
      {
        n: "C",
        title: "Office Architecture",
        points: [
          "Institutional — Faculty Coordinators, Faculty Advisors. General Body — eligible voting members. Executive Board — President, Vice President, General Secretary, Treasurer, CTO, Cybersecurity Lead, Research & Projects Director. General Council — Communications, Editorial, Marketing, Social Media, Documentation, Membership, Community, Treasurer. Technical Divisions — Software & Web, AI/ML & Data, Infrastructure / Systems. Security & Competition — CTF & Competitive Security. Temporary — project, research, event, and competition teams, task forces, special committees.",
        ],
      },
      {
        n: "D",
        title: "Authority Matrix Summary",
        points: [
          "The Article 52 matrix is incorporated as a governance schedule; operational detail is recorded by the responsible authority in the appropriate section, schedule, or appendix.",
        ],
      },
      {
        n: "E",
        title: "Disciplinary Classification Summary",
        points: [
          "Minor — low-impact breach; advisory or written warning, correction, training. Moderate — repeated or meaningful misconduct; warning, probation, restriction, role removal. Major — serious misconduct or substantial risk; suspension, role removal, access revocation, referral. Critical — severe risk; immediate protection, suspension or termination, external referral.",
        ],
      },
      {
        n: "F",
        title: "Ratification Record",
        points: [
          "Proposed version 0.9 — Foundational Draft. Presentation, student approval, institutional approval, ratification, effective, and final version dates to be recorded by the General Secretary on ratification.",
        ],
      },
      {
        n: "G",
        title: "Amendment History",
        points: [
          "v0.9 — foundational governance draft established. Further rows accrue with each ratified amendment.",
        ],
        quote:
          "This Charter is designed so that authority is tied to responsibility, security controls remain explicit, temporary teams can be created without constitutional surgery, and every office can survive the departure of the person currently holding it.",
      },
    ],
  },
];

const CONTROL_ROWS: Array<[string, string]> = [
  ["Document status", "Draft for Ratification"],
  ["Version", "0.9 — Foundational Draft"],
  ["School", "School of Engineering (SoE), ADYPU"],
  ["Student Coordinator / President", "Aditya Yadav"],
  ["URN", "E25B021436"],
  ["Batch", "BCA 2025 – BCA Cybersecurity"],
  ["Faculty Coordinators", "Ranjana Singh; Suyog Deshmukh"],
  ["Activity horizon in original proposal", "Through 30 November 2026"],
  ["Review cycle", "At least once each academic year"],
];

export default function ConstitutionPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Table of contents */}
        <aside className="hidden lg:block">
          <nav
            aria-label="Constitution contents"
            className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-1 overflow-y-auto rounded-2xl border border-default-200/70 bg-background p-4"
          >
            <p className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Contents
            </p>
            {PARTS.map((part) => (
              <a
                key={part.n}
                href={`#part-${part.n.toLowerCase()}`}
                className="block rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
              >
                <span className="mr-1.5 font-mono text-[11px]">{part.n}</span>
                {part.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* The document */}
        <div className="min-w-0">
          <article className="overflow-hidden rounded-3xl border border-default-200/70 bg-background shadow-sm">
            {/* Cover */}
            <div className="space-y-6 border-b border-default-200/70 bg-surface-secondary/50 px-6 py-10 text-center sm:px-12 sm:py-14">
              <p className="font-serif text-sm font-semibold uppercase tracking-[0.3em] text-muted">
                Greymens Club
              </p>
              <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                Constitution &amp; Governance Charter
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Chip color="warning" variant="soft" size="sm">
                  Draft for Ratification
                </Chip>
                <Chip size="sm" variant="soft">
                  Version 0.9 — Foundational Draft
                </Chip>
              </div>
              <p className="mx-auto max-w-xl font-serif text-base italic leading-relaxed text-muted sm:text-lg">
                This Charter establishes the governing structure, authority,
                membership, responsibilities, conduct standards, technical
                governance, disciplinary framework, and continuity of
                Greymens Club.
              </p>
            </div>

            <div className="space-y-10 px-6 py-10 sm:px-12">
              {/* Document control */}
              <section aria-label="Document control">
                <h2 className="font-serif text-xl font-bold">Document control</h2>
                <dl className="mt-4 overflow-hidden rounded-2xl border border-default-200/70">
                  {CONTROL_ROWS.map(([term, value], index) => (
                    <div
                      key={term}
                      className={`grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[240px_1fr] sm:gap-4 ${
                        index % 2 === 1 ? "bg-surface-secondary/50" : ""
                      }`}
                    >
                      <dt className="font-medium text-muted">{term}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Card className="mt-4 border-warning/40 bg-warning/5">
                  <Card.Content className="flex gap-3 p-5">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                      aria-hidden="true"
                    />
                    <p className="text-sm leading-relaxed text-muted">
                      <span className="font-semibold text-foreground">
                        Ratification note.{" "}
                      </span>
                      This is a governance draft for institutional and student
                      review. It becomes the operative Constitution only after
                      the required approval and ratification process. Where it
                      conflicts with law or binding institutional policy, the
                      higher authority prevails.
                    </p>
                  </Card.Content>
                </Card>
              </section>

              {/* Mobile contents */}
              <nav
                aria-label="Constitution contents"
                className="rounded-2xl border border-default-200/70 p-4 lg:hidden"
              >
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  Contents — XVIII parts
                </p>
                <ol className="grid gap-1 sm:grid-cols-2">
                  {PARTS.map((part) => (
                    <li key={part.n}>
                      <a
                        href={`#part-${part.n.toLowerCase()}`}
                        className="block rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-secondary hover:text-foreground"
                      >
                        <span className="mr-1.5 font-mono text-xs">{part.n}</span>
                        {part.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              {/* Parts */}
              {PARTS.map((part) => (
                <section
                  key={part.n}
                  id={`part-${part.n.toLowerCase()}`}
                  aria-label={`Part ${part.n}: ${part.title}`}
                  className="scroll-mt-28 space-y-6"
                >
                  <div className="space-y-1 border-b-2 border-foreground/80 pb-3">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
                      Part {part.n}
                    </p>
                    <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
                      {part.title}
                    </h2>
                  </div>
                  {part.articles.map((article) => (
                    <div
                      key={article.n}
                      id={`art-${article.n.toLowerCase()}`}
                      className="scroll-mt-28 space-y-3"
                    >
                      <h3 className="font-serif text-lg font-bold">
                        <span className="mr-2 font-mono text-sm font-semibold text-accent">
                          {/^[A-G]$/.test(article.n)
                            ? `Appendix ${article.n}`
                            : `Art. ${article.n}`}
                        </span>
                        {article.title}
                      </h3>
                      {article.quote && (
                        <blockquote className="rounded-r-2xl border-l-4 border-warning bg-warning/5 px-4 py-3 font-serif text-[15px] italic leading-relaxed">
                          {article.quote}
                        </blockquote>
                      )}
                      <div className="space-y-2">
                        {article.points.map((point, index) => (
                          <p
                            key={index}
                            className="text-[15px] leading-relaxed text-foreground/85"
                          >
                            {point}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}

              <Separator />

              <footer className="space-y-3 text-sm text-muted">
                <p className="font-serif italic">
                  Document principle — this Charter is the club&apos;s single
                  comprehensive governing document. Governance rules,
                  disciplinary provisions, role definitions, technical controls,
                  operating requirements, and schedules are maintained within
                  this document.
                </p>
                <p>
                  Review cycle: at least once each academic year. Ratification
                  and amendment records are maintained by the General Secretary.
                </p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <Link
                    href="/governance"
                    className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    How governance works
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/security/report"
                    className="inline-flex items-center gap-1.5 rounded-full border border-default-300 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-secondary"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Authorization &amp; incident reporting
                  </Link>
                </div>
              </footer>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

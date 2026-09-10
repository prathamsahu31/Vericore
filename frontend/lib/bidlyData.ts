export interface Tender {
  id: string;
  title: string;
  department: string;
  refNumber: string;
  value: string;
  rawValue: number;
  location: string;
  deadline: string;
  deadlineDaysLeft: number;
  status: "Active" | "Closing Today" | "Opening Soon" | "Under Evaluation" | "Awarded";
  winProbability: number;
  competitionLevel: "Low" | "Moderate" | "High";
  biddersCount: number;
  complexity: number; // 1-5 dots
  roiScore: number; // 1-100
  scopeSummary: string;
  keyRequirements: { text: string; satisfied: boolean; note?: string }[];
  suggestedActions: string[];
  riskFactors: { title: string; desc: string; severity: "low" | "medium" | "high" }[];
  documents: { name: string; type: string; size: string; pages: number; mandatory: boolean }[];
  contactOfficer: { name: string; title: string; email: string; phone: string };
  timeline: { title: string; date: string; status: "completed" | "current" | "upcoming" }[];
}

export const BIDLY_TENDERS: Tender[] = [
  {
    id: "tender-001",
    title: "Enterprise Cloud Infrastructure & Hybrid Data Center Migration",
    department: "Department of Transportation & Infrastructure",
    refNumber: "DOT-IT-2026-8941",
    value: "$4,850,000",
    rawValue: 4850000,
    location: "Austin, TX (Statewide)",
    deadline: "Tomorrow at 5:00 PM",
    deadlineDaysLeft: 1,
    status: "Closing Today",
    winProbability: 78,
    competitionLevel: "Moderate",
    biddersCount: 5,
    complexity: 4,
    roiScore: 88,
    scopeSummary:
      "Comprehensive multi-region cloud migration including legacy IBM mainframe decommissioning, Kubernetes orchestration, zero-trust network deployment, and 24/7 SRE monitoring across 12 transit hubs.",
    keyRequirements: [
      { text: "ISO/IEC 27001 & SOC 2 Type II Certified", satisfied: true, note: "Verified in Company Vault" },
      { text: "5+ years experience in Federal/State transit systems", satisfied: true, note: "Matches 2024 TxDOT project" },
      { text: "FedRAMP High authorized cloud platform partner", satisfied: true, note: "AWS & GCP Premier Tier verified" },
      { text: "Local key personnel within 50 miles of Austin HQ", satisfied: true, note: "Core lead team based in Austin" },
      { text: "Performance Bond of 10% total contract value", satisfied: false, note: "Underwriter approval pending" },
    ],
    suggestedActions: [
      "Review technical architecture section 4.2 to confirm dual-region failover latency SLA (<15ms).",
      "Attach TxDOT 2024 Past Performance reference letter from Client Archive.",
      "Calibrate milestone 3 pricing to benchmark under the $4.5M median competitor threshold.",
    ],
    riskFactors: [
      {
        title: "Aggressive Cutover Timeline",
        desc: "Phase 1 requires zero-downtime database replication within 60 days of award.",
        severity: "medium",
      },
      {
        title: "Incumbent Vendor Defense",
        desc: "Incumbent has operated legacy systems for 7 years; proposal must highlight 35% operational savings.",
        severity: "high",
      },
      {
        title: "Liquidated Damages Clause",
        desc: "Clause 14.8 imposes $5,000/day penalty for cutover delays exceeding 72 hours.",
        severity: "medium",
      },
    ],
    documents: [
      { name: "RFP-DOT-2026-Specification-Master.pdf", type: "PDF", size: "14.2 MB", pages: 128, mandatory: true },
      { name: "Section-B-Pricing-Schedule.xlsx", type: "XLSX", size: "2.4 MB", pages: 6, mandatory: true },
      { name: "Technical-Requirements-Matrix-v2.pdf", type: "PDF", size: "5.8 MB", pages: 44, mandatory: true },
      { name: "General-Terms-And-Conditions.pdf", type: "PDF", size: "1.9 MB", pages: 32, mandatory: false },
    ],
    contactOfficer: {
      name: "Marcus Vance",
      title: "Chief Procurement Officer, Information Systems",
      email: "m.vance@dot.texas.gov",
      phone: "+1 (512) 463-8588",
    },
    timeline: [
      { title: "RFP Publication", date: "Aug 12, 2026", status: "completed" },
      { title: "Pre-Bid Conference & Q&A", date: "Aug 26, 2026", status: "completed" },
      { title: "Final Addenda Issued", date: "Sep 02, 2026", status: "completed" },
      { title: "Bid Submission Deadline", date: "Sep 11, 2026", status: "current" },
      { title: "Technical Oral Presentations", date: "Sep 22, 2026", status: "upcoming" },
      { title: "Final Award Decision", date: "Oct 05, 2026", status: "upcoming" },
    ],
  },
  {
    id: "tender-002",
    title: "Regional Hospital AI Diagnostics & Integrated Medical Records Platform",
    department: "State Health & Human Services Commission",
    refNumber: "HHS-MED-2026-104",
    value: "$7,200,000",
    rawValue: 7200000,
    location: "Houston / Dallas Medical Center",
    deadline: "In 6 days (Sep 16, 2026)",
    deadlineDaysLeft: 6,
    status: "Active",
    winProbability: 72,
    competitionLevel: "Moderate",
    biddersCount: 4,
    complexity: 5,
    roiScore: 92,
    scopeSummary:
      "Turnkey deployment of an AI-assisted diagnostic imaging triage pipeline integrated with HL7/FHIR electronic health records across 8 regional public hospital campuses.",
    keyRequirements: [
      { text: "HIPAA, HITECH & Texas Medical Board Compliance", satisfied: true, note: "Full compliance audit passed" },
      { text: "HL7/FHIR v4.0 API integration certified", satisfied: true, note: "Pre-built connectors available" },
      { text: "Sub-second imaging inference for acute trauma cases", satisfied: true, note: "Benchmarked at 450ms" },
      { text: "Dedicated on-premise edge compute appliances", satisfied: false, note: "OEM hardware quote required" },
    ],
    suggestedActions: [
      "Incorporate clinical safety trial results for stroke imaging sensitivity (99.2%).",
      "Attach BAA (Business Associate Agreement) pre-signed draft.",
      "Finalize edge server hardware delivery timeline with Dell Healthcare OEM.",
    ],
    riskFactors: [
      {
        title: "Strict BAA Liability Indemnification",
        desc: "Contract specifies uncapped liability for patient data breaches originating from AI pipeline.",
        severity: "high",
      },
      {
        title: "Hardware Supply Chain Lead Time",
        desc: "GPU edge nodes must be deployed on-site within 45 days.",
        severity: "medium",
      },
    ],
    documents: [
      { name: "RFP-HHS-AI-Diagnostics-Full.pdf", type: "PDF", size: "22.5 MB", pages: 184, mandatory: true },
      { name: "Clinical-Integration-Guidelines.pdf", type: "PDF", size: "8.1 MB", pages: 62, mandatory: true },
      { name: "Pricing-Model-Fee-Schedule.xlsx", type: "XLSX", size: "1.8 MB", pages: 4, mandatory: true },
    ],
    contactOfficer: {
      name: "Dr. Eleanor Sterling",
      title: "Director of Clinical Informatics",
      email: "eleanor.sterling@hhs.texas.gov",
      phone: "+1 (713) 792-2121",
    },
    timeline: [
      { title: "RFP Issued", date: "Aug 01, 2026", status: "completed" },
      { title: "Written Inquiry Deadline", date: "Aug 20, 2026", status: "completed" },
      { title: "Submission Closing", date: "Sep 16, 2026", status: "current" },
      { title: "Clinical Demonstration", date: "Sep 30, 2026", status: "upcoming" },
      { title: "Contract Signing", date: "Oct 18, 2026", status: "upcoming" },
    ],
  },
  {
    id: "tender-003",
    title: "Smart Municipal Traffic Optimization & Computer Vision Sensor Grid",
    department: "City of San Antonio — Smart City Department",
    refNumber: "COSA-ITS-2026-339",
    value: "$3,150,000",
    rawValue: 3150000,
    location: "San Antonio, TX",
    deadline: "In 12 days (Sep 22, 2026)",
    deadlineDaysLeft: 12,
    status: "Active",
    winProbability: 84,
    competitionLevel: "Low",
    biddersCount: 3,
    complexity: 3,
    roiScore: 85,
    scopeSummary:
      "Installation and AI analytics edge software for 350 intersections, automating adaptive signal timings, pedestrian detection, and emergency vehicle preemption.",
    keyRequirements: [
      { text: "NEMA TS2 traffic controller compatibility", satisfied: true, note: "Validated with Siemens & Econolite" },
      { text: "Edge processing with 99.9% uptime SLA", satisfied: true, note: "IP67 ruggedized unit specified" },
      { text: "City IT fiber network optical integration", satisfied: true, note: "Conforms to 10G municipal network" },
    ],
    suggestedActions: [
      "Highlight our 18% congestion reduction case study from Phoenix pilot.",
      "Emphasize emergency vehicle preemption response time reduction of 42 seconds.",
    ],
    riskFactors: [
      {
        title: "Permitting and Bucket Truck Access",
        desc: "City right-of-way permits require night work coordination.",
        severity: "low",
      },
    ],
    documents: [
      { name: "RFP-COSA-Traffic-Sensors-2026.pdf", type: "PDF", size: "11.4 MB", pages: 96, mandatory: true },
      { name: "Intersection-Inventory-List.xlsx", type: "XLSX", size: "4.2 MB", pages: 12, mandatory: true },
    ],
    contactOfficer: {
      name: "Arthur Ramos",
      title: "ITS Project Director",
      email: "arthur.ramos@sanantonio.gov",
      phone: "+1 (210) 207-8000",
    },
    timeline: [
      { title: "Solicitation Released", date: "Aug 15, 2026", status: "completed" },
      { title: "Site Inspections", date: "Aug 28, 2026", status: "completed" },
      { title: "Proposals Due", date: "Sep 22, 2026", status: "upcoming" },
      { title: "Council Approval", date: "Oct 12, 2026", status: "upcoming" },
    ],
  },
  {
    id: "tender-004",
    title: "Statewide Cyber Threat Intelligence & Incident Response Retainer",
    department: "Department of Information Resources (DIR)",
    refNumber: "DIR-CISO-2026-05",
    value: "$5,400,000",
    rawValue: 5400000,
    location: "Austin, TX (Hybrid)",
    deadline: "In 18 days (Sep 28, 2026)",
    deadlineDaysLeft: 18,
    status: "Active",
    winProbability: 65,
    competitionLevel: "High",
    biddersCount: 7,
    complexity: 4,
    roiScore: 79,
    scopeSummary:
      "Rapid-response 24/7 DFIR support, dark web reconnaissance, credential stuffing mitigation, and simulated red-teaming exercises for all state government agencies.",
    keyRequirements: [
      { text: "Secret or Top Secret cleared key investigators", satisfied: true, note: "6 team members cleared" },
      { text: "1-hour on-site response time to Capitol complex", satisfied: true, note: "Austin SOC within 4 miles" },
      { text: "CISA Cyber Incident Reporting framework compliance", satisfied: true, note: "Automated workflow in place" },
    ],
    suggestedActions: [
      "Bundle free ransomware negotiation desk services to differentiate against Tier 1 defense contractors.",
      "Submit joint proposal with our designated minority sub-contractor to maximize HUB scoring.",
    ],
    riskFactors: [
      {
        title: "Tier 1 Competitor Bidding",
        desc: "Mandiant and CrowdStrike are expected to bid aggressively on DIR framework.",
        severity: "high",
      },
    ],
    documents: [
      { name: "DIR-CISO-RFP-Master.pdf", type: "PDF", size: "18.3 MB", pages: 140, mandatory: true },
      { name: "HUB-Subcontracting-Plan.pdf", type: "PDF", size: "2.1 MB", pages: 14, mandatory: true },
    ],
    contactOfficer: {
      name: "Col. Sarah Jenkins (Ret.)",
      title: "State CISO Advisory Director",
      email: "s.jenkins@dir.texas.gov",
      phone: "+1 (512) 475-4700",
    },
    timeline: [
      { title: "RFP Posted", date: "Aug 10, 2026", status: "completed" },
      { title: "Q&A Clarifications", date: "Sep 01, 2026", status: "completed" },
      { title: "Deadline for Responses", date: "Sep 28, 2026", status: "upcoming" },
      { title: "Vendor Demos", date: "Oct 15, 2026", status: "upcoming" },
    ],
  },
  {
    id: "tender-005",
    title: "Modernization of Public Water Treatment SCADA & Telemetry Systems",
    department: "Lower Colorado River Authority (LCRA)",
    refNumber: "LCRA-WTR-2026-44",
    value: "$2,650,000",
    rawValue: 2650000,
    location: "Travis & Burnet Counties, TX",
    deadline: "In 25 days (Oct 05, 2026)",
    deadlineDaysLeft: 25,
    status: "Opening Soon",
    winProbability: 81,
    competitionLevel: "Low",
    biddersCount: 3,
    complexity: 3,
    roiScore: 86,
    scopeSummary:
      "Upgrade of legacy Allen-Bradley and Modicon RTUs to modern cyber-secure IEC 62443 certified industrial controllers, cellular satellite failover telemetry, and central HMI screens.",
    keyRequirements: [
      { text: "Licensed Professional Engineer (PE) stamped designs", satisfied: true, note: "Texas PE on staff" },
      { text: "EPA Critical Infrastructure cybersecurity certification", satisfied: true, note: "Ready" },
    ],
    suggestedActions: [
      "Include telemetry battery backup specs rated for extreme heat (120°F).",
      "Offer 3-year warranty on solar-powered remote RTU enclosures.",
    ],
    riskFactors: [
      {
        title: "Remote Rugged Field Sites",
        desc: "8 locations require off-road vehicle transport and solar power installations.",
        severity: "medium",
      },
    ],
    documents: [
      { name: "LCRA-SCADA-Modernization.pdf", type: "PDF", size: "16.1 MB", pages: 112, mandatory: true },
    ],
    contactOfficer: {
      name: "Greg Thornton",
      title: "Senior Engineering Manager",
      email: "greg.thornton@lcra.org",
      phone: "+1 (512) 578-3200",
    },
    timeline: [
      { title: "Solicitation Announced", date: "Sep 01, 2026", status: "completed" },
      { title: "Pre-Bid Site Visit", date: "Sep 15, 2026", status: "upcoming" },
      { title: "Bid Submission", date: "Oct 05, 2026", status: "upcoming" },
    ],
  },
  {
    id: "tender-006",
    title: "Department of Corrections Automated Inmate Health & Telemedicine Network",
    department: "Texas Department of Criminal Justice (TDCJ)",
    refNumber: "TDCJ-HLTH-2026-19",
    value: "$6,100,000",
    rawValue: 6100000,
    location: "Huntsville, TX",
    deadline: "Awarded Yesterday",
    deadlineDaysLeft: 0,
    status: "Awarded",
    winProbability: 95,
    competitionLevel: "Moderate",
    biddersCount: 4,
    complexity: 4,
    roiScore: 94,
    scopeSummary:
      "Secure high-bandwidth encrypted tele-health kiosks connecting 32 correctional facilities with UTMB Galveston medical specialists.",
    keyRequirements: [
      { text: "CJIS security clearance for all field engineers", satisfied: true, note: "Cleared" },
      { text: "Tamper-proof stainless steel kiosk hardware", satisfied: true, note: "Certified" },
    ],
    suggestedActions: ["Archive winning proposal templates for upcoming county jail solicitations."],
    riskFactors: [],
    documents: [{ name: "Award-Notification-TDCJ-2026.pdf", type: "PDF", size: "1.2 MB", pages: 8, mandatory: false }],
    contactOfficer: {
      name: "Brenda Watkins",
      title: "Procurement Director",
      email: "brenda.watkins@tdcj.texas.gov",
      phone: "+1 (936) 295-6371",
    },
    timeline: [
      { title: "Award Declared", date: "Sep 09, 2026", status: "completed" },
      { title: "Contract Execution", date: "Sep 20, 2026", status: "upcoming" },
    ],
  },
];

export const MOCK_COMPANY_INFO = {
  legalName: "Vericore Technologies Inc.",
  tradeName: "Vericore Solutions",
  registrationNumber: "TX-CORP-9482910-B",
  industry: "Information Technology & Enterprise Government Systems",
  taxId: "GSTIN/EIN: 74-2984102-US",
  website: "https://vericore.ai",
  headquarters: "401 Congress Ave, Suite 2600, Austin, TX 78701",
  employeeCount: "148 Full-time Professionals",
  annualRevenue: "$32,500,000 USD",
  clearanceLevel: "Secret Facility Clearance (FCL) / CJIS Certified",
  capabilities: [
    "Enterprise Cloud Migration & Kubernetes",
    "ISO 27001 / SOC 2 Type II Certified",
    "Zero-Trust Architecture & NIST 800-53",
    "Real-time Computer Vision & Edge AI",
    "Government Procurement Compliance (FAR/DFARS)",
    "HL7 / FHIR Health Informatics",
    "SCADA / Telemetry Systems Modernization",
  ],
  uploadedKnowledgeDocs: [
    { name: "Vericore_Master_Capability_Statement_2026.pdf", size: "8.4 MB", date: "Sep 01, 2026", status: "Indexed in AI Memory" },
    { name: "TxDOT_Cloud_Migration_Case_Study_2024.pdf", size: "4.2 MB", date: "Aug 15, 2026", status: "Indexed in AI Memory" },
    { name: "ISO_27001_SOC2_Auditors_Report_Clean.pdf", size: "3.1 MB", date: "Jul 22, 2026", status: "Indexed in AI Memory" },
    { name: "Past_Performance_Evaluation_Ratings_PPIRS.pdf", size: "2.8 MB", date: "Jun 10, 2026", status: "Indexed in AI Memory" },
  ],
};

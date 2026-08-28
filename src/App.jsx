import React, { useState, useMemo } from "react";

/**
 * Preventive Care Tracker — FM clinic
 * USPSTF A/B screenings + labs · ACIP vaccines
 * ------------------------------------------------------------------
 * Rules are DATA. The engine only filters and sorts.
 *
 * rule.evaluate(p) -> null | { status, range, detail, orders[], because }
 *   status  'due' | 'discuss' | 'upcoming'
 *   range   the screening age range, shown in the pill  e.g. "45–75"
 *           or a non-age trigger: "Risk-based", "Pregnancy", "Annual"
 *   orders  [{ text, alt? }]  alt:true renders as an "or" alternative
 *
 * Numeric inputs are held as STRINGS so the field can be empty while
 * typing (prevents 0 -> "038"). toNum() coerces at the engine boundary.
 */

// ---- tokens --------------------------------------------------------------
const T = {
  bg: "#EAEFF0", surface: "#FFFFFF", ink: "#16232B",
  muted: "#5A6B75", faint: "#8A99A1", line: "#D7E0E3",
  teal: "#0E7C6B", tealDeep: "#0A5C50",
};
const CAT = {
  screening: { name: "Screenings", color: "#0E7C6B", tint: "#E4F1EE", note: "Imaging, procedures, exams, questionnaires" },
  lab:       { name: "Labs & diagnostics", color: "#5B3FBF", tint: "#EDE9FB", note: "Orderable as a panel" },
  vaccine:   { name: "Vaccines", color: "#A21C64", tint: "#FBE9F1", note: "ACIP, not USPSTF. Flu, COVID and RSV shift seasonally — verify." },
};
const ST = {
  due:      { fg: "#B45309", bg: "#FEF3E2" },
  discuss:  { fg: "#4338CA", bg: "#EEEEFB" },
  upcoming: { fg: "#5A6B75", bg: "#F1F5F6" },
};
const MONO = 'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace';

// order helpers
const o  = (text) => ({ text });
const or = (text) => ({ text, alt: true });

// ---- rules ---------------------------------------------------------------
const RULES = [
  // ===================== SCREENINGS =====================
  {
    id: "htn", cat: "screening", title: "Blood pressure", grade: "A", source: "USPSTF", reviewed: 2021, priority: 20,
    evaluate: (p) => p.age >= 18 ? {
      status: "due", range: "18+",
      detail: "Office BP. Confirm with out-of-office readings before diagnosing.",
      orders: [o("Office blood pressure"), o("Home or ambulatory BP monitoring to confirm")],
      because: "All adults 18 and older",
    } : null,
  },
  {
    id: "tobacco", cat: "screening", title: "Tobacco use & cessation", grade: "A", source: "USPSTF", reviewed: 2021,
    priority: (p) => (p.smokeStatus === "current" ? 8 : 40),
    evaluate: (p) => {
      if (p.age < 18) return null;
      if (p.smokeStatus === "current") return {
        status: "due", range: "18+",
        detail: "Advise to quit. Offer pharmacotherapy plus behavioral support.",
        orders: [o("Varenicline"), or("Nicotine replacement therapy"), or("Bupropion SR"), o("Refer: quitline or cessation counseling")],
        because: "Current smoker",
      };
      return { status: "due", range: "18+", detail: "Ask about use, advise and assist as needed.", orders: [o("Tobacco use history")], because: "All adults — ask and advise" };
    },
  },
  {
    id: "crc", cat: "screening", title: "Colorectal cancer", grade: "A / B", source: "USPSTF", reviewed: 2021, priority: 10,
    evaluate: (p) => {
      if (p.age >= 45 && p.age <= 75) return {
        status: "due", range: "45–75",
        detail: p.famHxCRC
          ? "Family history may warrant an earlier start or shorter interval — specialty guidance, outside USPSTF average-risk scope."
          : "Any USPSTF-endorsed strategy.",
        orders: [o("Colonoscopy, screening — q10y"), or("FIT — annual"), or("FIT-DNA — q3y")],
        because: p.famHxCRC ? "Age 45–75, family history colorectal cancer" : "Age 45–75, average risk",
      };
      if (p.age >= 76 && p.age <= 85) return {
        status: "discuss", range: "76–85",
        detail: "Selective. Individualize by health status, prior screening and preference.",
        orders: [o("Discuss risk and benefit")], because: "Age 76–85",
      };
      if (p.age >= 18 && p.age < 45) return { status: "upcoming", range: "45–75", detail: "Routine screening begins at 45.", orders: [], because: "Under 45" };
      return null;
    },
  },
  {
    id: "lung", cat: "screening", title: "Lung cancer", grade: "B", source: "USPSTF", reviewed: 2021, priority: 11,
    evaluate: (p) => {
      const ok = p.packYears >= 20 && (p.smokeStatus === "current" || (p.smokeStatus === "former" && p.quitYears < 15));
      if (p.age >= 50 && p.age <= 80 && ok) return {
        status: "due", range: "50–80",
        detail: "Stop once quit 15 years or life expectancy is limited.",
        orders: [o("CT chest, low-dose, lung cancer screening — annual")],
        because: `Age 50–80, ${p.packYears} pack-years, ${p.smokeStatus === "current" ? "current smoker" : `quit ${p.quitYears} years ago`}`,
      };
      return null;
    },
  },
  {
    id: "breast", cat: "screening", title: "Breast cancer", grade: "B", source: "USPSTF", reviewed: 2024, priority: 12,
    evaluate: (p) => {
      if (!p.breastTissue) return null;
      if (p.age >= 40 && p.age <= 74) return {
        status: "due", range: "40–74", detail: "Biennial.",
        orders: [o("Mammogram, screening, bilateral — q2y")],
        because: "Breast tissue present, age 40–74",
      };
      if (p.age >= 30 && p.age < 40) return { status: "upcoming", range: "40–74", detail: "Begins at 40.", orders: [], because: "Under 40" };
      return null;
    },
  },
  {
    id: "cervical", cat: "screening", title: "Cervical cancer", grade: "A", source: "USPSTF", reviewed: 2018, priority: 12,
    evaluate: (p) => {
      if (!p.cervix) return null;
      const immuno = p.immunocompromised ? " Immunosuppression shortens the interval and continues screening past 65." : "";
      if (p.age >= 21 && p.age <= 29) return {
        status: "due", range: "21–65", detail: "Cytology alone in this age band." + immuno,
        orders: [o("Pap cytology — q3y")], because: "Cervix present, age 21–29",
      };
      if (p.age >= 30 && p.age <= 65) return {
        status: "due", range: "21–65", detail: immuno.trim() || "Three acceptable strategies.",
        orders: [o("hrHPV, primary — q5y"), or("Pap + HPV co-test — q5y"), or("Pap cytology — q3y")],
        because: "Cervix present, age 30–65",
      };
      if (p.age >= 15 && p.age < 21) return { status: "upcoming", range: "21–65", detail: "Begins at 21.", orders: [], because: "Under 21" };
      return null;
    },
  },
  {
    id: "aaa", cat: "screening", title: "Abdominal aortic aneurysm", grade: "B", source: "USPSTF", reviewed: 2019, priority: 25,
    evaluate: (p) => (p.sexAtBirth === "male" && p.age >= 65 && p.age <= 75 && p.smokeStatus !== "never") ? {
      status: "due", range: "65–75", detail: "One time only.",
      orders: [o("Ultrasound abdominal aorta, AAA screening")],
      because: "Male, age 65–75, ever smoked",
    } : null,
  },
  {
    id: "osteo", cat: "screening", title: "Osteoporosis", grade: "B", source: "USPSTF", reviewed: 2018, priority: 22,
    evaluate: (p) => {
      if (p.sexAtBirth !== "female") return null;
      if (p.age >= 65) return { status: "due", range: "65+", detail: "", orders: [o("DXA, central — hip and spine")], because: "Female, age 65 and older" };
      if (p.postmenopausal) return {
        status: "due", range: "Postmenopausal < 65",
        detail: "Screen if fracture risk equals or exceeds that of a 65-year-old.",
        orders: [o("FRAX fracture risk calculation"), o("DXA, central — if FRAX qualifies")],
        because: "Postmenopausal, under 65",
      };
      return null;
    },
  },
  {
    id: "depression", cat: "screening", title: "Depression", grade: "B", source: "USPSTF", reviewed: 2023, priority: 19,
    evaluate: (p) => p.age >= 18 ? { status: "due", range: "18+", detail: "Includes perinatal patients.", orders: [o("PHQ-2, reflex to PHQ-9")], because: "All adults" } : null,
  },
  {
    id: "anxiety", cat: "screening", title: "Anxiety", grade: "B", source: "USPSTF", reviewed: 2023, priority: 21,
    evaluate: (p) => (p.age >= 18 && p.age <= 64) ? { status: "due", range: "18–64", detail: "", orders: [o("GAD-7")], because: "Adults 64 and under" } : null,
  },
  {
    id: "alcohol", cat: "screening", title: "Unhealthy alcohol use", grade: "B", source: "USPSTF", reviewed: 2018, priority: 23,
    evaluate: (p) => p.age >= 18 ? { status: "due", range: "18+", detail: "Brief counseling if positive.", orders: [o("AUDIT-C")], because: "All adults 18 and older" } : null,
  },
  {
    id: "drug", cat: "screening", title: "Unhealthy drug use", grade: "B", source: "USPSTF", reviewed: 2020, priority: 29,
    evaluate: (p) => p.age >= 18 ? { status: "due", range: "18+", detail: "Ask when treatment services can be offered.", orders: [o("Single-item drug use screen")], because: "All adults 18 and older" } : null,
  },
  {
    id: "ipv", cat: "screening", title: "Intimate partner violence", grade: "B", source: "USPSTF", reviewed: 2018, priority: 30,
    evaluate: (p) => (p.sexAtBirth === "female" && p.age >= 15 && p.age <= 49) ? {
      status: "due", range: "15–49", detail: "Provide or refer to support services.",
      orders: [o("HITS screen"), or("HARK screen")], because: "Woman of reproductive age",
    } : null,
  },
  {
    id: "brca", cat: "screening", title: "BRCA risk assessment", grade: "B", source: "USPSTF", reviewed: 2019, priority: 25,
    evaluate: (p) => (p.sexAtBirth === "female" && p.famHxBRCA) ? {
      status: "due", range: "Family hx",
      detail: "Risk tool first. Refer for genetic counseling and testing only if positive.",
      orders: [o("Familial risk assessment tool — B-RST or 7-Q"), o("Refer: genetic counseling if positive")],
      because: "Female, family history breast, ovarian or BRCA",
    } : null,
  },
  {
    id: "folate", cat: "screening", title: "Folic acid, preconception", grade: "A", source: "USPSTF", reviewed: 2023, priority: 31,
    evaluate: (p) => (p.sexAtBirth === "female" && !p.postmenopausal && p.age >= 15 && p.age <= 49 && !p.pregnant) ? {
      status: "due", range: "15–49", detail: "For anyone who could become pregnant.",
      orders: [o("Folic acid 400–800 mcg PO daily")], because: "Could become pregnant",
    } : null,
  },
  {
    id: "asa-pre", cat: "screening", title: "Aspirin, preeclampsia prevention", grade: "B", source: "USPSTF", reviewed: 2021, priority: 14,
    evaluate: (p) => (p.pregnant && p.highRiskPreg) ? {
      status: "due", range: "Pregnancy", detail: "Start after 12 weeks.",
      orders: [o("Aspirin 81 mg PO daily")], because: "High-risk pregnancy",
    } : null,
  },

  // ===================== LABS & DIAGNOSTICS =====================
  {
    id: "dm", cat: "lab", title: "Prediabetes & type 2 diabetes", grade: "B", source: "USPSTF", reviewed: 2021, priority: 15,
    evaluate: (p) => {
      if (p.diabetes) return null;
      if (p.bmi == null || p.bmi < 25) return null;
      if (p.age >= 35 && p.age <= 70) return {
        status: "due", range: "35–70", detail: "Repeat at least every 3 years if normal.",
        orders: [o("Hemoglobin A1c"), or("Fasting plasma glucose"), or("2-hour OGTT")],
        because: `Age 35–70, BMI ${p.bmi}`,
      };
      if (p.age >= 18 && p.age < 35) return { status: "upcoming", range: "35–70", detail: "Begins at 35 for overweight adults.", orders: [], because: "BMI qualifies, under 35" };
      return null;
    },
  },
  {
    id: "statin", cat: "lab", title: "ASCVD risk & statin", grade: "B", source: "USPSTF", reviewed: 2022, priority: 18,
    evaluate: (p) => {
      if (p.age < 40 || p.age > 75) return null;
      const rf = [];
      if (p.diabetes) rf.push("diabetes");
      if (p.htn) rf.push("hypertension");
      if (p.smokeStatus === "current") rf.push("current smoker");
      if (p.bmi != null && p.bmi >= 30) rf.push(`BMI ${p.bmi}`);
      if (p.ckd) rf.push("CKD");
      if (p.adversePregOutcome) rf.push("adverse pregnancy outcome");
      return {
        status: "due", range: "40–75",
        detail: rf.length ? "Risk factors present. Offer a statin if 10-year risk is 10% or higher." : "Statin if at least one risk factor and 10-year risk is 10% or higher.",
        orders: [o("Lipid panel, fasting"), o("Pooled Cohort Equations, 10-year ASCVD risk")],
        because: rf.length ? `Age 40–75 — ${rf.join(", ")}` : "Age 40–75",
      };
    },
  },
  {
    id: "hiv", cat: "lab", title: "HIV", grade: "A", source: "USPSTF", reviewed: 2019, priority: 16,
    evaluate: (p) => {
      if (p.pregnant) return { status: "due", range: "Pregnancy", detail: "Screen this pregnancy.", orders: [o("HIV-1/2 antigen/antibody combo")], because: "Pregnant" };
      if (p.age >= 15 && p.age <= 65) return {
        status: "due", range: "15–65", detail: "At least once. Repeat if risk is ongoing.",
        orders: [o("HIV-1/2 antigen/antibody combo")],
        because: p.stiRisk ? "Age 15–65, increased risk" : "Age 15–65, screen at least once",
      };
      return null;
    },
  },
  {
    id: "hcv", cat: "lab", title: "Hepatitis C", grade: "B", source: "USPSTF", reviewed: 2020, priority: 17,
    evaluate: (p) => (p.age >= 18 && p.age <= 79) ? {
      status: "due", range: "18–79", detail: "At least once.",
      orders: [o("HCV antibody with reflex to HCV RNA")], because: "Age 18–79, one time",
    } : null,
  },
  {
    id: "hbv", cat: "lab", title: "Hepatitis B", grade: "A / B", source: "USPSTF", reviewed: 2020, priority: 26,
    evaluate: (p) => {
      if (p.pregnant) return { status: "due", range: "Pregnancy", detail: "At the first prenatal visit.", orders: [o("HBsAg")], because: "Pregnant" };
      if (p.infectionRisk || p.immunocompromised) return {
        status: "due", range: "Risk-based", detail: "",
        orders: [o("HBsAg"), o("Anti-HBc"), o("Anti-HBs")],
        because: "Increased risk — high-prevalence origin, injection drug use, HIV",
      };
      return null;
    },
  },
  {
    id: "syphilis", cat: "lab", title: "Syphilis", grade: "A", source: "USPSTF", reviewed: 2022, priority: 27,
    evaluate: (p) => {
      if (p.pregnant) return { status: "due", range: "Pregnancy", detail: "Early in pregnancy.", orders: [o("RPR with reflex titer")], because: "Pregnant" };
      if (p.stiRisk) return { status: "due", range: "Risk-based", detail: "Repeat per ongoing risk.", orders: [o("RPR with reflex titer")], because: "Increased risk" };
      return null;
    },
  },
  {
    id: "ctgc", cat: "lab", title: "Chlamydia & gonorrhea", grade: "B", source: "USPSTF", reviewed: 2021, priority: 24,
    evaluate: (p) => {
      if (p.sexAtBirth !== "female" || !p.sexuallyActive) return null;
      if (p.age <= 24 || p.stiRisk) return {
        status: "due", range: p.age <= 24 ? "≤ 24, sexually active" : "Risk-based",
        detail: "Test at all appropriate anatomic sites.",
        orders: [o("Chlamydia/gonorrhea NAAT — urine or site-specific")],
        because: p.age <= 24 ? "Sexually active female 24 and under" : "Sexually active female, increased risk",
      };
      return null;
    },
  },
  {
    id: "ltbi", cat: "lab", title: "Latent TB infection", grade: "B", source: "USPSTF", reviewed: 2023, priority: 28,
    evaluate: (p) => (p.tbRisk || p.immunocompromised) ? {
      status: "due", range: "Risk-based", detail: "",
      orders: [o("IGRA — QuantiFERON or T-SPOT"), or("Tuberculin skin test")],
      because: p.immunocompromised ? "Immunosuppression" : "Increased risk — high-prevalence origin or known contact",
    } : null,
  },
  {
    id: "gdm", cat: "lab", title: "Gestational diabetes", grade: "B", source: "USPSTF", reviewed: 2021, priority: 14,
    evaluate: (p) => {
      if (!p.pregnant) return null;
      if (p.gestWeeks >= 24) return {
        status: "due", range: "Pregnancy ≥ 24 wk", detail: "",
        orders: [o("50-g glucose challenge, reflex 100-g OGTT"), or("75-g 2-hour OGTT")],
        because: "Pregnant, 24 weeks or more",
      };
      return { status: "upcoming", range: "Pregnancy ≥ 24 wk", detail: "Screen at 24 weeks.", orders: [], because: "Pregnant, under 24 weeks" };
    },
  },

  // ===================== VACCINES =====================
  {
    id: "flu", cat: "vaccine", title: "Influenza", grade: "ACIP", source: "ACIP", reviewed: 2025, priority: 50,
    evaluate: (p) => p.age >= 18 ? { status: "due", range: "Annual, 6 mo+", detail: "This season.", orders: [o("Influenza vaccine, age-appropriate formulation")], because: "Everyone 6 months and older" } : null,
  },
  {
    id: "covid", cat: "vaccine", title: "COVID-19", grade: "ACIP", source: "ACIP", reviewed: 2025, priority: 51,
    evaluate: (p) => p.age >= 18 ? { status: "due", range: "Seasonal", detail: "Guidance shifts each season — verify current ACIP.", orders: [o("COVID-19 vaccine, current formulation")], because: "Adults" } : null,
  },
  {
    id: "tdap", cat: "vaccine", title: "Td / Tdap", grade: "ACIP", source: "ACIP", reviewed: 2020, priority: 52,
    evaluate: (p) => {
      if (p.pregnant) return { status: "due", range: "Each pregnancy, 27–36 wk", detail: "", orders: [o("Tdap")], because: "Pregnant" };
      if (p.age >= 18) return { status: "due", range: "q10 years", detail: "Tdap once if never given, then Td or Tdap boosters.", orders: [o("Td or Tdap booster")], because: "Assess date of last dose" };
      return null;
    },
  },
  {
    id: "pcv", cat: "vaccine", title: "Pneumococcal", grade: "ACIP", source: "ACIP", reviewed: 2024, priority: 53,
    evaluate: (p) => {
      if (p.age >= 50) return { status: "due", range: "50+", detail: "", orders: [o("PCV20"), or("PCV21"), or("PCV15 followed by PPSV23")], because: "Age 50 and older" };
      if (p.age >= 19 && (p.immunocompromised || p.ckd || p.diabetes)) return { status: "due", range: "19–49, risk-based", detail: "", orders: [o("PCV20"), or("PCV21")], because: "Age 19–49 with a risk condition" };
      return null;
    },
  },
  {
    id: "rzv", cat: "vaccine", title: "Zoster", grade: "ACIP", source: "ACIP", reviewed: 2021, priority: 54,
    evaluate: (p) => {
      if (p.age >= 50) return { status: "due", range: "50+", detail: "Two doses, 2 to 6 months apart.", orders: [o("Recombinant zoster vaccine, dose 1"), o("Recombinant zoster vaccine, dose 2")], because: "Age 50 and older" };
      if (p.age >= 19 && p.immunocompromised) return { status: "due", range: "19–49, risk-based", detail: "Two doses, 1 to 2 months apart.", orders: [o("Recombinant zoster vaccine, dose 1"), o("Recombinant zoster vaccine, dose 2")], because: "Age 19–49, immunocompromised" };
      return null;
    },
  },
  {
    id: "hpv", cat: "vaccine", title: "HPV", grade: "ACIP", source: "ACIP", reviewed: 2019, priority: 55,
    evaluate: (p) => {
      if (p.age >= 9 && p.age <= 26) return { status: "due", range: "9–26", detail: "Catch-up through 26 if not already vaccinated. Two or three doses depending on age at initiation.", orders: [o("HPV9 series")], because: "Through age 26" };
      if (p.age >= 27 && p.age <= 45) return { status: "discuss", range: "27–45", detail: "Shared clinical decision-making.", orders: [o("HPV9 series if elected")], because: "Age 27–45" };
      return null;
    },
  },
  {
    id: "hepbvax", cat: "vaccine", title: "Hepatitis B", grade: "ACIP", source: "ACIP", reviewed: 2022, priority: 56,
    evaluate: (p) => {
      if (p.age >= 19 && p.age <= 59) return { status: "due", range: "19–59", detail: "Universal in this age band.", orders: [o("Hepatitis B series")], because: "Age 19–59" };
      if (p.age >= 60) {
        if (p.infectionRisk || p.immunocompromised || p.diabetes) return { status: "due", range: "60+, risk-based", detail: "", orders: [o("Hepatitis B series")], because: "Age 60 and older with a risk indication" };
        return { status: "discuss", range: "60+", detail: "May vaccinate based on preference.", orders: [o("Hepatitis B series if elected")], because: "Age 60 and older, no risk indication" };
      }
      return null;
    },
  },
  {
    id: "rsv", cat: "vaccine", title: "RSV", grade: "ACIP", source: "ACIP", reviewed: 2024, priority: 57,
    evaluate: (p) => {
      if (p.age >= 75) return { status: "due", range: "75+", detail: "Single dose if not previously given.", orders: [o("RSV vaccine, single dose")], because: "Age 75 and older" };
      if (p.age >= 50 && (p.immunocompromised || p.ckd || p.diabetes)) return { status: "due", range: "50–74, risk-based", detail: "", orders: [o("RSV vaccine, single dose")], because: "Age 50–74 at increased risk" };
      if (p.pregnant && p.gestWeeks >= 32 && p.gestWeeks <= 36) return { status: "due", range: "Pregnancy 32–36 wk", detail: "Seasonal.", orders: [o("Maternal RSV vaccine, RSVpreF")], because: "Pregnant, 32 to 36 weeks" };
      return null;
    },
  },
];

// ---- engine --------------------------------------------------------------
const CANCER = ["crc", "lung", "breast", "cervical"];

function runEngine(p) {
  const out = [];
  for (const r of RULES) {
    const res = r.evaluate(p);
    if (!res) continue;
    const priority = typeof r.priority === "function" ? r.priority(p) : r.priority;
    let item = { ...r, ...res, priority };
    if (p.limitedLifeExp && CANCER.includes(r.id) && item.status === "due") {
      item = { ...item, status: "discuss",
        detail: "Lag time to benefit is roughly 10 years. Weigh against competing risks before ordering.",
        because: item.because + " — limited life expectancy flagged" };
    }
    out.push(item);
  }
  const rank = { due: 0, discuss: 1, upcoming: 2 };
  out.sort((a, b) => rank[a.status] - rank[b.status] || a.priority - b.priority);
  return out;
}

// ---- input atoms ---------------------------------------------------------
// strings in state -> field can be empty, so "0" never sticks and 38 stays 38
const toNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontFamily: MONO, fontSize: 11.5, color: T.faint, marginTop: 5 }}>{hint}</span>}
    </label>
  );
}
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "11px 12px", fontSize: 16,
  border: `1px solid ${T.line}`, borderRadius: 9, background: "#fff", color: T.ink, outline: "none",
  fontFamily: MONO,
};
function NumInput({ value, onChange, placeholder, step }) {
  return (
    <input
      type="number" inputMode="decimal" step={step || "1"} placeholder={placeholder}
      style={inputStyle} value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
    />
  );
}
function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "#F1F5F6", padding: 3, borderRadius: 10, border: `1px solid ${T.line}` }}>
      {options.map((op) => {
        const on = value === op.v;
        return (
          <button key={op.v} onClick={() => onChange(op.v)}
            style={{ flex: 1, padding: "10px 6px", fontSize: 14, fontWeight: on ? 700 : 500, borderRadius: 7, border: "none", cursor: "pointer",
              background: on ? "#fff" : "transparent", color: on ? T.tealDeep : T.muted, boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}>
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
function Check({ label, checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer", fontSize: 14.5, color: T.ink, userSelect: "none" }}>
      <span style={{ width: 21, height: 21, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${checked ? T.teal : T.line}`, background: checked ? T.teal : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {checked && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
      </span>
      {label}
    </div>
  );
}
function GroupLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase", color: T.muted, marginBottom: 2, marginTop: 4 }}>{children}</div>;
}
function Divider() {
  return <div style={{ borderTop: `1px solid ${T.line}`, margin: "14px 0 10px" }} />;
}

// ---- result card ---------------------------------------------------------
function OrderRow({ item, color }) {
  if (item.alt) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0 3px 14px" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: ".05em", paddingTop: 2, minWidth: 16 }}>or</span>
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: T.muted, lineHeight: 1.5 }}>{item.text}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "4px 0" }}>
      <span style={{ width: 6, height: 6, borderRadius: 2, background: color, flexShrink: 0, marginTop: 7 }} />
      <span style={{ fontFamily: MONO, fontSize: 13, color: T.ink, fontWeight: 500, lineHeight: 1.5 }}>{item.text}</span>
    </div>
  );
}

function Card({ item }) {
  const c = CAT[item.cat];
  const s = ST[item.status];
  return (
    <div style={{ display: "flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 11, overflow: "hidden", marginBottom: 9 }}>
      <div style={{ width: 5, background: c.color, flexShrink: 0 }} />
      <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 15.5, fontWeight: 700, color: T.ink }}>{item.title}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: ".03em", color: s.fg, background: s.bg, padding: "4px 9px", borderRadius: 20, flexShrink: 0 }}>
            {item.range}
          </span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: T.faint, marginTop: 3 }}>
          {item.source} · {item.grade} · {item.reviewed}
          {item.status === "discuss" && <span style={{ color: ST.discuss.fg, fontWeight: 700 }}>  ·  SHARED DECISION</span>}
          {item.status === "upcoming" && <span style={{ fontWeight: 700 }}>  ·  NOT YET DUE</span>}
        </div>
        {item.detail && <div style={{ fontSize: 13.5, color: T.ink, marginTop: 7, lineHeight: 1.5 }}>{item.detail}</div>}
        {item.orders && item.orders.length > 0 && (
          <div style={{ marginTop: 9, background: c.tint, borderRadius: 8, padding: "9px 11px" }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: c.color, marginBottom: 4 }}>Order</div>
            {item.orders.map((ord, i) => <OrderRow key={i} item={ord} color={c.color} />)}
          </div>
        )}
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: T.muted, marginTop: 8 }}>▸ {item.because}</div>
      </div>
    </div>
  );
}

// ---- defaults ------------------------------------------------------------
const BLANK = {
  age: "", sexAtBirth: "female",
  cervix: true, breastTissue: true, postmenopausal: false,
  pregnant: false, gestWeeks: "", highRiskPreg: false,
  bmi: "",
  smokeStatus: "never", packsPerDay: "", yearsSmoked: "", quitYears: "",
  sexuallyActive: true, stiRisk: false, infectionRisk: false, tbRisk: false,
  diabetes: false, htn: false, ckd: false, adversePregOutcome: false,
  immunocompromised: false, famHxCRC: false, famHxBRCA: false, limitedLifeExp: false,
};

// ---- main ----------------------------------------------------------------
export default function App() {
  const [p, setP] = useState(BLANK);
  const [screen, setScreen] = useState("input");
  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const packYears = useMemo(() => {
    const a = toNum(p.packsPerDay), b = toNum(p.yearsSmoked);
    if (a == null || b == null) return 0;
    return Math.round(a * b * 10) / 10;
  }, [p.packsPerDay, p.yearsSmoked]);

  const patient = useMemo(() => ({
    ...p,
    age: toNum(p.age) ?? -1,
    bmi: toNum(p.bmi),
    gestWeeks: toNum(p.gestWeeks) ?? 0,
    quitYears: toNum(p.quitYears) ?? 0,
    packYears,
  }), [p, packYears]);

  const results = useMemo(() => runEngine(patient), [patient]);
  const ageEntered = toNum(p.age) != null;
  const nDue = results.filter((r) => r.status === "due").length;

  const btn = (bg, fg, border) => ({
    padding: "12px 16px", fontSize: 14.5, fontWeight: 700, borderRadius: 9,
    border: border || "none", background: bg, color: fg, cursor: "pointer", fontFamily: "inherit",
  });

  // ---------- INPUT SCREEN ----------
  if (screen === "input") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: T.ink }}>
        <div style={{ background: T.tealDeep, color: "#fff", padding: "18px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>Preventive Care Tracker</div>
            <div style={{ fontSize: 12, color: "#B8D8D2", fontFamily: MONO, marginTop: 2 }}>USPSTF A/B · ACIP vaccines</div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 16px 110px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Age"><NumInput value={p.age} onChange={(v) => set("age", v)} placeholder="—" /></Field>
              <Field label="BMI"><NumInput value={p.bmi} onChange={(v) => set("bmi", v)} placeholder="—" step="0.1" /></Field>
            </div>

            <Field label="Sex at birth">
              <Seg options={[{ v: "female", label: "Female" }, { v: "male", label: "Male" }]} value={p.sexAtBirth} onChange={(v) => set("sexAtBirth", v)} />
            </Field>

            <Divider />
            <GroupLabel>Anatomy</GroupLabel>
            <Check label="Cervix present" checked={p.cervix} onChange={(v) => set("cervix", v)} />
            <Check label="Breast tissue present" checked={p.breastTissue} onChange={(v) => set("breastTissue", v)} />
            {p.sexAtBirth === "female" && <Check label="Postmenopausal" checked={p.postmenopausal} onChange={(v) => set("postmenopausal", v)} />}

            <Divider />
            <Field label="Smoking">
              <Seg options={[{ v: "never", label: "Never" }, { v: "former", label: "Former" }, { v: "current", label: "Current" }]} value={p.smokeStatus} onChange={(v) => set("smokeStatus", v)} />
            </Field>
            {p.smokeStatus !== "never" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <Field label="Packs per day"><NumInput value={p.packsPerDay} onChange={(v) => set("packsPerDay", v)} placeholder="—" step="0.5" /></Field>
                  <Field label="Years smoked"><NumInput value={p.yearsSmoked} onChange={(v) => set("yearsSmoked", v)} placeholder="—" /></Field>
                </div>
                {p.smokeStatus === "former" && (
                  <Field label="Years since quit"><NumInput value={p.quitYears} onChange={(v) => set("quitYears", v)} placeholder="—" /></Field>
                )}
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: packYears >= 20 ? T.teal : T.faint, marginTop: -6, marginBottom: 6, fontWeight: 600 }}>
                  = {packYears} pack-years{packYears >= 20 ? "   ✓ meets LDCT threshold" : ""}
                </div>
              </>
            )}

            {p.sexAtBirth === "female" && (
              <>
                <Divider />
                <GroupLabel>Pregnancy</GroupLabel>
                <Check label="Currently pregnant" checked={p.pregnant} onChange={(v) => set("pregnant", v)} />
                {p.pregnant && (
                  <div style={{ marginTop: 8 }}>
                    <Field label="Gestational weeks"><NumInput value={p.gestWeeks} onChange={(v) => set("gestWeeks", v)} placeholder="—" /></Field>
                    <Check label="High-risk pregnancy" checked={p.highRiskPreg} onChange={(v) => set("highRiskPreg", v)} />
                  </div>
                )}
              </>
            )}

            <Divider />
            <GroupLabel>Chronic conditions</GroupLabel>
            <Check label="Diabetes" checked={p.diabetes} onChange={(v) => set("diabetes", v)} />
            <Check label="Hypertension" checked={p.htn} onChange={(v) => set("htn", v)} />
            <Check label="CKD" checked={p.ckd} onChange={(v) => set("ckd", v)} />
            <Check label="Immunosuppressed" checked={p.immunocompromised} onChange={(v) => set("immunocompromised", v)} />
            {p.sexAtBirth === "female" && <Check label="Prior adverse pregnancy outcome" checked={p.adversePregOutcome} onChange={(v) => set("adversePregOutcome", v)} />}
            <Check label="Limited life expectancy" checked={p.limitedLifeExp} onChange={(v) => set("limitedLifeExp", v)} />

            <Divider />
            <GroupLabel>Other risk</GroupLabel>
            <Check label="Family hx colorectal cancer" checked={p.famHxCRC} onChange={(v) => set("famHxCRC", v)} />
            <Check label="Family hx breast, ovarian or BRCA" checked={p.famHxBRCA} onChange={(v) => set("famHxBRCA", v)} />
            <Check label="Sexually active" checked={p.sexuallyActive} onChange={(v) => set("sexuallyActive", v)} />
            <Check label="Increased risk STI or HIV" checked={p.stiRisk} onChange={(v) => set("stiRisk", v)} />
            <Check label="Increased risk hepatitis B" checked={p.infectionRisk} onChange={(v) => set("infectionRisk", v)} />
            <Check label="Increased risk latent TB" checked={p.tbRisk} onChange={(v) => set("tbRisk", v)} />
          </div>
        </div>

        {/* sticky action bar */}
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,.97)", borderTop: `1px solid ${T.line}`, padding: "12px 16px", boxShadow: "0 -2px 12px rgba(0,0,0,.06)" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 10 }}>
            <button onClick={() => setP(BLANK)} style={{ ...btn("#fff", T.muted, `1px solid ${T.line}`), flex: "0 0 auto", minWidth: 96 }}>Reset</button>
            <button onClick={() => setScreen("results")} disabled={!ageEntered}
              style={{ ...btn(ageEntered ? T.tealDeep : "#B4C4C7", "#fff"), flex: 1, cursor: ageEntered ? "pointer" : "not-allowed" }}>
              {ageEntered ? "View recommendations" : "Enter an age to continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- RESULTS SCREEN ----------
  const Section = ({ catKey }) => {
    const c = CAT[catKey];
    const items = results.filter((r) => r.cat === catKey);
    const active = items.filter((i) => i.status !== "upcoming");
    const upcoming = items.filter((i) => i.status === "upcoming");
    const due = items.filter((i) => i.status === "due").length;
    const disc = items.filter((i) => i.status === "discuss").length;
    return (
      <div style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: c.color, flexShrink: 0 }} />
          <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: c.color }}>{c.name}</h2>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.faint }}>
            {due} due{disc ? ` · ${disc} discuss` : ""}{upcoming.length ? ` · ${upcoming.length} upcoming` : ""}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 11, paddingLeft: 20 }}>{c.note}</div>
        {active.length === 0 && upcoming.length === 0 &&
          <div style={{ fontSize: 13.5, color: T.faint, padding: "10px 0" }}>Nothing applies with these attributes.</div>}
        {active.map((i) => <Card key={i.id} item={i} />)}
        {upcoming.length > 0 && (
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: T.muted, padding: "6px 0" }}>{upcoming.length} not yet due</summary>
            <div style={{ marginTop: 6, opacity: .72 }}>{upcoming.map((i) => <Card key={i.id} item={i} />)}</div>
          </details>
        )}
      </div>
    );
  };

  const summary = [
    `${patient.age} y`,
    p.sexAtBirth === "female" ? "F" : "M",
    toNum(p.bmi) != null ? `BMI ${toNum(p.bmi)}` : null,
    p.smokeStatus !== "never" ? `${p.smokeStatus} smoker, ${packYears} py` : "never smoker",
    p.pregnant ? `pregnant ${patient.gestWeeks} wk` : null,
  ].filter(Boolean).join("  ·  ");

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: T.ink }}>
      <div style={{ background: T.tealDeep, color: "#fff", padding: "16px 20px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{nDue} due now</div>
          <div style={{ fontSize: 12, color: "#B8D8D2", fontFamily: MONO, marginTop: 3 }}>{summary}</div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 110px" }}>
        <Section catKey="screening" />
        <Section catKey="lab" />
        <Section catKey="vaccine" />

        <div style={{ marginTop: 8, padding: "12px 14px", background: "#FFF9EC", border: "1px solid #EFE0BC", borderRadius: 10, fontSize: 12, color: "#7A6320", lineHeight: 1.55 }}>
          The badge on each card is the <strong>eligible age range or trigger</strong>, not a due date — the app keeps no record of prior screening. Personal reference only, not validated clinical decision support. Confirm against current USPSTF and ACIP before acting. No patient data is stored.
        </div>
      </div>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,.97)", borderTop: `1px solid ${T.line}`, padding: "12px 16px", boxShadow: "0 -2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 10 }}>
          <button onClick={() => setScreen("input")} style={{ ...btn("#fff", T.tealDeep, `1px solid ${T.teal}`), flex: 1 }}>← Edit patient</button>
          <button onClick={() => { setP(BLANK); setScreen("input"); }} style={{ ...btn("#fff", T.muted, `1px solid ${T.line}`), flex: "0 0 auto", minWidth: 96 }}>Reset</button>
        </div>
      </div>
    </div>
  );
}

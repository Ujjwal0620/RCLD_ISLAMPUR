const KIDS_RULES = {
  "SM-I": { admissionFee: 500, monthlyInstallment: 500, durationMonths: 6, grossFee: 3500 },
  "SM-II": { admissionFee: 500, monthlyInstallment: 500, durationMonths: 6, grossFee: 3500 },
  "SM-III": { admissionFee: 600, monthlyInstallment: 500, durationMonths: 6, grossFee: 3600 },
  "SM-IV": { admissionFee: 600, monthlyInstallment: 500, durationMonths: 6, grossFee: 3600 },
  "SM-V": { admissionFee: 700, monthlyInstallment: 500, durationMonths: 6, grossFee: 3700 },
  "SM-VI": { admissionFee: 700, monthlyInstallment: 500, durationMonths: 6, grossFee: 3700 }
};

const DOM_CODES = new Set(["DOM-III", "DOM-V", "DOM-VI", "DOM-VII", "DOM-VIII", "DOM-IX"]);

export function normalizeCourseCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\\s+/g, "").replace(/_/g, "-");
}

export function resolveCourseFeeConfigFromDocument(rawCourseCode, course = null, discountValue = 0) {
  const code = normalizeCourseCode(rawCourseCode);
  const discountAmount = Math.max(0, Number(discountValue || 0));
  if (code === "ROBOTICS") {
    return {
      courseCategory: "ROBOTICS",
      semesterLabel: "ROBOTICS - Year 1",
      feeConfig: { admissionFee: 1000, monthlyInstallment: 1000, durationMonths: 12, admissionIncluded: false, grossFee: 13000, discountAmount, netPayableFee: Math.max(0, 13000 - discountAmount), registrationFee: 0, labCharges: 0, otherCharges: 0, feeRuleSource: "RCLD_ROBOTICS_RULE", configured: true }
    };
  }
  if (KIDS_RULES[code]) {
    const rule = KIDS_RULES[code];
    return {
      courseCategory: "CODING_FOR_KIDS",
      semesterLabel: code,
      feeConfig: { ...rule, admissionIncluded: false, discountAmount, netPayableFee: Math.max(0, rule.grossFee - discountAmount), registrationFee: 0, labCharges: 0, otherCharges: 0, feeRuleSource: "RCLD_CFK_RULE", configured: true }
    };
  }
  if (code === "SC-I") {
    const admissionFee = Number(course?.admissionFee ?? 500);
    const monthlyInstallment = Number(course?.monthlyInstallment ?? course?.monthlyFee ?? 500);
    const durationMonths = Number(course?.durationMonths || 6);
    const grossFee = Number(course?.fee ?? admissionFee + monthlyInstallment * durationMonths);
    return {
      courseCategory: "CODING_FOR_KIDS", semesterLabel: code,
      feeConfig: { admissionFee, monthlyInstallment, durationMonths, admissionIncluded: Boolean(course?.admissionIncludedInTotal), grossFee, discountAmount, netPayableFee: Math.max(0, grossFee - discountAmount), registrationFee: Number(course?.registrationFee || 0), labCharges: Number(course?.labCharges || 0), otherCharges: 0, feeRuleSource: course ? "COURSE_MASTER" : "RCLD_SC_DEFAULT", configured: true }
    };
  }
  if (DOM_CODES.has(code)) {
    return {
      courseCategory: "DOM", semesterLabel: code,
      feeConfig: { admissionFee: 0, monthlyInstallment: 600, durationMonths: 15, admissionIncluded: true, grossFee: 9000, discountAmount, netPayableFee: Math.max(0, 9000 - discountAmount), registrationFee: 0, labCharges: 0, otherCharges: 0, feeRuleSource: "RCLD_DOM_RULE", configured: true }
    };
  }
  if (!course) {
    return {
      courseCategory: "OTHER", semesterLabel: code || "LEGACY",
      feeConfig: { admissionFee: 0, monthlyInstallment: 0, durationMonths: 0, admissionIncluded: false, grossFee: 0, discountAmount: 0, netPayableFee: 0, registrationFee: 0, labCharges: 0, otherCharges: 0, feeRuleSource: "UNCONFIGURED", configured: false }
    };
  }
  const free = /_FREE$/.test(code) || /_FREE$/.test(String(course.code || "").toUpperCase());
  const durationMonths = Number(course.durationMonths || 0);
  const admissionFee = free ? 0 : Number(course.admissionFee || 0);
  const grossFee = free ? 0 : Number(course.fee || 0);
  const admissionIncluded = Boolean(course.admissionIncludedInTotal ?? (Number(course.admissionFee || 0) === 0));
  const registrationFee = free ? 0 : Number(course.registrationFee || 0);
  const labCharges = free ? 0 : Number(course.labCharges || 0);
  const monthlyInstallment = free ? 0 : Number(course.monthlyInstallment || course.monthlyFee || (durationMonths ? Math.ceil(Math.max(0, grossFee - (admissionIncluded ? 0 : admissionFee)) / durationMonths) : 0));
  return {
    courseCategory: "OTHER", semesterLabel: code || "LEGACY",
    feeConfig: { admissionFee, monthlyInstallment, durationMonths, admissionIncluded, grossFee, discountAmount: Math.min(grossFee, discountAmount), netPayableFee: Math.max(0, grossFee - Math.min(grossFee, discountAmount)), registrationFee, labCharges, otherCharges: Number(course.otherCharges || 0), feeRuleSource: free ? "COURSE_MASTER_FREE" : "COURSE_MASTER", configured: true }
  };
}

export async function resolveCourseFeeConfig(rawCourseCode, Course, discountValue = 0) {
  const code = normalizeCourseCode(rawCourseCode);
  const special = code === "ROBOTICS" || code === "SC-I" || DOM_CODES.has(code) || Boolean(KIDS_RULES[code]);
  let course = null;
  if (!special) {
    const baseCode = code.replace(/[-_].*$/, "");
    course = await Course.findOne({ code }).lean() || await Course.findOne({ code: baseCode }).lean();
  } else if (code === "SC-I") {
    course = await Course.findOne({ code: "SC-I" }).lean();
  }
  return resolveCourseFeeConfigFromDocument(code, course, discountValue);
}

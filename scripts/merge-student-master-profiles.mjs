/**
 * Non-destructive Master Student consolidation.
 *
 * Preview only (default):
 *   npm run merge:student-profiles
 *
 * Apply only after reviewing the dry-run report and backing up MongoDB:
 *   npm run merge:student-profiles -- --apply
 *
 * No Student, StudentMaster, StudentEnrollment, fee, or ID-card documents are deleted.
 * Duplicate Master/Enrollment documents are retained and marked with merge pointers.
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import {
  clusterStudentRegistrations,
  normalizeStudentName,
  normalizeIdentityDate,
  normalizeIndianPhones,
  normalizeFatherName,
} from "../lib/student-import/identity-resolution.mjs";

function loadLocalEnvironment() {
  const mode = process.env.NODE_ENV || "development";
  for (const file of [".env." + mode + ".local", ".env.local", ".env." + mode, ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}
loadLocalEnvironment();

const apply = process.argv.includes("--apply");
const clean = value => String(value ?? "").trim();
const codeOf = value => clean(value).replace(/\.0+$/, "");
const dateValue = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : null;
const effectiveDate = item => dateValue(item?.dateOfAdmission || item?.admissionDate || item?.earliestPaymentDate);
const registrationKey = item => [
  codeOf(item.stCode),
  clean(item.courseCode || item.course || item.courseName).toUpperCase(),
  normalizeIdentityDate(item.dateOfAdmission || item.admissionDate || item.earliestPaymentDate),
].join("|");

function identityFromMaster(master) {
  return {
    fullName: master.fullName || master.normalizedFullName || "",
    normalizedFullName: master.normalizedFullName || "",
    alternateNames: master.alternateNames || [],
    dob: master.dob || null,
    sex: master.gender || master.sex || "",
    fatherName: master.fatherName || "",
    phones: [...new Set([...(master.phones || []), ...(master.phoneNumbers || [])])],
    phoneNumbers: [...new Set([...(master.phones || []), ...(master.phoneNumbers || [])])],
    studentCodes: [...new Set([...(master.studentCodes || []), ...(master.stCodes || []), master.primaryStCode, master.currentStCode].filter(Boolean))],
    stCodes: [...new Set([...(master.studentCodes || []), ...(master.stCodes || [])])],
  };
}
function latestRegistration(registrations = []) {
  return [...registrations].sort((a, b) => (effectiveDate(b)?.getTime() || 0) - (effectiveDate(a)?.getTime() || 0))[0] || null;
}
function mergeHistory(...arrays) {
  const map = new Map();
  for (const item of arrays.flat()) {
    if (!item?.stCode) continue;
    const key = registrationKey(item);
    const prior = map.get(key) || {};
    map.set(key, {
      ...prior,
      ...item,
      course: item.course || item.courseName || item.courseCode || prior.course || "Previous Course (Legacy)",
      dateOfAdmission: item.dateOfAdmission || item.admissionDate || prior.dateOfAdmission || null,
      admissionDate: item.admissionDate || item.dateOfAdmission || prior.admissionDate || null,
      formNo: item.formNo || prior.formNo || "",
      qualification: item.qualification || prior.qualification || "",
      rawAddress: item.rawAddress || item.address || prior.rawAddress || "",
      rawStName: item.rawStName || prior.rawStName || "",
      isCurrent: false,
    });
  }
  const rows = [...map.values()].sort((a, b) => (effectiveDate(b)?.getTime() || 0) - (effectiveDate(a)?.getTime() || 0));
  rows.forEach((item, index) => { item.isCurrent = index === 0; });
  return rows;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || (process.env.NODE_ENV !== "production" ? "mongodb://127.0.0.1:27017/rcld_islampur" : "");
  if (!mongoUri) throw new Error("MONGODB_URI is required.");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const mastersCollection = mongoose.connection.collection("student_master_profiles");
  const enrollmentCollection = mongoose.connection.collection("student_enrollments");
  const paymentsCollection = mongoose.connection.collection("student_fee_payments");
  const idCardsCollection = mongoose.connection.collection("idCardIssues");

  const allMasters = await mastersCollection.find({}).toArray();
  const activeMasters = allMasters.filter(item => !item.mergedIntoMasterId && item.isMerged !== true);
  const identityRows = activeMasters.map(master => ({ ...identityFromMaster(master), _id: master._id }));
  const clusters = clusterStudentRegistrations(identityRows);
  const mergeGroups = clusters.filter(group => group.length > 1).map(group => {
    const records = group.map(row => activeMasters.find(master => String(master._id) === String(row._id))).filter(Boolean);
    records.sort((a, b) =>
      (b.legacyStudentIds?.length || 0) - (a.legacyStudentIds?.length || 0)
      || Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl))
      || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    return { canonical: records[0], duplicates: records.slice(1) };
  });

  const mergeMap = new Map();
  for (const group of mergeGroups) for (const duplicate of group.duplicates) mergeMap.set(String(duplicate._id), group.canonical._id);
  const groupReports = mergeGroups.map(group => ({
    canonicalId: String(group.canonical._id),
    canonicalName: group.canonical.fullName || group.canonical.normalizedFullName || "",
    duplicateIds: group.duplicates.map(item => String(item._id)),
    codes: [...new Set([...identityFromMaster(group.canonical).studentCodes, ...group.duplicates.flatMap(item => identityFromMaster(item).studentCodes)])],
  }));

  const duplicateMasterIds = [...mergeMap.keys()].map(id => new mongoose.Types.ObjectId(id));
  const legacyIdsByCanonical = new Map();
  const enrollmentDocs = duplicateMasterIds.length
    ? await enrollmentCollection.find({ studentId: { $in: duplicateMasterIds } }).toArray()
    : [];
  const enrollmentIds = enrollmentDocs.map(item => item._id);
  const allEnrollmentAuditRows = await enrollmentCollection.find({ mergedIntoEnrollmentId: null }).toArray();
  const projectedEnrollmentCounts = new Map();
  for (const item of allEnrollmentAuditRows) {
    const projectedMasterId = mergeMap.get(String(item.studentId)) || String(item.studentId);
    const key = projectedMasterId + "|" + registrationKey(item);
    projectedEnrollmentCounts.set(key, (projectedEnrollmentCounts.get(key) || 0) + 1);
  }
  const projectedDuplicateEnrollmentKeys = [...projectedEnrollmentCounts.values()].filter(count => count > 1).length;
  for (const group of mergeGroups) {
    const canonicalId = group.canonical._id;
    const allGroupIds = [canonicalId, ...group.duplicates.map(item => item._id)];
    const enrollments = await enrollmentCollection.find({ studentId: { $in: allGroupIds } }).toArray();
    const canonicalEnrollments = await enrollmentCollection.find({ studentId: canonicalId }).toArray();
    const canonicalByKey = new Map(canonicalEnrollments.map(item => [registrationKey(item), item]));
    for (const item of enrollments) {
      const match = canonicalByKey.get(registrationKey(item));
      if (match && String(match._id) !== String(item._id)) enrollmentMap.set(String(item._id), match._id);
      else if (String(item.studentId) !== String(canonicalId)) {
        // A unique enrollment can be reassigned in place; the source document remains intact.
        enrollmentMap.set(String(item._id), item._id);
      }
    }
    const legacyIds = [...new Set(allGroupIds.flatMap(id => {
      const source = group.canonical._id && String(group.canonical._id) === String(id)
        ? group.canonical : group.duplicates.find(item => String(item._id) === String(id));
      return (source?.legacyStudentIds || []).map(String);
    }))];
    legacyIdsByCanonical.set(String(canonicalId), legacyIds);
  }

  const importedFeeDuplicateGroups = await paymentsCollection.aggregate([
    { $match: {
      importBatchKey: "UNIFIED_WORKBOOK_IMPORT",
      stCode: { $type: "string", $gt: "" },
      mrNo: { $type: "string", $gt: "" },
      paymentDate: { $type: "date" },
      amountPaid: { $type: "number" },
    } },
    { $group: {
      _id: {
        masterStudentId: { $ifNull: ["$masterStudentId", "$studentId"] },
        stCode: "$stCode", mrNo: "$mrNo", paymentDate: "$paymentDate", amountPaid: "$amountPaid",
      },
      count: { $sum: 1 },
    } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  const importedFeeDuplicateDocs = importedFeeDuplicateGroups.reduce((sum, item) => sum + item.count - 1, 0);

  const report = {
    mode: apply ? "APPLY" : "DRY RUN",
    masterProfilesScanned: allMasters.length,
    activeMasterProfiles: activeMasters.length,
    confidentDuplicateGroups: mergeGroups.length,
    duplicateMasterProfilesToMarkMerged: duplicateMasterIds.length,
    studentEnrollmentRecordsToInspect: enrollmentDocs.length,
    duplicateEnrollmentKeysToRetainAndMark: projectedDuplicateEnrollmentKeys,
    duplicateImportedFeeReceiptsToArchiveWithoutDeleting: importedFeeDuplicateDocs,
    feeRecordsToRelink: duplicateMasterIds.length ? await paymentsCollection.countDocuments({
      $or: [
        { studentId: { $in: duplicateMasterIds } },
        { masterStudentId: { $in: duplicateMasterIds } },
        { enrollmentId: { $in: enrollmentIds } },
        { studentId: { $in: [...legacyIdsByCanonical.values()].flat().map(id => new mongoose.Types.ObjectId(id)) } }
      ]
    }) : 0,
    idCardLogsToLink: duplicateMasterIds.length ? await idCardsCollection.countDocuments({
      studentId: { $in: [...legacyIdsByCanonical.values()].flat().map(id => new mongoose.Types.ObjectId(id)) }
    }) : 0,
    groups: groupReports.slice(0, 50),
    destructiveDeletes: 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log("Dry run only: no database records or indexes were changed. Review the groups, back up MongoDB, then rerun with --apply.");
    return;
  }

  for (const group of mergeGroups) {
    const canonical = group.canonical;
    const canonicalId = canonical._id;
    const duplicateIds = group.duplicates.map(item => item._id);
    const allProfiles = [canonical, ...group.duplicates];
    const registrations = mergeHistory(...allProfiles.map(item => item.registrations || []), ...allProfiles.map(item => item.enrollments || []));
    const allStudentCodes = [...new Set(allProfiles.flatMap(item => [
      ...(item.studentCodes || []), ...(item.stCodes || []), item.primaryStCode, item.currentStCode,
    ]).map(codeOf).filter(Boolean))];
    const allPhones = [...new Set(allProfiles.flatMap(item => [...(item.phones || []), ...(item.phoneNumbers || [])]).flatMap(value => normalizeIndianPhones(value)))];
    const allAliases = [...new Set(allProfiles.flatMap(item => [
      item.fullName, item.normalizedFullName, ...(item.alternateNames || []),
    ]).map(normalizeStudentName).filter(Boolean))];
    const latest = latestRegistration(registrations);
    const latestDate = effectiveDate(latest);
    const existingDate = dateValue(canonical.currentAdmissionDate || canonical.dateOfAdmission);
    const update = {
      $set: {
        legacyStudentIds: [...new Map(allProfiles.flatMap(item => item.legacyStudentIds || []).map(id => [String(id), id])).values()],
        studentCodes: allStudentCodes,
        stCodes: allStudentCodes,
        alternateNames: allAliases,
        phones: allPhones,
        phoneNumbers: allPhones,
        registrations,
        enrollments: registrations,
        primaryStCode: latest?.stCode || canonical.primaryStCode || canonical.currentStCode || "",
        currentStCode: latest?.stCode || canonical.currentStCode || "",
        currentRegistrationId: latest?.registrationId || canonical.currentRegistrationId || "",
        currentCourse: latest?.course || canonical.currentCourse || "",
        currentAdmissionDate: latestDate || canonical.currentAdmissionDate || null,
        dateOfAdmission: latestDate || canonical.dateOfAdmission || null,
        normalizedFullName: normalizeStudentName(canonical.fullName || canonical.normalizedFullName),
        normalizedFatherName: normalizeFatherName(canonical.fatherName || ""),
        photoUrl: canonical.photoUrl || allProfiles.find(item => item.photoUrl)?.photoUrl || "",
        hasPhoto: Boolean(canonical.photoUrl || allProfiles.find(item => item.photoUrl)?.photoUrl),
        identityWarnings: [...new Set(allProfiles.flatMap(item => item.identityWarnings || []))],
        mergedProfileCount: allProfiles.length,
        lastIdentityMergeAt: new Date(),
      }
    };
    if ((!canonical.address || (latestDate && existingDate && latestDate >= existingDate)) && latest?.rawAddress) update.$set.address = latest.rawAddress;
    if ((!canonical.qualification || (latestDate && existingDate && latestDate >= existingDate)) && latest?.qualification) update.$set.qualification = latest.qualification;
    await mastersCollection.updateOne({ _id: canonicalId }, update);

    const allEnrollmentRows = await enrollmentCollection.find({ studentId: { $in: [canonicalId, ...duplicateIds] } }).toArray();
    const canonicalRows = allEnrollmentRows.filter(item => String(item.studentId) === String(canonicalId));
    const canonicalByKey = new Map(canonicalRows.map(item => [registrationKey(item), item]));
    const enrollmentReplacements = new Map();
    for (const row of allEnrollmentRows) {
      const existing = canonicalByKey.get(registrationKey(row));
      if (existing && String(existing._id) !== String(row._id)) {
        enrollmentReplacements.set(String(row._id), existing._id);
        await enrollmentCollection.updateOne({ _id: row._id }, {
          $set: { mergedIntoEnrollmentId: existing._id, masterStudentId: canonicalId, mergeStatus: "DUPLICATE_RETAINED" }
        });
      } else {
        if (String(row.studentId) !== String(canonicalId)) {
          await enrollmentCollection.updateOne({ _id: row._id }, { $set: { studentId: canonicalId, masterStudentId: canonicalId } });
        } else {
          await enrollmentCollection.updateOne({ _id: row._id }, { $set: { masterStudentId: canonicalId } });
        }
        canonicalByKey.set(registrationKey(row), row);
      }
    }

    const activeEnrollmentRows = await enrollmentCollection.find({
      studentId: canonicalId,
      mergedIntoEnrollmentId: null,
    }).toArray();
    activeEnrollmentRows.sort((a, b) => (effectiveDate(b)?.getTime() || 0) - (effectiveDate(a)?.getTime() || 0));
    if (activeEnrollmentRows[0]) {
      const latestEnrollment = activeEnrollmentRows[0];
      await mastersCollection.updateOne({ _id: canonicalId }, { $set: {
        activeEnrollmentId: latestEnrollment._id,
        primaryStCode: latestEnrollment.stCode || latest?.stCode || canonical.primaryStCode || "",
        currentStCode: latestEnrollment.stCode || latest?.stCode || canonical.currentStCode || "",
        currentRegistrationId: latestEnrollment.registrationId || latest?.registrationId || canonical.currentRegistrationId || "",
        currentCourse: latestEnrollment.course || latestEnrollment.courseName || latestEnrollment.courseCode || latest?.course || canonical.currentCourse || "",
        currentAdmissionDate: latestEnrollment.admissionDate || latest?.dateOfAdmission || null,
      }});
    }
    const enrollmentReplacementEntries = [...enrollmentReplacements.entries()];
    for (const [oldEnrollmentId, newEnrollmentId] of enrollmentReplacementEntries) {
      await paymentsCollection.updateMany({ enrollmentId: new mongoose.Types.ObjectId(oldEnrollmentId) }, {
        $set: { enrollmentId: newEnrollmentId, studentId: canonicalId, masterStudentId: canonicalId }
      });
    }
    await paymentsCollection.updateMany({
      $or: [{ studentId: { $in: duplicateIds } }, { masterStudentId: { $in: duplicateIds } }]
    }, { $set: { studentId: canonicalId, masterStudentId: canonicalId } });

    const legacyIds = (update.$set.legacyStudentIds || []).map(id => id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id));
    if (legacyIds.length) {
      // Some older payment imports still stored a legacy Student ObjectId in studentId.
      await paymentsCollection.updateMany({ studentId: { $in: legacyIds } }, {
        $set: { studentId: canonicalId, masterStudentId: canonicalId }
      });
      // Keep each ID-card log's legacy Student reference; add the durable master link.
      await idCardsCollection.updateMany({ studentId: { $in: legacyIds } }, { $set: { masterStudentId: canonicalId } });
    }

    const canonicalEnrollments = await enrollmentCollection.find({
      studentId: canonicalId,
      mergedIntoEnrollmentId: null,
    }).toArray();
    const byRegistration = new Map();
    const byCode = new Map();
    for (const enrollment of canonicalEnrollments) {
      if (enrollment.registrationId) byRegistration.set(String(enrollment.registrationId).toUpperCase(), [...(byRegistration.get(String(enrollment.registrationId).toUpperCase()) || []), enrollment]);
      if (enrollment.stCode) byCode.set(String(enrollment.stCode), [...(byCode.get(String(enrollment.stCode)) || []), enrollment]);
    }
    const canonicalPayments = await paymentsCollection.find({
      $or: [{ studentId: canonicalId }, { masterStudentId: canonicalId }],
    }).toArray();
    for (const payment of canonicalPayments) {
      const registration = String(payment.registrationId || payment.stNameKey || "").toUpperCase();
      const candidates = byRegistration.get(registration) || byCode.get(String(payment.stCode || "")) || [];
      if (!payment.enrollmentId && candidates.length === 1) {
        const enrollment = candidates[0];
        await paymentsCollection.updateOne({ _id: payment._id }, { $set: {
          enrollmentId: enrollment._id,
          studentId: canonicalId,
          masterStudentId: canonicalId,
          stCode: payment.stCode || enrollment.stCode,
          courseCode: payment.courseCode || enrollment.courseCode || "",
          course: payment.course || enrollment.courseName || enrollment.courseCode || "",
        }});
      } else if (payment.enrollmentId) {
        const enrollment = canonicalEnrollments.find(item => String(item._id) === String(payment.enrollmentId));
        if (enrollment) await paymentsCollection.updateOne({ _id: payment._id }, { $set: {
          studentId: canonicalId, masterStudentId: canonicalId,
          courseCode: payment.courseCode || enrollment.courseCode || "",
          course: payment.course || enrollment.courseName || enrollment.courseCode || "",
        }});
      }
    }
    const paidTotals = await paymentsCollection.aggregate([
      { $match: { enrollmentId: { $in: canonicalEnrollments.map(item => item._id) } } },
      { $group: { _id: "$enrollmentId", totalPaid: { $sum: "$amountPaid" } } },
    ]).toArray();
    const paidByEnrollment = new Map(paidTotals.map(item => [String(item._id), Number(item.totalPaid || 0)]));
    let masterFee = { totalFee: 0, discount: 0, totalPaid: 0, balanceDue: 0, courseCount: canonicalEnrollments.length, hasConfiguredFee: false };
    for (const enrollment of canonicalEnrollments) {
      const totalFee = Number(enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? 0);
      const totalDue = Number(enrollment.feeConfig?.netPayableFee ?? enrollment.summary?.totalDue ?? 0);
      const totalPaid = paidByEnrollment.get(String(enrollment._id)) || 0;
      const balanceDue = Math.max(0, totalDue - totalPaid);
      const configured = enrollment.feeConfig?.configured !== false && enrollment.feeConfig?.feeRuleSource !== "UNCONFIGURED";
      const feeStatus = configured && balanceDue === 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid";
      await enrollmentCollection.updateOne({ _id: enrollment._id }, { $set: { summary: {
        ...(enrollment.summary || {}), totalFee, totalDue, totalPaid, balanceDue, feeStatus,
      } } });
      masterFee.totalFee += totalFee;
      masterFee.discount += Number(enrollment.feeConfig?.discountAmount || 0);
      masterFee.totalPaid += totalPaid;
      masterFee.balanceDue += balanceDue;
      masterFee.hasConfiguredFee ||= configured;
    }
    await mastersCollection.updateOne({ _id: canonicalId }, { $set: { feeSummary: {
      totalFee: masterFee.totalFee,
      discount: masterFee.discount,
      totalPaid: masterFee.totalPaid,
      balanceDue: masterFee.balanceDue,
      feeStatus: masterFee.hasConfiguredFee && masterFee.balanceDue === 0 ? "Paid" : masterFee.totalPaid > 0 ? "Partial" : "Unpaid",
      courseCount: masterFee.courseCount,
      updatedAt: new Date(),
    } } });

    // Mark duplicate master records only after all dependent references have been re-linked.
    await mastersCollection.updateMany({ _id: { $in: duplicateIds } }, {
      $set: { mergedIntoMasterId: canonicalId, isMerged: true, mergedAt: new Date(), mergeMethod: "FOUR_TIER_IDENTITY_RESOLUTION" }
    });
  }

  // Reconcile duplicate enrollment keys after Master IDs have been consolidated.
  // Duplicate enrollment documents are retained; dependent receipts point to the canonical enrollment.
  const activeEnrollmentRows = await enrollmentCollection.find({ mergedIntoEnrollmentId: null }).toArray();
  const enrollmentGroups = new Map();
  for (const item of activeEnrollmentRows) {
    const key = String(item.studentId) + "|" + registrationKey(item);
    enrollmentGroups.set(key, [...(enrollmentGroups.get(key) || []), item]);
  }
  for (const rows of enrollmentGroups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) =>
      Number(Boolean(b.feeConfig?.configured)) - Number(Boolean(a.feeConfig?.configured))
      || (b.installments?.length || 0) - (a.installments?.length || 0)
      || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    const canonicalEnrollment = rows[0];
    for (const duplicate of rows.slice(1)) {
      await enrollmentCollection.updateOne({ _id: duplicate._id }, { $set: {
        mergedIntoEnrollmentId: canonicalEnrollment._id,
        masterStudentId: canonicalEnrollment.studentId,
        mergeStatus: "DUPLICATE_RETAINED",
      } });
      await paymentsCollection.updateMany({ enrollmentId: duplicate._id }, { $set: {
        enrollmentId: canonicalEnrollment._id,
        studentId: canonicalEnrollment.studentId,
        masterStudentId: canonicalEnrollment.studentId,
      } });
      await mastersCollection.updateMany({ activeEnrollmentId: duplicate._id }, { $set: { activeEnrollmentId: canonicalEnrollment._id } });
    }
  }

  const missingCourseCodeRows = await enrollmentCollection.find({
    mergedIntoEnrollmentId: null,
    courseCode: { $in: ["", null] },
    courseName: { $type: "string", $ne: "" },
  }).toArray();
  if (missingCourseCodeRows.length) {
    await enrollmentCollection.bulkWrite(missingCourseCodeRows.map(item => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { courseCode: clean(item.courseName).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") } },
      },
    })), { ordered: false });
  }

  const enrollmentIndexes = await enrollmentCollection.indexes();
  for (const oldName of ["student_registration_identity_unique", "student_course_enrollment_unique"]) {
    const oldIndex = enrollmentIndexes.find(index => index.name === oldName && index.unique);
    if (oldIndex) await enrollmentCollection.dropIndex(oldIndex.name);
  }
  await enrollmentCollection.createIndex(
    { studentId: 1, stCode: 1, courseCode: 1, admissionDate: 1 },
    {
      unique: true,
      name: "student_stcode_course_admission_unique",
      partialFilterExpression: {
        mergedIntoEnrollmentId: null,
        stCode: { $type: "string", $gt: "" },
        courseCode: { $type: "string", $gt: "" },
      },
    }
  );

  // Refresh fee totals from the preserved receipt collection for every active Master profile.
  const activeMastersForFees = await mastersCollection.find({ mergedIntoMasterId: null, isMerged: { $ne: true } }).toArray();
  for (const master of activeMastersForFees) {
    const activeEnrollments = await enrollmentCollection.find({ studentId: master._id, mergedIntoEnrollmentId: null }).toArray();
    if (!activeEnrollments.length) continue;
    const totals = await paymentsCollection.aggregate([
      { $match: { enrollmentId: { $in: activeEnrollments.map(item => item._id) } } },
      { $group: { _id: "$enrollmentId", totalPaid: { $sum: "$amountPaid" } } },
    ]).toArray();
    const paidMap = new Map(totals.map(item => [String(item._id), Number(item.totalPaid || 0)]));
    let totalFee = 0, discount = 0, totalPaid = 0, balanceDue = 0, hasConfiguredFee = false;
    for (const enrollment of activeEnrollments) {
      const fee = Number(enrollment.feeConfig?.grossFee ?? enrollment.summary?.totalFee ?? 0);
      const due = Number(enrollment.feeConfig?.netPayableFee ?? enrollment.summary?.totalDue ?? 0);
      const paid = paidMap.get(String(enrollment._id)) || 0;
      const balance = Math.max(0, due - paid);
      const configured = enrollment.feeConfig?.configured !== false && enrollment.feeConfig?.feeRuleSource !== "UNCONFIGURED";
      const feeStatus = configured && balance === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
      await enrollmentCollection.updateOne({ _id: enrollment._id }, { $set: { summary: {
        ...(enrollment.summary || {}), totalFee: fee, totalDue: due, totalPaid: paid, balanceDue: balance, feeStatus,
      } } });
      totalFee += fee; discount += Number(enrollment.feeConfig?.discountAmount || 0);
      totalPaid += paid; balanceDue += balance; hasConfiguredFee ||= configured;
    }
    await mastersCollection.updateOne({ _id: master._id }, { $set: { feeSummary: {
      totalFee, discount, totalPaid, balanceDue,
      feeStatus: hasConfiguredFee && balanceDue === 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid",
      courseCount: activeEnrollments.length, updatedAt: new Date(),
    } } });
  }

  console.log("Non-destructive merge completed. Duplicate master/enrollment records and all legacy Student/fee/ID-card documents were retained.");
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { if (mongoose.connection.readyState) await mongoose.disconnect(); });

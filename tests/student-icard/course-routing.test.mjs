import test from "node:test";
import assert from "node:assert/strict";
import { isCodingForKidsCourse } from "../../lib/student-icard/courseRouting.mjs";

test("recognizes Coding for Kids by name regardless of case and semester", () => {
  for (const courseName of [
    "Coding for Kids",
    "CODING FOR KIDS",
    "Coding For Kids - Semester 1",
    "coding for kids SEM 6",
  ]) {
    assert.equal(isCodingForKidsCourse({ courseName }), true, courseName);
  }
});

test("recognizes SM I through SM VI as Coding for Kids modules", () => {
  for (const courseName of ["SM I", "SM II", "SM III", "SM IV", "SM V", "SM VI", "SM-1", "SM 6"]) {
    assert.equal(isCodingForKidsCourse({ courseName }), true, courseName);
  }
});

test("recognizes Robotics as a Coding for Kids module", () => {
  assert.equal(isCodingForKidsCourse({ courseName: "Robotics" }), true);
  assert.equal(isCodingForKidsCourse({ activeEnrollment: { courseName: "Robotics" } }), true);
});

test("recognizes Coding for Kids course codes and nested course objects", () => {
  assert.equal(isCodingForKidsCourse({ courseCode: "KIDS", currentSemester: 4 }), true);
  assert.equal(isCodingForKidsCourse({ course: { code: "CFK" } }), true);
  assert.equal(isCodingForKidsCourse({ activeEnrollment: { courseName: "Coding for Kids", semester: 2 } }), true);
});

test("keeps DOM course levels on the Diploma template route", () => {
  for (const courseName of ["DOM", "DOM I", "DOM II", "DOM III", "DOM IV", "DOM V", "DOM VI", "DCST", "DCA", "ADCA"]) {
    assert.equal(isCodingForKidsCourse({ courseName, currentSemester: 1 }), false, courseName);
  }
});

test("prefers the current course label when stale course fields conflict", () => {
  assert.equal(isCodingForKidsCourse({ courseName: "DCA", courseCode: "KIDS" }), false);
  assert.equal(isCodingForKidsCourse({ courseName: "DOM", activeEnrollment: { courseName: "Coding for Kids" } }), true);
});

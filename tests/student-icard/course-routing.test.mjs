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

test("recognizes Coding for Kids course codes and nested course objects", () => {
  assert.equal(isCodingForKidsCourse({ courseCode: "KIDS", currentSemester: 4 }), true);
  assert.equal(isCodingForKidsCourse({ course: { code: "CFK", name: "Special Course" } }), true);
  assert.equal(isCodingForKidsCourse({ activeEnrollment: { courseName: "Coding for Kids", semester: 2 } }), true);
});

test("does not misclassify other courses that contain semester metadata", () => {
  for (const courseName of ["DOM", "DCST", "DCA", "ADCA", "Robotics", "School Course"]) {
    assert.equal(isCodingForKidsCourse({ courseName, currentSemester: 1 }), false, courseName);
  }
});

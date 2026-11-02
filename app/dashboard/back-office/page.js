"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList, Plus, RefreshCw, Clock3, MapPin, Users, CalendarDays,
  CheckCircle2, AlertTriangle, BookOpen, ShieldCheck, Search, UserCheck,
  ListTodo, CalendarClock, ArrowUpRight, LockKeyhole
} from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const AREAS = ["T1", "T2", "L1", "L2", "L3", "L4", "Back Office", "Front Office"];
const SLOTS = [
  { value: "09:00|10:00", label: "9:00 am – 10:00 am" },
  { value: "10:00|11:00", label: "10:00 am – 11:00 am" },
  { value: "11:00|12:00", label: "11:00 am – 12:00 pm" },
  { value: "12:00|13:00", label: "12:00 pm – 1:00 pm" },
  { value: "13:00|14:00", label: "1:00 pm – 2:00 pm" },
  { value: "14:00|15:00", label: "2:00 pm – 3:00 pm" },
  { value: "15:00|16:00", label: "3:00 pm – 4:00 pm" },
  { value: "16:00|17:00", label: "4:00 pm – 5:00 pm" },
  { value: "17:00|18:00", label: "5:00 pm – 6:00 pm" },
  { value: "18:00|19:00", label: "6:00 pm – 7:00 pm" }
];
const localDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const showTime = (start, end) => SLOTS.find((slot) => slot.value === start + "|" + end)?.label || (start && end ? start + " – " + end : "Time not set");

function Metric({ icon: Icon, label, value, hint, tone = "blue" }) {
  return <article className={"task-metric " + tone}>
    <span className="task-metric-icon"><Icon size={18} /></span>
    <div><small>{label}</small><strong>{value}</strong><span>{hint}</span></div>
  </article>;
}

export default function TaskAssignmentPage() {
  const [tasks, setTasks] = useState([]);
  const [weeklySchedule, setWeeklySchedule] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeAvailability, setEmployeeAvailability] = useState([]);
  const [workRegister, setWorkRegister] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [attendanceRequired, setAttendanceRequired] = useState(false);
  const [excludedWithoutAttendance, setExcludedWithoutAttendance] = useState(0);
  const [message, setMessage] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [form, setForm] = useState({ title: "", employeeIds: [], workArea: "", taskDate: localDate(), startTime: "", endTime: "" });

  async function load(next = form) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: next.taskDate || localDate(), startTime: next.startTime || "", endTime: next.endTime || "" });
      const response = await fetch("/api/back-office/tasks?" + params, { cache: "no-store" });
      if (response.status === 401) { window.location.href = "/dashboard/login"; return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load task manager.");
      setTasks(data.tasks || []);
      setWeeklySchedule(data.weeklySchedule || []);
      setEmployees(data.availableEmployees || []);
      setEmployeeAvailability(data.employeeAvailability || []);
      setWorkRegister(data.workRegister || []);
      setCanAssign(!!data.canAssign);
      setAttendanceRequired(!!data.attendanceRequired);
      setExcludedWithoutAttendance(Number(data.excludedWithoutAttendance || 0));
    } catch (error) {
      setMessage(error.message || "Unable to load task manager.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => load(form), 220);
    return () => clearTimeout(timer);
  }, [form.taskDate, form.startTime, form.endTime]);

  function chooseSlot(value) {
    const [startTime, endTime] = value ? value.split("|") : ["", ""];
    setForm((current) => ({ ...current, startTime, endTime, employeeIds: [] }));
  }

  function toggleEmployee(id) {
    setForm((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(id)
        ? current.employeeIds.filter((item) => item !== id)
        : [...current.employeeIds, id]
    }));
  }

  async function save() {
    setMessage("");
    if (!form.title.trim()) return setMessage("Enter a task name.");
    if (!form.startTime) return setMessage("Select a time slot.");
    if (!form.workArea) return setMessage("Select a work area.");
    if (!form.employeeIds.length) return setMessage("Select at least one eligible employee.");
    setSaving(true);
    try {
      const response = await fetch("/api/back-office/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error((data.error || "Unable to assign task.") + (data.employees?.length ? " " + data.employees.join(", ") : ""));
      const next = { ...form, title: "", employeeIds: [], workArea: "" };
      setForm(next);
      setMessage("Task assigned successfully.");
      await load(next);
    } catch (error) {
      setMessage(error.message || "Unable to assign task.");
    } finally {
      setSaving(false);
    }
  }

  const filteredEmployees = employees.filter((employee) =>
    (employee.name + " " + employee.employeeId + " " + (employee.designation || "")).toLowerCase().includes(employeeSearch.toLowerCase())
  );

  return <ERPLayout active="/dashboard/back-office">
    <main className="task-page">
      <header className="topbar task-topbar">
        <div><div className="crumb">People operations / Workforce planning</div><h1>{canAssign ? "Task Manager" : "My Tasks"}</h1></div>
        <div className="task-top-actions">
          {!canAssign ? <label className="task-date-chip task-date-picker"><CalendarDays size={15}/><input aria-label="Select work date" type="date" value={form.taskDate} onChange={(event) => setForm((current) => ({ ...current, taskDate: event.target.value }))}/></label> : <span className="task-date-chip"><CalendarDays size={15}/>{new Date(form.taskDate + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>}
          <button className="task-refresh" onClick={() => load()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
        </div>
      </header>

      <section className="task-hero">
        <div className="task-hero-copy">
          <span className="task-eyebrow">RCLD · DAILY OPERATIONS</span>
          <h2>{canAssign ? "Plan the day. Assign the right people." : "Your workday, clearly organised."}</h2>
          <p>{canAssign ? "Build a clear daily work plan using employees who have marked attendance and are free for the selected time." : "See your recurring batch timetable for the week alongside any office tasks assigned to you."}</p>
          <div className="task-hero-meta"><span><ShieldCheck size={14}/> Attendance-gated assignments</span><span><CalendarClock size={14}/> {form.taskDate}</span></div>
        </div>
        <div className="task-hero-visual"><div className="task-hero-orbit"><ListTodo size={34}/></div><strong>{tasks.length}</strong><span>{canAssign ? "Tasks for selected date" : "Tasks assigned to you"}</span></div>
      </section>

      <section className="task-metrics">
        <Metric icon={ClipboardList} label="Tasks" value={tasks.length} hint="Selected date" tone="blue"/>
        {canAssign ? <>
          <Metric icon={UserCheck} label="Eligible employees" value={employeeAvailability.length} hint="Attendance marked" tone="green"/>
          <Metric icon={CheckCircle2} label="Available employees" value={form.startTime ? employees.length : "—"} hint={form.startTime ? "Free for selected slot" : "Select a time slot"} tone="violet"/>
          <Metric icon={LockKeyhole} label="Hidden from manager" value={excludedWithoutAttendance} hint="No eligible attendance" tone="amber"/>
        </> : <Metric icon={CalendarClock} label="Work date" value={form.taskDate} hint="Asia / Kolkata" tone="green"/>}
      </section>

      {canAssign && <section className="task-attendance-banner">
        <span className="task-attendance-banner-icon"><ShieldCheck size={19}/></span>
        <div><strong>Attendance is the first eligibility check</strong><p>Only employees marked Present or Half Day appear in task allocation, availability and the daily work register. Employees with no attendance, Absent, or Leave are excluded.</p></div>
        <span className="task-hidden-count">{excludedWithoutAttendance} excluded</span>
      </section>}

      {attendanceRequired && <section className="task-employee-gate"><LockKeyhole size={22}/><div><strong>Attendance not marked</strong><p>New office task assignments are hidden until your attendance is marked Present or Half Day for this date. Your recurring batch timetable remains visible below.</p></div></section>}

      {!canAssign && <section className="task-panel task-weekly-panel">
        <div className="task-panel-heading"><div><span className="task-eyebrow">RECURRING ACADEMIC DUTIES</span><h3>My Batch Classes — {new Date(form.taskDate + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long" })}</h3><p>Only your classes scheduled for the selected day are shown here.</p></div><span className="task-section-count">{weeklySchedule.length} classes on this day</span></div>
        <div className="task-weekly-grid">
          {weeklySchedule.map((item, index) => <article className="task-weekly-card" key={item.batchCode + "-" + item.day + "-" + item.startTime + "-" + index}>
            <div className="task-weekly-card-top"><span className="task-weekly-day">{item.day || "Day not set"}</span><span className="task-weekly-time"><Clock3 size={14}/>{showTime(item.startTime, item.endTime)}</span></div>
            <strong className="task-weekly-batch">{item.batchCode || item.batchName || "Batch"}{item.courseName ? " · " + item.courseName : ""}</strong>
            <div className="task-weekly-meta">
              {item.series && <span><BookOpen size={13}/>Series {item.series}</span>}
              {item.slot && <span>Slot {item.slot}</span>}
              <span><MapPin size={13}/>{item.room || "Room not assigned"}</span>
            </div>
          </article>)}
          {!weeklySchedule.length && <div className="task-empty"><CalendarDays size={24}/><strong>No batch classes scheduled for this day</strong><span>There are no classes assigned to you for the selected day. Choose another date to view that day’s timetable.</span></div>}
        </div>
      </section>}

      {canAssign && <section className="task-panel task-create-panel">
        <div className="task-panel-heading"><div><span className="task-eyebrow">NEW WORK ITEM</span><h3>Create task assignment</h3><p>Choose a date and time. The employee list is filtered by attendance and existing commitments.</p></div><span className="task-panel-heading-icon"><Plus size={19}/></span></div>
        <div className="task-form-grid">
          <label className="task-field task-field-wide"><span>Task name</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Prepare student admission files"/></label>
          <label className="task-field"><span>Work date</span><input type="date" value={form.taskDate} onChange={(event) => setForm({ ...form, taskDate: event.target.value, employeeIds: [] })}/></label>
          <label className="task-field"><span>Time slot</span><select value={form.startTime ? form.startTime + "|" + form.endTime : ""} onChange={(event) => chooseSlot(event.target.value)}><option value="">Select time slot</option>{SLOTS.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label>
          <label className="task-field"><span>Work area</span><select value={form.workArea} onChange={(event) => setForm({ ...form, workArea: event.target.value })}><option value="">Select work area</option>{AREAS.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
        </div>

        <div className="task-employee-picker">
          <div className="task-picker-heading"><div><h4>Eligible employees</h4><p>{form.startTime ? "Select one or more employees available for this time slot." : "Select a time slot to check availability."}</p></div><span>{employees.length} available</span></div>
          {form.startTime && <div className="task-picker-search"><Search size={16}/><input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search eligible employees"/></div>}
          {form.startTime ? <div className="task-employee-grid">
            {filteredEmployees.map((employee) => <label className={"task-employee-option " + (form.employeeIds.includes(employee.employeeId) ? "selected" : "")} key={employee.employeeId}>
              <input type="checkbox" checked={form.employeeIds.includes(employee.employeeId)} onChange={() => toggleEmployee(employee.employeeId)}/>
              <span className="task-employee-avatar">{String(employee.name || "E").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <span className="task-employee-option-copy"><strong>{employee.name}</strong><small>{employee.designation || employee.department || "Employee"} · {employee.employeeId}</small></span>
              <span className="task-available-tag">Available</span>
            </label>)}
            {!loading && !filteredEmployees.length && <div className="task-empty"><Users size={24}/><strong>No eligible employee available</strong><span>{excludedWithoutAttendance ? "Employees without eligible attendance are hidden. Mark attendance first." : "No employee is free in this time slot."}</span></div>}
          </div> : <div className="task-picker-placeholder"><Clock3 size={20}/><span>Choose a time slot above to see employees who are present and available.</span></div>}
          {form.employeeIds.length > 0 && <div className="task-selection-summary"><CheckCircle2 size={15}/>{form.employeeIds.length} employee(s) selected</div>}
        </div>
        <div className="task-create-footer"><span>Assignments are checked again by the server before saving.</span><button className="primary-btn" onClick={save} disabled={saving || loading}><Plus size={16}/>{saving ? "Assigning…" : "Assign task"}</button></div>
      </section>}

      {canAssign && <section className="task-panel">
        <div className="task-panel-heading"><div><span className="task-eyebrow">WORKFORCE AVAILABILITY</span><h3>Employee availability</h3><p>Only employees with eligible attendance are displayed in this section.</p></div><span className="task-section-count">{employeeAvailability.length} employees</span></div>
        <div className="task-availability-grid">
          {employeeAvailability.map((employee) => <article className={"task-availability-card " + (employee.available ? "is-free" : "is-busy")} key={employee.employeeId}>
            <div className="task-availability-head"><span className="task-employee-avatar">{String(employee.name || "E").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{employee.name}</strong><small>{employee.designation || employee.department || "Employee"}</small></div><span className={"task-availability-status " + (!form.startTime ? "pending" : employee.available ? "free" : "busy")}>{form.startTime ? (employee.available ? "Available" : "Occupied") : "Select time"}</span></div>
            {employee.reasons.length ? <div className="task-reason-list">{employee.reasons.map((reason, index) => <span key={index}>{reason.startsWith("Batch") ? <BookOpen size={14}/> : reason.startsWith("Task") ? <ClipboardList size={14}/> : <AlertTriangle size={14}/>} {reason}</span>)}</div> : form.startTime ? <div className="task-no-conflict"><CheckCircle2 size={14}/>No schedule conflict found</div> : <div className="task-no-conflict"><Clock3 size={14}/>Select a time slot to calculate conflicts</div>}
          </article>)}
          {!employeeAvailability.length && <div className="task-empty"><Users size={24}/><strong>No eligible employees</strong><span>Employees appear here only after Present or Half Day attendance is marked.</span></div>}
        </div>
      </section>}

      <section className="task-panel task-register-panel">
        <div className="task-panel-heading"><div><span className="task-eyebrow">DAILY WORK PLAN</span><h3>{canAssign ? "Employee work register" : "My assigned work"}</h3><p>{canAssign ? "A separate timeline for each employee who is eligible for work on the selected date." : "Your assigned office tasks for the selected date are listed in time order."}</p></div><span className="task-section-count">{canAssign ? workRegister.length + " employees" : tasks.length + " tasks"}</span></div>
        {canAssign ? <div className="task-work-register">
          {workRegister.map((employee) => <article className="task-work-card" key={employee.employeeId}>
            <div className="task-work-card-head"><span className="task-employee-avatar">{String(employee.name || "E").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{employee.name}</strong><small>{employee.designation || employee.department || employee.employeeId}</small></div><span className="task-work-count">{employee.items.length} items</span></div>
            <div className="task-timeline">{employee.items.length ? employee.items.map((item, index) => <div className="task-timeline-row" key={index}><span className="task-timeline-time">{showTime(item.startTime, item.endTime)}</span><span className={"task-timeline-dot " + item.type}></span><div><strong>{item.title}</strong><small>{item.type === "batch" ? "Class / Batch" : "Assigned task"} · {item.workArea || item.room || "Area not set"}</small></div></div>) : <div className="task-no-work">No work scheduled for this employee.</div>}</div>
          </article>)}
          {!workRegister.length && <div className="task-empty"><CalendarDays size={24}/><strong>No eligible work register</strong><span>Mark attendance to make employees available for the daily register.</span></div>}
        </div> : <div className="task-personal-list">
          {tasks.map((task) => <article className="task-personal-row" key={task._id}><span className="task-personal-time"><Clock3 size={15}/>{showTime(task.startTime, task.endTime)}</span><div><strong>{task.title}</strong><small><MapPin size={13}/>{task.workArea || "Work area not set"}</small></div><span className={"task-status " + String(task.status || "Open").toLowerCase().replace(/\s+/g, "-")}>{task.status || "Open"}</span><ArrowUpRight size={16}/></article>)}
          {!tasks.length && !attendanceRequired && <div className="task-empty"><ClipboardList size={24}/><strong>No tasks assigned</strong><span>Your assigned work will appear here.</span></div>}
        </div>}
      </section>
      {message && <div className={"task-message " + (message.includes("successfully") ? "success" : "error")}>{message}</div>}
      {loading && <div className="task-loading">Updating workforce data…</div>}
    </main>
  </ERPLayout>;
}

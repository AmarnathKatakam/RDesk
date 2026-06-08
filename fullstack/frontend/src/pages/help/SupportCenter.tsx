
import HelpResourcePage from './HelpResourcePage';
import React, { useState } from "react";
import "./SupportCenter.css";

const SupportCenter = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    employeeId: "",
    category: "Leave & Attendance",
    issue: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Ticket submitted:", formData);
    alert("✅ Support ticket submitted successfully!");
    setFormData({
      fullName: "",
      employeeId: "",
      category: "Leave & Attendance",
      issue: "",
    });
  };

  return (
    <div className="ticket-wrapper">
      <form className="ticket-form" onSubmit={handleSubmit}>
        <h2>Raise a Support Ticket</h2>

        <div className="form-group">
          <label>FULL NAME</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Your full name"
            required
          />
        </div>

        <div className="form-group">
          <label>EMPLOYEE ID</label>
          <input
            type="text"
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            placeholder="Enter Employee ID.."
            required
          />
        </div>

        <div className="form-group">
          <label>CATEGORY</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            <option>Leave & Attendance</option>
            <option>Payroll</option>
            <option>Technical Support</option>
            <option>General HR Query</option>
          </select>
        </div>

        <div className="form-group">
          <label>DESCRIBE YOUR ISSUE</label>
          <textarea
            name="issue"
            value={formData.issue}
            onChange={handleChange}
            placeholder="Please describe your issue in detail..."
            
            required
          ></textarea>
        </div>

        <button type="submit" className="btn-submit">
          Submit ticket →
        </button>
      </form>
    </div>
  );
};

export default SupportCenter;

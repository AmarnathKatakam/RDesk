import React from "react";
import HelpResourcePage from './HelpResourcePage';
import "./Contact.css";

const Contact = () => {
  return (
    <div className="contact-wrapper">
      {/* Left Section */}
      <div className="contact-info">
        <h2>Let’s Talk</h2>
        <div className="info-item">
          <h4>Our Location</h4>
          <p>6TH FLOOR,Orbit,12B,BLACKROTH,THE HEADQUATERS,Knowledge City Rd,Raidurg,Hyderabad,Telangana 500019</p>
        </div>
        <div className="info-item">
          <h4>Email Address</h4>
          <p>hr@blackroth.in</p>
        </div>
        <div className="info-item">
          <h4>Phone</h4>
          <p>+91 1234456</p>
        </div>
      </div>

      {/* Right Section */}
      <form className="contact-form">
        <h2>Contact Us</h2>
        <div className="form-row">
          <div className="form-group">
            <label>First Name</label>
            <input type="text" placeholder="Enter your First Name" required />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input type="text" placeholder="Enter your Last Name" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="Enter a valid email address" required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" placeholder="Enter your phone number... "/>
          </div>
        </div>

        <div className="form-group full-width">
          <label>Message</label>
          <textarea placeholder="Enter your message"  required></textarea>
        </div>

        <button type="submit" className="btn-submit">Submit</button>
      </form>
    </div>
  );
};

export default Contact;

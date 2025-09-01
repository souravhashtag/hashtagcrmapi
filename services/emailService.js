// services/emailService.js
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Employee = require('../models/Employee');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Test email configuration
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service configuration error:', error);
      return false;
    }
  }

  // Get HR and Admin users for notifications
  async getHRUsers() {
    try {
      const hrUsers = await User.find({
        'role.name': { $in: ['HR', 'Admin', 'hr', 'admin'] },
        isActive: true
      }).select('email firstName lastName');
      return hrUsers;
    } catch (error) {
      console.error('Error fetching HR users:', error);
      return [];
    }
  }

  // Send leave application notification
  async sendLeaveApplicationNotification(leave, employee, options = {}) {
    try {
      const {
        additionalTo = [],
        cc = [],
        bcc = []
      } = options;

      // Get HR users
      const hrUsers = await this.getHRUsers();
      const hrEmails = hrUsers.map(user => user.email);

      // Employee details
      const employeeName = `${employee.userId.firstName} ${employee.userId.lastName}`;
      const employeeEmail = employee.userId.email;
      const employeeId = employee.employeeId;

      // Prepare recipient lists
      const toEmails = [...hrEmails, ...additionalTo];
      const ccEmails = [employeeEmail, ...cc];
      const bccEmails = [...bcc];

      // Email template
      const subject = `New Leave Request - ${employeeName} (${employeeId})`;
      const htmlContent = this.getLeaveApplicationTemplate({
        employeeName,
        employeeId,
        leave,
        isNotification: true
      });

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Company'} HR" <${process.env.EMAIL_USER}>`,
        to: toEmails.join(', '),
        cc: ccEmails.join(', '),
        bcc: bccEmails.join(', '),
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Leave application notification sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending leave application notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send leave approval notification
  async sendLeaveApprovalNotification(leave, employee, approver, options = {}) {
    try {
      const {
        additionalTo = [],
        cc = [],
        bcc = []
      } = options;

      // Employee details
      const employeeName = `${employee.userId.firstName} ${employee.userId.lastName}`;
      const employeeEmail = employee.userId.email;
      const employeeId = employee.employeeId;
      const approverName = `${approver.firstName} ${approver.lastName}`;

      // Prepare recipient lists
      const toEmails = [employeeEmail, ...additionalTo];
      const ccEmails = [...cc];
      const bccEmails = [...bcc];

      // Email template
      const subject = `Leave Request Approved - ${employeeName} (${employeeId})`;
      const htmlContent = this.getLeaveApprovalTemplate({
        employeeName,
        employeeId,
        leave,
        approverName,
        status: 'approved'
      });

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Company'} HR" <${process.env.EMAIL_USER}>`,
        to: toEmails.join(', '),
        cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
        bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Leave approval notification sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending leave approval notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send leave rejection notification
  async sendLeaveRejectionNotification(leave, employee, approver, options = {}) {
    try {
      const {
        additionalTo = [],
        cc = [],
        bcc = []
      } = options;

      // Employee details
      const employeeName = `${employee.userId.firstName} ${employee.userId.lastName}`;
      const employeeEmail = employee.userId.email;
      const employeeId = employee.employeeId;
      const approverName = `${approver.firstName} ${approver.lastName}`;

      // Prepare recipient lists
      const toEmails = [employeeEmail, ...additionalTo];
      const ccEmails = [...cc];
      const bccEmails = [...bcc];

      // Email template
      const subject = `Leave Request Rejected - ${employeeName} (${employeeId})`;
      const htmlContent = this.getLeaveApprovalTemplate({
        employeeName,
        employeeId,
        leave,
        approverName,
        status: 'rejected'
      });

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Company'} HR" <${process.env.EMAIL_USER}>`,
        to: toEmails.join(', '),
        cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
        bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Leave rejection notification sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending leave rejection notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Leave application email template
  getLeaveApplicationTemplate({ employeeName, employeeId, leave, isNotification = false }) {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const leaveTypeMap = {
      casual: 'Casual Leave',
      medical: 'Medical Leave',
      annual: 'Annual Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      unpaid: 'Unpaid Leave',
      other: 'Other'
    };

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request ${isNotification ? 'Notification' : 'Confirmation'}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #129990 0%, #117ca7ff 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .leave-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .status-pending { background: #fff3cd; color: #856404; }
          .reason-box { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 25px; margin: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isNotification ? '🔔 New Leave Request' : '✅ Leave Request Submitted'}</h1>
            <p>${isNotification ? 'A new leave request requires your attention' : 'Your leave request has been submitted successfully'}</p>
          </div>
          
          <div class="content">
            <div class="leave-details">
              <h3>📋 Leave Request Details</h3>
              
              <div class="detail-row">
                <span class="label">Employee Name: </span>
                <span class="value">${employeeName}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Employee ID: </span>
                <span class="value">${employeeId}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Leave Type: </span>
                <span class="value">${leaveTypeMap[leave.type] || leave.type}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Start Date: </span>
                <span class="value">${formatDate(leave.startDate)}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">End Date: </span>
                <span class="value">${formatDate(leave.endDate)}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Total Days: </span>
                <span class="value">${leave.totalDays} day${leave.totalDays !== 1 ? 's' : ''}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value">
                  <span class="status-badge status-pending">Pending Approval</span>
                </span>
              </div>
              
              <div class="detail-row">
                <span class="label">Applied On: </span>
                <span class="value">${formatDate(leave.createdAt || new Date())}</span>
              </div>
            </div>
            
            ${leave.reason ? `
            <div class="reason-box">
              <h4>💭 Reason for Leave:</h4>
              <p>${leave.reason}</p>
            </div>
            ` : ''}
            
            ${leave.attachments && leave.attachments.length > 0 ? `
            <div class="reason-box">
              <h4>📎 Attachments:</h4>
              ${leave.attachments.map(att => `<p>• ${att.name}</p>`).join('')}
            </div>
            ` : ''}
            
            ${isNotification ? `
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>Action Required:</strong> Please review and respond to this leave request.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/leave" class="button">
                Review Leave Request
              </a>
            </div>
            ` : `
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>Next Steps:</strong> Your leave request is now under review. You will be notified once a decision is made.</p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/leave" class="button">
                View My Leaves
              </a>
            </div>
            `}
            
            <div class="footer">
              <p>This is an automated message from the ${process.env.COMPANY_NAME || 'Company'} HR System.</p>
              <p>Please do not reply to this email. For questions, contact HR department.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Leave approval/rejection email template
  getLeaveApprovalTemplate({ employeeName, employeeId, leave, approverName, status }) {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const leaveTypeMap = {
      casual: 'Casual Leave',
      medical: 'Medical Leave',
      annual: 'Annual Leave',
      maternity: 'Maternity Leave',
      paternity: 'Paternity Leave',
      unpaid: 'Unpaid Leave',
      other: 'Other'
    };

    const isApproved = status === 'approved';
    const headerColor = isApproved ? '#28a745' : '#dc3545';
    const headerIcon = isApproved ? '✅' : '❌';
    const headerText = isApproved ? 'Leave Request Approved' : 'Leave Request Rejected';
    const statusBadgeClass = isApproved ? 'status-approved' : 'status-rejected';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerColor}; color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .leave-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${headerColor}; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          .status-approved { background: #d4edda; color: #155724; }
          .status-rejected { background: #f8d7da; color: #721c24; }
          .reason-box { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .rejection-reason { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
          .button { display: inline-block; padding: 12px 30px; background: ${headerColor}; color: white; text-decoration: none; border-radius: 25px; margin: 10px; }
          .important-note { background: ${isApproved ? '#d1ecf1' : '#f8d7da'}; border: 1px solid ${isApproved ? '#bee5eb' : '#f5c6cb'}; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${headerIcon} ${headerText}</h1>
            <p>Your leave request has been ${status}</p>
          </div>
          
          <div class="content">
            <div class="leave-details">
              <h3>📋 Leave Request Details</h3>
              
              <div class="detail-row">
                <span class="label">Employee Name:</span>
                <span class="value">${employeeName}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Employee ID:</span>
                <span class="value">${employeeId}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Leave Type:</span>
                <span class="value">${leaveTypeMap[leave.type] || leave.type}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Start Date:</span>
                <span class="value">${formatDate(leave.startDate)}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">End Date:</span>
                <span class="value">${formatDate(leave.endDate)}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Total Days:</span>
                <span class="value">${leave.totalDays} day${leave.totalDays !== 1 ? 's' : ''}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value">
                  <span class="status-badge ${statusBadgeClass}">${status.toUpperCase()}</span>
                </span>
              </div>
              
              <div class="detail-row">
                <span class="label">${isApproved ? 'Approved' : 'Rejected'} By:</span>
                <span class="value">${approverName}</span>
              </div>
              
              <div class="detail-row">
                <span class="label">${isApproved ? 'Approval' : 'Rejection'} Date:</span>
                <span class="value">${formatDate(new Date())}</span>
              </div>
            </div>
            
            ${leave.reason ? `
            <div class="reason-box">
              <h4>💭 Original Reason for Leave:</h4>
              <p>${leave.reason}</p>
            </div>
            ` : ''}
            
            ${!isApproved && leave.rejectionReason ? `
            <div class="rejection-reason">
              <h4>❌ Reason for Rejection:</h4>
              <p>${leave.rejectionReason}</p>
            </div>
            ` : ''}
            
            <div class="important-note">
              <h4>${isApproved ? '🎉 Congratulations!' : '😔 We apologize for the inconvenience'}</h4>
              <p>
                ${isApproved
        ? `Your leave request has been approved. Please ensure all necessary handovers are completed before your leave begins. Enjoy your time off!`
        : `Your leave request has been rejected. Please review the rejection reason above and feel free to contact HR if you need clarification or wish to submit a revised request.`
      }
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/leaves" class="button">
                View All My Leaves
              </a>
            </div>
            
            <div class="footer">
              <p>This is an automated message from the ${process.env.COMPANY_NAME || 'Company'} HR System.</p>
              <p>For questions about this decision, please contact the HR department.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }








  /** -------------------------------
  * EOD Report Notification
  * ------------------------------- */
  // services/emailService.js

  async sendEODReportNotification(report, options = {}) {
    try {
      const { additionalTo = [], cc = [], bcc = [] } = options;

      // Populate roles properly
      // const users = await User.find({ status: 'active' }).populate('role', 'name email');
      // const hrUsers = users.filter(u =>
      //   ['HR', 'Admin', 'hr', 'admin'].includes(u.role?.name)
      // );

      // const hrEmails = hrUsers.map(u => u.email).filter(Boolean);


      // Instead of fetching users & filtering HR/Admin
      // just hardcode your email as BCC

      const toEmails = []; // leave TO empty
      const ccEmails = []; // leave CC empty

      // 👇 replace with your own email
      const bccEmails = [process.env.MY_TEST_EMAIL || "reshab@hashtagbizsolutions.com"];

      const mailOptions = {
        from: `"${process.env.COMPANY_NAME || 'Company'} Reports" <${process.env.EMAIL_USER}>`,
        to: toEmails.length ? toEmails.join(', ') : undefined,
        cc: ccEmails.length ? ccEmails.join(', ') : undefined,
        bcc: bccEmails.join(', '), // always send here
        subject: `📊 EOD Report - ${report.employeeName} (${report.date})`,
        html: this.getEODReportTemplate(report),
      };


      const defaultRecipient = process.env.MANAGER_EMAIL || process.env.EMAIL_USER;
      // const toEmails = [...hrEmails, ...additionalTo];

      if (toEmails.length === 0) {
        toEmails.push(defaultRecipient); // fallback
      }

      // const mailOptions = {
      //   from: `"${process.env.COMPANY_NAME || 'Company'} Reports" <${process.env.EMAIL_USER}>`,
      //   to: toEmails.join(', '),
      //   cc: cc.length ? cc.join(', ') : undefined,
      //   bcc: bcc.length ? bcc.join(', ') : undefined,
      //   subject: `📊 EOD Report - ${report.employeeName} (${report.date})`,
      //   html: this.getEODReportTemplate(report),
      // };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ EOD Report email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error sending EOD Report notification:', error);
      return { success: false, error: error.message };
    }
  }

  /** -------------------------------
   * EOD Report HTML Template
   * ------------------------------- */
  getEODReportTemplate(report) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 700px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px; }
          .header { background: linear-gradient(135deg, #129990 0%, #117ca7 100%); padding: 20px; color: white; border-radius: 10px 10px 0 0; }
          .section { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; }
          h2 { margin-top: 0; color: #129990; }
          ul { padding-left: 20px; }
          .status { font-weight: bold; }
          .status-pending { color: #d97706; }
          .status-ongoing { color: #2563eb; }
          .status-completed { color: #15803d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 End of Day Report</h1>
            <p>${report.date}</p>
          </div>

          <div class="section">
            <h2>👤 Employee Info</h2>
            <p><b>Name:</b> ${report.employeeName}</p>
            <p><b>Position:</b> ${report.position}</p>
            <p><b>Department:</b> ${report.department}</p>
          </div>

          <div class="section">
            <h2>✅ Activities</h2>
            <ul>
              ${report.activities.map(a => `
                <li>
                  <b>${a.activity || 'Untitled'}</b> 
                  <span class="status status-${a.status.toLowerCase()}">(${a.status})</span>
                  <br/>
                  ${a.startTime ? `${a.startTime} - ${a.endTime}` : ''} 
                  <br/>
                  ${a.description || ''}
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="section">
              <h2>🛑 Breaks</h2>
              <ul>
                ${report.breaks && report.breaks.length > 0 ? report.breaks.map(b => `
                  <li>
                    <b>${b.name || 'Break'}</b> 
                    <span class="status status-${b.status?.toLowerCase()}">(${b.status})</span>
                    <br/>
                    ${b.from ? `${b.from} - ${b.to}` : ''}
                  </li>
                `).join('') : '<li>No breaks recorded</li>'}
              </ul>
          </div>

          <div class="section">
            <h2>📅 Plans</h2>
            <p>${report.plans || 'No plans added'}</p>
          </div>

          <div class="section">
            <h2>⚠️ Issues</h2>
            <p style="color:red">${report.issues || 'No issues reported'}</p>
          </div>

          <div class="section">
            <h2>💬 Comments</h2>
            <p>${report.comments || '-'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

}

module.exports = new EmailService();
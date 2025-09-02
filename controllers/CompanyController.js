const { companyDetails } = require('../models/Company');
const mongoose = require('mongoose');

class CompanyController {
  // Get company details (there's only one company)
  // Get company details
  async getCompanyDetails(req, res) {
    try {
      const company = await companyDetails.findOne();

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found. Please initialize company details.'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          ...company.toObject(),
          gracePeriod: company.settings?.gracePeriod, // ensure frontend always gets it
        }
      });

    } catch (error) {
      console.error('Error fetching company details:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching company details',
        error: error.message
      });
    }
  }

  // Initialize company details (only if none exists)
  async initializeCompany(req, res) {
    try {
      const existingCompany = await companyDetails.findOne();
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Company already exists',
          data: existingCompany
        });
      }

      const { name, domain, logo, address, contactInfo, ceo, settings } = req.body;

      if (!name || !domain || !ceo?.name || !ceo?.email) {
        return res.status(400).json({
          success: false,
          message: 'Company name, domain, and CEO (name + email) are required'
        });
      }

      const newCompany = new companyDetails({
        name,
        domain: domain.toLowerCase(),
        logo,
        address,
        contactInfo: {
          ...contactInfo,
          email: contactInfo?.email?.toLowerCase()
        },
        ceo: {
          name: ceo.name,
          email: ceo.email.toLowerCase(),
          signature: ceo.signature || '',
          bio: ceo.bio || '',
          profileImage: ceo.profileImage || ''
        },
        settings: {
          ceoTalk: {
            Message:
              settings?.ceoTalk?.Message ||
              "Thank you for reaching out. Your success is our priority. We will get back to you soon."
          },
          recipients: settings?.recipients || { to: [], cc: [], bcc: [] },
          sender: settings?.sender || {},
          gracePeriod: settings?.gracePeriod != null ? Number(settings.gracePeriod) : 15
        }
      });

      const savedCompany = await newCompany.save();

      res.status(201).json({
        success: true,
        message: 'Company initialized successfully',
        data: savedCompany
      });

    } catch (error) {
      console.error('Error initializing company:', error);
      res.status(500).json({
        success: false,
        message: 'Error initializing company',
        error: error.message
      });
    }
  }

  // Update company info
  async updateCompanyInfo(req, res) {
    try {
      const updateData = {};
      
      console.log('Request body:', req.body);
      //console.log('Uploaded file:', req.file);
      
      // Helper function to safely set nested properties
      const setNestedProperty = (obj, path, value) => {
        if (!value && value !== 0 && value !== false) return; // Skip empty values
        
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
      };

      Object.keys(req.body).forEach(key => {
        const value = req.body[key];
        
        if (value && typeof value === 'string' && value.trim() !== '') {
          setNestedProperty(updateData, key, value.trim());
        } else if (value && typeof value !== 'string') {
          setNestedProperty(updateData, key, value);
        }
      });
      const contactInfo = JSON.parse(updateData.contactInfo);
      if (contactInfo?.email) {
        contactInfo.email = contactInfo.email.toLowerCase();
      }
      updateData.contactInfo = contactInfo;
      if (updateData.domain) {
        updateData.domain = updateData.domain.toLowerCase();
      }
      if (updateData.ceo?.email) {
        updateData.ceo.email = updateData.ceo.email.toLowerCase();
      }

      if (req.file) {
        const baseUrl = process.env.FRONT_BASE_URL || 'http://localhost:5000';
        
        if (!updateData.ceo) {
          updateData.ceo = {};
        }
        
        updateData.ceo.profileImage = `${baseUrl}/uploads/profilepicture/${req.file.filename}`;
      }

      console.log('Final update data:', JSON.stringify(updateData, null, 2));

      // Find existing company first to merge data properly
      const existingCompany = await companyDetails.findOne({});
      
      if (!existingCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found. Please initialize company first.'
        });
      }

      // Perform the update
      const updatedCompany = await companyDetails.findOneAndUpdate(
        { _id: existingCompany._id },
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          // This option helps with nested object updates
          overwrite: false
        }
      );

      res.status(200).json({
        success: true,
        message: 'Company information updated successfully',
        data: updatedCompany
      });

    } catch (error) {
      console.error('Error updating company:', error);
      
      // More specific error handling
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate key error. Company domain might already exist.'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating company information',
        error: error.message
      });
    }
  }


  // Update CEO Talk message
  async updateCeoTalkMessage(req, res) {
    try {
      const { message } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'CEO Talk message is required'
        });
      }

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $set: {
            'settings.ceoTalk.Message': message.trim(),
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'CEO Talk message updated successfully',
        data: {
          ceoTalkMessage: updatedCompany.settings.ceoTalk.Message
        }
      });

    } catch (error) {
      console.error('Error updating CEO Talk message:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating CEO Talk message',
        error: error.message
      });
    }
  }

  // Add recipient to email settings
  async addRecipient(req, res) {
    try {
      const { type, recipientData } = req.body; // type: 'to', 'cc', 'bcc'

      if (!['to', 'cc', 'bcc'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient type. Must be "to", "cc", or "bcc"'
        });
      }

      // Make sure email is provided
      if (!recipientData?.email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Normalize email
      const email = recipientData.email.toLowerCase().trim();

      // Optional: Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const name = (recipientData.name || '').trim();

      const company = await companyDetails.findOne();
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      // Initialize recipients if missing
      if (!company.settings.recipients) {
        company.settings.recipients = { to: [], cc: [], bcc: [] };
      }

      // Check for duplicate by email only
      const exists = company.settings.recipients[type].some(
        r => r.email.toLowerCase() === email
      );

      if (exists) {
        return res.status(400).json({
          success: false,
          message: `Recipient already exists in ${type} list`
        });
      }

      // Push only name and email
      company.settings.recipients[type].push({ name, email });
      await company.save();

      res.status(200).json({
        success: true,
        message: `Recipient added to ${type} list successfully`,
        data: company.settings.recipients
      });

    } catch (error) {
      console.error('Error adding recipient:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding recipient',
        error: error.message
      });
    }
  }

  // Remove recipient from email settings
  async removeRecipient(req, res) {
    try {
      const { recipientId } = req.params;
      const { type } = req.body; // type: 'to', 'cc', 'bcc'

      if (!['to', 'cc', 'bcc'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipient type. Must be "to", "cc", or "bcc"'
        });
      }

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $pull: {
            [`settings.recipients.${type}`]: { _id: recipientId }
          }
        },
        { new: true }
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: `Recipient removed from ${type} list successfully`,
        data: updatedCompany.settings.recipients
      });

    } catch (error) {
      console.error('Error removing recipient:', error);
      res.status(500).json({
        success: false,
        message: 'Error removing recipient',
        error: error.message
      });
    }
  }

  // Update email sender information
  async updateSender(req, res) {
    try {
      const senderData = req.body;

      // Validate sender user exists
      if (senderData.userId) {
        const User = mongoose.model('User');
        const senderUser = await User.findById(senderData.userId);
        if (!senderUser) {
          return res.status(400).json({
            success: false,
            message: 'Sender user not found',
            error: 'SENDER_NOT_FOUND'
          });
        }
      }

      // Normalize email
      if (senderData.email) {
        senderData.email = senderData.email.toLowerCase();
      }

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $set: {
            'settings.sender': senderData,
            updatedAt: new Date()
          }
        },
        { new: true }
      ).populate('settings.sender.userId', 'firstName lastName email');

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Sender information updated successfully',
        data: updatedCompany.settings.sender
      });

    } catch (error) {
      console.error('Error updating sender:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating sender information',
        error: error.message
      });
    }
  }

  // Get leave allocation for a specific leave type
  async getLeaveAllocation(req, res) {
    try {
      const { leaveType } = req.query;

      const company = await companyDetails.findOne();
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      if (!leaveType) {
        return res.status(400).json({
          success: false,
          message: 'Leave type is required'
        });
      }

      const allocation = company.getLeaveAllocation(leaveType);

      res.status(200).json({
        success: true,
        data: {
          leaveType,
          allocation
        }
      });

    } catch (error) {
      console.error('Error getting leave allocation:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting leave allocation',
        error: error.message
      });
    }
  }

  // Get all leave allocations
  async getAllLeaveAllocations(req, res) {
    try {
      const company = await companyDetails.findOne();
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      const leaveTypes = ['casual', 'medical', 'paid'];
      const allocations = {};

      leaveTypes.forEach(type => {
        allocations[type] = company.getLeaveAllocation(type);
      });

      res.status(200).json({
        success: true,
        data: allocations
      });

    } catch (error) {
      console.error('Error getting leave allocations:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting leave allocations',
        error: error.message
      });
    }
  }

  // Update leave allocation
  async updateLeaveAllocation(req, res) {
    try {
      const { leaveType, allocation } = req.body;

      if (!leaveType || allocation === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Leave type and allocation are required'
        });
      }

      if (allocation < 0) {
        return res.status(400).json({
          success: false,
          message: 'Allocation cannot be negative'
        });
      }

      const updatePath = `settings.leaves.${leaveType}Leaves`;

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $set: {
            [updatePath]: allocation,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Leave allocation updated successfully',
        data: {
          leaveType,
          allocation: updatedCompany.getLeaveAllocation(leaveType)
        }
      });

    } catch (error) {
      console.error('Error updating leave allocation:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating leave allocation',
        error: error.message
      });
    }
  }

  // Get company statistics and overview
  async getCompanyStats(req, res) {
    try {
      const company = await companyDetails.findOne();
      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      // Get employee count (assuming Employee model exists)
      let employeeCount = 0;
      let departmentCount = 0;
      let designationCount = 0;

      try {
        const Employee = mongoose.model('Employee');
        employeeCount = await Employee.countDocuments({ isActive: true });
      } catch (error) {
        console.log('Employee model not found or error counting employees');
      }

      try {
        const Department = mongoose.model('Department');
        departmentCount = await Department.countDocuments({ isActive: true });
      } catch (error) {
        console.log('Department model not found');
      }

      try {
        const Designation = mongoose.model('Designation');
        designationCount = await Designation.countDocuments({ isActive: true });
      } catch (error) {
        console.log('Designation model not found');
      }

      const stats = {
        basic: {
          name: company.name,
          domain: company.domain,
          createdAt: company.createdAt,
          lastUpdated: company.updatedAt
        },
        contact: {
          hasPhone: !!company.contactInfo?.phone,
          hasEmail: !!company.contactInfo?.email,
          hasWebsite: !!company.contactInfo?.website,
          hasCompleteAddress: !!(
            company.address?.street &&
            company.address?.city &&
            company.address?.country
          )
        },
        settings: {
          hasCeoTalkMessage: !!company.settings?.ceoTalk?.Message,
          recipientCounts: {
            to: company.settings?.recipients?.to?.length || 0,
            cc: company.settings?.recipients?.cc?.length || 0,
            bcc: company.settings?.recipients?.bcc?.length || 0
          },
          hasSender: !!company.settings?.sender?.userId
        },
        metrics: {
          employeeCount,
          departmentCount,
          designationCount,
          profileCompleteness: this.calculateProfileCompleteness(company)
        },
        leaveAllocations: {
          casual: company.getLeaveAllocation('casual'),
          medical: company.getLeaveAllocation('medical'),
          paid: company.getLeaveAllocation('paid')
        }
      };

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error getting company stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting company statistics',
        error: error.message
      });
    }
  }

  // Update company address
  async updateAddress(req, res) {
    try {
      const addressData = req.body;

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $set: {
            address: addressData,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company address updated successfully',
        data: updatedCompany.address
      });

    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating company address',
        error: error.message
      });
    }
  }

  // Update contact information
  async updateContactInfo(req, res) {
    try {
      const contactData = req.body;

      // Normalize email
      if (contactData.email) {
        contactData.email = contactData.email.toLowerCase();
      }

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {},
        {
          $set: {
            contactInfo: contactData,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Contact information updated successfully',
        data: updatedCompany.contactInfo
      });

    } catch (error) {
      console.error('Error updating contact info:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating contact information',
        error: error.message
      });
    }
  }

  // Helper method to calculate profile completeness
  calculateProfileCompleteness(company) {
    const fields = [
      company.name,
      company.domain,
      company.logo,
      company.address?.street,
      company.address?.city,
      company.address?.country,
      company.contactInfo?.phone,
      company.contactInfo?.email,
      company.contactInfo?.website,
      company.ceo?.userId,
      company.ceo?.bio,
      company.settings?.ceoTalk?.Message
    ];

    const completedFields = fields.filter(field => field && field !== '').length;
    return Math.round((completedFields / fields.length) * 100);
  }

  // Check if company exists (health check)
  async checkCompanyExists(req, res) {
    try {
      const company = await companyDetails.findOne().select('name domain');

      res.status(200).json({
        success: true,
        exists: !!company,
        data: company ? { name: company.name, domain: company.domain } : null
      });

    } catch (error) {
      console.error('Error checking company existence:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking company',
        error: error.message
      });
    }
  }

  // CREATE one component: POST /company/payroll/components
  async createPayrollComponent(req, res) {
    try {
      // Accept only the allowed fields
      const raw = req.body || {};
      const component = {
        name: String(raw.name || '').trim(),
        code: String(raw.code || '').trim().toLowerCase(),
        percent: raw.percent != null ? Number(raw.percent) : undefined,
        isActive: raw.isActive === false ? false : true
      };

      // Basic validation (keep schema as-is)
      if (!component.name || !component.code) {
        return res.status(400).json({ success: false, message: 'name and code are required' });
      }
      // Restrict to your enum in schema
      // if (!['basic', 'hra', 'allowances'].includes(component.code)) {
      //   return res.status(400).json({ success: false, message: 'code must be one of: basic, hra, allowances' });
      // }
      if (component.percent == null || Number.isNaN(component.percent)) {
        return res.status(400).json({ success: false, message: 'percent is required and must be a number' });
      }
      if (component.percent < 0 || component.percent > 100) {
        return res.status(400).json({ success: false, message: 'percent must be between 0 and 100' });
      }

      const company = await companyDetails.findOne();
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      const list = company?.settings?.payroll?.components || [];
      if (list.some(c => (c.code || '').toLowerCase() === component.code)) {
        return res.status(400).json({ success: false, message: `Component with code "${component.code}" already exists` });
      }

      list.push(component);
      company.set('settings.payroll.components', list);
      company.set('updatedAt', new Date());
      await company.save();

      res.status(201).json({ success: true, data: component, components: list });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to create component', error: err.message });
    }
  }

  // FIXED BULK UPDATE: PUT /company/payroll/components
  // Replaces the entire components array (your original intent), but with strict validation & normalization.
  async updatePayrollComponents(req, res) {
    try {
      const { components } = req.body;
      if (!Array.isArray(components)) {
        return res.status(400).json({ success: false, message: 'components must be an array' });
      }

      // Normalize + validate
      const seen = new Set();
      const cleaned = components.map((raw, idx) => {
        const item = {
          name: String(raw.name || '').trim(),
          code: String(raw.code || '').trim().toLowerCase(),
          percent: raw.percent != null ? Number(raw.percent) : undefined,
          isActive: raw.isActive === false ? false : true
        };

        if (!item.name || !item.code) {
          throw new Error(`Row ${idx + 1}: name and code are required`);
        }
        if (!['basic', 'hra', 'allowances'].includes(item.code)) {
          throw new Error(`Row ${idx + 1}: code must be one of: basic, hra, allowances`);
        }
        if (seen.has(item.code)) {
          throw new Error(`Duplicate code: ${item.code}`);
        }
        seen.add(item.code);

        if (item.percent == null || Number.isNaN(item.percent)) {
          throw new Error(`Row ${idx + 1}: percent is required and must be a number`);
        }
        if (item.percent < 0 || item.percent > 100) {
          throw new Error(`Row ${idx + 1}: percent must be between 0 and 100`);
        }
        return item;
      });

      const updated = await companyDetails.findOneAndUpdate(
        {},
        { $set: { 'settings.payroll.components': cleaned, updatedAt: new Date() } },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      res.json({ success: true, data: updated.settings.payroll.components });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Failed to update components', error: err.message });
    }
  }

  // PATCH one by code: PATCH /company/payroll/components/:code
  // Partial update (name/percent/isActive). Does NOT allow changing code.
  async patchPayrollComponent(req, res) {
    try {
      const code = String(req.params.code || '').toLowerCase();
      if (!['basic', 'hra', 'allowances'].includes(code)) {
        return res.status(400).json({ success: false, message: 'code must be one of: basic, hra, allowances' });
      }

      const updates = {};
      if (req.body.name != null) updates.name = String(req.body.name).trim();
      if (req.body.percent != null) {
        const p = Number(req.body.percent);
        if (Number.isNaN(p) || p < 0 || p > 100) {
          return res.status(400).json({ success: false, message: 'percent must be a number between 0 and 100' });
        }
        updates.percent = p;
      }
      if (req.body.isActive != null) updates.isActive = !!req.body.isActive;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
      }

      // Build $set with arrayFilters to update the matching item by code
      const $set = {};
      for (const [k, v] of Object.entries(updates)) {
        $set[`settings.payroll.components.$[elem].${k}`] = v;
      }

      const doc = await companyDetails.findOneAndUpdate(
        {},
        { $set, $currentDate: { updatedAt: true } },
        { new: true, arrayFilters: [{ 'elem.code': code }] }
      );

      const list = doc?.settings?.payroll?.components || [];
      const exists = list.some(c => (c.code || '').toLowerCase() === code);
      if (!exists) {
        return res.status(404).json({ success: false, message: `Component with code "${code}" not found` });
      }

      res.json({ success: true, data: list.find(c => c.code.toLowerCase() === code), components: list });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to patch component', error: err.message });
    }
  }

  // DELETE one by code: DELETE /company/payroll/components/:code
  async deletePayrollComponent(req, res) {
    try {
      const code = String(req.params.code || '').toLowerCase();
      const doc = await companyDetails.findOne();
      if (!doc) return res.status(404).json({ success: false, message: 'Company not found' });

      const list = doc.settings?.payroll?.components || [];
      const next = list.filter(c => (c.code || '').toLowerCase() !== code);
      if (next.length === list.length) {
        return res.status(404).json({ success: false, message: `Component with code "${code}" not found` });
      }

      doc.set('settings.payroll.components', next);
      doc.set('updatedAt', new Date());
      await doc.save();

      res.json({ success: true, message: 'Component deleted', components: next });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete component', error: err.message });
    }
  }

  // READ all: GET /company/payroll/components
  async getPayrollComponents(req, res) {
    try {
      const company = await companyDetails.findOne();
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
      res.json({ success: true, data: company.settings?.payroll?.components || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch components', error: err.message });
    }
  }

}

module.exports = new CompanyController();
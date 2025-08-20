const { companyDetails } = require('../models/Company');
const mongoose = require('mongoose');

class CompanyController {
  // Get company details (there's only one company)
  async getCompanyDetails(req, res) {
    try {
      const company = await companyDetails.findOne()
        .populate('ceo.userId', 'firstName lastName email profile')
        .populate('settings.recipients.to.name', 'firstName lastName email')
        .populate('settings.recipients.cc.name', 'firstName lastName email')
        .populate('settings.recipients.bcc.name', 'firstName lastName email')
        .populate('settings.sender.userId', 'firstName lastName email');

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found. Please initialize company details.'
        });
      }

      res.status(200).json({
        success: true,
        data: company
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
      // Check if company already exists
      const existingCompany = await companyDetails.findOne();
      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Company already exists',
          data: existingCompany
        });
      }

      const {
        name,
        domain,
        logo,
        address,
        contactInfo,
        ceo,
        settings
      } = req.body;

      // Validate required fields
      if (!name || !domain || !ceo?.userId) {
        return res.status(400).json({
          success: false,
          message: 'Company name, domain, and CEO are required'
        });
      }

      // Validate CEO user exists
      const User = mongoose.model('User');
      const ceoUser = await User.findById(ceo.userId);
      if (!ceoUser) {
        return res.status(400).json({
          success: false,
          message: 'CEO user not found',
          error: 'CEO_NOT_FOUND'
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
        ceo,
        settings: {
          ceoTalk: {
            Message: settings?.ceoTalk?.Message || "Thank you for reaching out. Your success is our priority. We will get back to you soon."
          },
          recipients: settings?.recipients || { to: [], cc: [], bcc: [] },
          sender: settings?.sender || {}
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

  // Update company basic information
  async updateCompanyInfo(req, res) {
    try {
      const updateData = req.body;

      // Normalize email fields
      if (updateData.contactInfo?.email) {
        updateData.contactInfo.email = updateData.contactInfo.email.toLowerCase();
      }

      if (updateData.domain) {
        updateData.domain = updateData.domain.toLowerCase();
      }

      // If CEO is being updated, validate user exists
      if (updateData.ceo?.userId) {
        const User = mongoose.model('User');
        const ceoUser = await User.findById(updateData.ceo.userId);
        if (!ceoUser) {
          return res.status(400).json({
            success: false,
            message: 'CEO user not found',
            error: 'CEO_NOT_FOUND'
          });
        }
      }

      const updatedCompany = await companyDetails.findOneAndUpdate(
        {}, // Empty filter to find the single company
        { $set: updateData },
        { 
          new: true, 
          runValidators: true,
          upsert: false // Don't create if not exists, should use initialize instead
        }
      ).populate('ceo.userId', 'firstName lastName email profile');

      if (!updatedCompany) {
        return res.status(404).json({
          success: false,
          message: 'Company not found. Please initialize company first.'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Company information updated successfully',
        data: updatedCompany
      });

    } catch (error) {
      console.error('Error updating company:', error);
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
}

module.exports = new CompanyController();
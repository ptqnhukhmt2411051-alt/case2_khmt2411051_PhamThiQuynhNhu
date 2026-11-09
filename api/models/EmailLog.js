const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    emailType: {
      type: String,
      required: true,
      enum: [
        'assignment',
        'share',
        'update',
        'completed',
        'reminder'
      ]
    },

    subject: {
      type: String,
      default: ''
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },

    taskTitle: {
      type: String,
      default: ''
    },

    status: {
      type: String,
      required: true,
      enum: ['success', 'failed']
    },

    messageId: {
      type: String,
      default: null
    },

    errorMessage: {
      type: String,
      default: null
    },

    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Tìm lịch sử theo email và thời gian nhanh hơn
emailLogSchema.index({
  recipientEmail: 1,
  sentAt: -1
});

emailLogSchema.index({
  task: 1,
  sentAt: -1
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
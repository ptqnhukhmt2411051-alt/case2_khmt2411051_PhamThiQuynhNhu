
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ''
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },


     // Người được giao chính (giữ tương thích với chức năng B)
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },

        // Danh sách những người được giao công việc (chức năng C)
        assignedUsers: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          }
        ],

    acceptedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    // Danh sách người được chia sẻ kèm quyền truy cập
    sharedPermissions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        permission: {
          type: String,
          enum: ['viewer', 'editor'],
          default: 'viewer'
        }
      }
    ],

    status: {
      type: String,
      enum: ['todo', 'in_progress', 'completed'],
      default: 'todo'
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },

    startDate: {
      type: Date,
      default: null
    },

 startDate: {
      type: Date,
      default: null
    },

    dueDate: {
      type: Date,
      default: null
    },

    // Luu ngay han da gui email nhac viec
    reminderSentForDueDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Task', taskSchema);
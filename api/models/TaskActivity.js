
const mongoose = require('mongoose');

const taskActivitySchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },

    // Luu ten cong viec de van xem duoc lich su neu task bi xoa
    taskTitle: {
      type: String,
      default: ''
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    action: {
      type: String,
      required: true
    },

    description: {
      type: String,
      required: true
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

taskActivitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);

const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    default: 'Untitled Recording' 
  },
  category: { 
    type: String, 
    default: 'General' 
  },
  audioUrl: { 
    type: String, 
    default: '' 
  },
  transcription: { 
    type: String, 
    default: '' 
  },
  summary: { 
    type: String, 
    default: '' 
  },
  keyPoints: [{ 
    type: String 
  }],
  status: { 
    type: String, 
    enum: ['processing', 'completed', 'failed'], 
    default: 'processing' 
  },
  duration: { 
  type: Number, 
  default: 0 // Duration in seconds
}
}, { timestamps: true });

module.exports = mongoose.model('Note', noteSchema);
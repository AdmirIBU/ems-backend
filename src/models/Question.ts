import mongoose, { Document, Model } from 'mongoose';

export interface IQuestion extends Document {
  course: mongoose.Types.ObjectId;
  type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload';
  content: string;
  options?: string[]; // for multiple-choice
  points?: number;
  // for multiple-choice: string (one of options); for tf: boolean
  correctAnswer?: any;
  createdBy?: mongoose.Types.ObjectId;
}

const questionSchema = new mongoose.Schema<IQuestion>(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    type: { type: String, enum: ['essay', 'multiple-choice', 'tf', 'image-upload'], required: true },
    content: { type: String, required: true },
    options: [{ type: String }],
    points: { type: Number, default: 1 },
    correctAnswer: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Question: Model<IQuestion> = mongoose.model<IQuestion>('Question', questionSchema);
export default Question;

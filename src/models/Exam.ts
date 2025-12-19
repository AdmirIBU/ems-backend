import mongoose, { Document, Model } from 'mongoose';

export interface IExam extends Document {
  title: string;
  description?: string;
  date: Date;
  durationMinutes?: number;
  createdBy?: mongoose.Types.ObjectId;
}

const examSchema = new mongoose.Schema<IExam>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    date: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

const Exam: Model<IExam> = mongoose.model<IExam>('Exam', examSchema);
export default Exam;

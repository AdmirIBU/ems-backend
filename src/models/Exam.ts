import mongoose, { Document, Model } from 'mongoose';

export interface IExam extends Document {
  title: string;
  description?: string;
  date: Date;
  examType?: string;
  numQuestions?: number;
  durationMinutes?: number;
  course?: mongoose.Types.ObjectId;
  questionIds?: mongoose.Types.ObjectId[];
  questionSelectionMode?: 'manual' | 'random';
  randomQuestionConfig?: {
    mcCount?: number;
    tfCount?: number;
    imageCount?: number;
    essayCount?: number;
    randomizePerStudent?: boolean;
    shuffleOrder?: boolean;
  };
  published?: boolean;
  publishedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
}

const examSchema = new mongoose.Schema<IExam>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    date: { type: Date, required: true },
    examType: { type: String },
    numQuestions: { type: Number },
    durationMinutes: { type: Number, default: 60 },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    questionSelectionMode: { type: String, enum: ['manual', 'random'], default: 'manual' },
    randomQuestionConfig: {
      mcCount: { type: Number, default: 0 },
      tfCount: { type: Number, default: 0 },
      imageCount: { type: Number, default: 0 },
      essayCount: { type: Number, default: 0 },
      randomizePerStudent: { type: Boolean, default: true },
      shuffleOrder: { type: Boolean, default: true },
    },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

const Exam: Model<IExam> = mongoose.model<IExam>('Exam', examSchema);
export default Exam;

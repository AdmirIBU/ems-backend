import mongoose, { Document, Model } from 'mongoose';

export interface IAttemptAnswer {
  question?: mongoose.Types.ObjectId;
  answer: any;
  isCorrect?: boolean;
  pointsAwarded?: number;
  maxPoints?: number;
}

export interface IExamAttempt extends Document {
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  startedAt: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  questionIds?: mongoose.Types.ObjectId[];
  answers: IAttemptAnswer[];
  pointsAwarded?: number;
  pointsTotal?: number;
  needsReview?: boolean;
  reviewRequested?: boolean;
  reviewRequestedAt?: Date;
  reviewRequestMessage?: string;
  reviewResponseMessage?: string;
  reviewAppointmentAt?: Date;
  reviewRespondedAt?: Date;
  reviewRespondedBy?: mongoose.Types.ObjectId;
  gradedAt?: Date;
  gradedBy?: mongoose.Types.ObjectId;
}

const attemptAnswerSchema = new mongoose.Schema<IAttemptAnswer>(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    answer: { type: mongoose.Schema.Types.Mixed },
    isCorrect: { type: Boolean },
    pointsAwarded: { type: Number },
    maxPoints: { type: Number },
  },
  { _id: false }
);

const examAttemptSchema = new mongoose.Schema<IExamAttempt>(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    submittedAt: { type: Date },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    answers: { type: [attemptAnswerSchema], default: [] },
    pointsAwarded: { type: Number, default: 0 },
    pointsTotal: { type: Number, default: 0 },
    needsReview: { type: Boolean, default: false },
    reviewRequested: { type: Boolean, default: false },
    reviewRequestedAt: { type: Date },
    reviewRequestMessage: { type: String },
    reviewResponseMessage: { type: String },
    reviewAppointmentAt: { type: Date },
    reviewRespondedAt: { type: Date },
    reviewRespondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

examAttemptSchema.index({ exam: 1, student: 1 }, { unique: true });

const ExamAttempt: Model<IExamAttempt> = mongoose.model<IExamAttempt>('ExamAttempt', examAttemptSchema);
export default ExamAttempt;

import mongoose, { Document, Model } from 'mongoose';

export interface ISyllabus {
  filename: string;
  originalName: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface ICourse extends Document {
  title: string;
  courseCode?: string;
  ects?: number;
  description?: string;
  syllabus?: ISyllabus;
  professors?: mongoose.Types.ObjectId[];
  materials?: Array<{
    _id?: any;
    title: string;
    kind: 'lecture' | 'lab' | 'video' | 'other';
    filename: string;
    originalName: string;
    storagePath: string;
    mimetype: string;
    size: number;
    uploadedAt: Date;
    uploadedBy?: mongoose.Types.ObjectId;
  }>;
  students: mongoose.Types.ObjectId[];
  enrollmentRequests?: { student: mongoose.Types.ObjectId; requestedAt: Date }[];
  createdBy?: mongoose.Types.ObjectId;
}

const courseSchema = new mongoose.Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    courseCode: { type: String, trim: true },
    ects: { type: Number },
    description: { type: String },
    syllabus: {
      filename: String,
      originalName: String,
      path: String,
      mimetype: String,
      size: Number,
    },
    professors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    materials: [
      {
        title: { type: String, required: true, trim: true },
        kind: { type: String, enum: ['lecture', 'lab', 'video', 'other'], default: 'other' },
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        storagePath: { type: String, required: true },
        mimetype: { type: String, required: true },
        size: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    enrollmentRequests: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Course: Model<ICourse> = mongoose.model<ICourse>('Course', courseSchema);
export default Course; 

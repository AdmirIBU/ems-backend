import { Request, Response, NextFunction } from 'express';
import Exam from '../models/Exam';

export const createExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, date, durationMinutes } = req.body as { title: string; description?: string; date: string; durationMinutes?: number };
    const exam = new Exam({ title, description, date: new Date(date), durationMinutes, createdBy: (req as any).user._id });
    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
};

export const getExams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exams = await Exam.find().populate('createdBy', 'name email').exec();
    res.json(exams);
  } catch (err) {
    next(err);
  }
};

export const getExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('createdBy', 'name email').exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const updateExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    Object.assign(exam, req.body);
    await exam.save();
    res.json(exam);
  } catch (err) {
    next(err);
  }
};

export const deleteExam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exam = await Exam.findById(req.params.id).exec();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    await exam.deleteOne();
    res.json({ msg: 'Exam removed' });
  } catch (err) {
    next(err);
  }
};

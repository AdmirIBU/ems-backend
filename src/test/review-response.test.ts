import request from 'supertest'

import { createApp } from '../app'
import { signToken } from './helpers'

import User from '../models/User'
import Exam from '../models/Exam'
import ExamAttempt from '../models/ExamAttempt'

describe('PATCH /api/exams/attempts/:attemptId/review-response', () => {
  it('professor can respond with appointment and message', async () => {
    const student = await User.create({ name: 'S', email: 's@example.com', password: 'password123', role: 'student' })
    const professor = await User.create({ name: 'P', email: 'p@example.com', password: 'password123', role: 'professor' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      reviewRequested: true,
      reviewRequestedAt: new Date(),
      reviewRequestMessage: 'Can we discuss?',
    })

    const token = signToken(String(professor._id))
    const appointment = new Date(Date.now() + 60 * 60 * 1000)

    const res = await request(createApp())
      .patch(`/api/exams/attempts/${attempt._id}/review-response`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentAt: appointment.toISOString(),
        message: 'Sure, see you then.',
      })

    expect(res.status).toBe(200)
    expect(res.body.reviewAppointmentAt).toBeTruthy()
    expect(res.body.reviewResponseMessage).toBe('Sure, see you then.')
    expect(res.body.reviewRespondedAt).toBeTruthy()

    const updated = await ExamAttempt.findById(attempt._id).exec()
    expect((updated as any).reviewAppointmentAt).toBeTruthy()
    expect((updated as any).reviewResponseMessage).toBe('Sure, see you then.')
    expect((updated as any).reviewRespondedAt).toBeTruthy()
    expect(String((updated as any).reviewRespondedBy)).toBe(String(professor._id))
  })

  it('professor cannot respond when there is no review request', async () => {
    const student = await User.create({ name: 'S', email: 's5@example.com', password: 'password123', role: 'student' })
    const professor = await User.create({ name: 'P', email: 'p2@example.com', password: 'password123', role: 'professor' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      reviewRequested: false,
    })

    const token = signToken(String(professor._id))

    const res = await request(createApp())
      .patch(`/api/exams/attempts/${attempt._id}/review-response`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'ok' })

    expect(res.status).toBe(400)
  })

  it('professor gets 400 on invalid appointmentAt', async () => {
    const student = await User.create({ name: 'S', email: 's6@example.com', password: 'password123', role: 'student' })
    const professor = await User.create({ name: 'P', email: 'p3@example.com', password: 'password123', role: 'professor' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      reviewRequested: true,
      reviewRequestedAt: new Date(),
    })

    const token = signToken(String(professor._id))

    const res = await request(createApp())
      .patch(`/api/exams/attempts/${attempt._id}/review-response`)
      .set('Authorization', `Bearer ${token}`)
      .send({ appointmentAt: 'not-a-date', message: 'hi' })

    expect(res.status).toBe(400)
  })

  it('professor can clear appointment and response message by sending nulls', async () => {
    const student = await User.create({ name: 'S', email: 's7@example.com', password: 'password123', role: 'student' })
    const professor = await User.create({ name: 'P', email: 'p4@example.com', password: 'password123', role: 'professor' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      reviewRequested: true,
      reviewRequestedAt: new Date(),
      reviewAppointmentAt: new Date(),
      reviewResponseMessage: 'Initial',
    })

    const token = signToken(String(professor._id))

    const res = await request(createApp())
      .patch(`/api/exams/attempts/${attempt._id}/review-response`)
      .set('Authorization', `Bearer ${token}`)
      .send({ appointmentAt: null, message: null })

    expect(res.status).toBe(200)

    const updated = await ExamAttempt.findById(attempt._id).exec()
    expect((updated as any).reviewAppointmentAt).toBeUndefined()
    expect((updated as any).reviewResponseMessage).toBeUndefined()
    expect((updated as any).reviewRespondedAt).toBeTruthy()
    expect(String((updated as any).reviewRespondedBy)).toBe(String(professor._id))
  })

  it('student cannot respond to review request (forbidden)', async () => {
    const student = await User.create({ name: 'S', email: 's8@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      reviewRequested: true,
      reviewRequestedAt: new Date(),
    })

    const token = signToken(String(student._id))

    const res = await request(createApp())
      .patch(`/api/exams/attempts/${attempt._id}/review-response`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'nope' })

    expect(res.status).toBe(403)
  })
})

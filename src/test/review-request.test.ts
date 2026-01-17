import request from 'supertest'

import { createApp } from '../app'
import { signToken } from './helpers'

import User from '../models/User'
import Exam from '../models/Exam'
import ExamAttempt from '../models/ExamAttempt'

describe('POST /api/exams/attempts/:attemptId/request-review', () => {
  it('student can request a review with optional message', async () => {
    const student = await User.create({ name: 'S', email: 's@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
      pointsAwarded: 5,
      pointsTotal: 10,
    })

    const token = signToken(String(student._id))

    const res = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Please review question 2.' })

    expect(res.status).toBe(200)
    expect(res.body.reviewRequested).toBe(true)
    expect(res.body.reviewRequestedAt).toBeTruthy()

    const updated = await ExamAttempt.findById(attempt._id).exec()
    expect((updated as any).reviewRequested).toBe(true)
    expect((updated as any).reviewRequestedAt).toBeTruthy()
    expect((updated as any).reviewRequestMessage).toBe('Please review question 2.')
  })

  it('student can request a review without a message', async () => {
    const student = await User.create({ name: 'S', email: 's2@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
    })

    const token = signToken(String(student._id))

    const res = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(res.status).toBe(200)

    const updated = await ExamAttempt.findById(attempt._id).exec()
    expect((updated as any).reviewRequested).toBe(true)
    expect((updated as any).reviewRequestMessage).toBeUndefined()
  })

  it('student cannot request review when attempt is not submitted', async () => {
    const student = await User.create({ name: 'S', email: 's3@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      answers: [],
    })

    const token = signToken(String(student._id))

    const res = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Please review' })

    expect(res.status).toBe(400)
  })

  it('student cannot request review twice', async () => {
    const student = await User.create({ name: 'S', email: 's4@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
    })

    const token = signToken(String(student._id))

    const r1 = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'first' })
    expect(r1.status).toBe(200)

    const r2 = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'second' })
    expect(r2.status).toBe(400)
  })

  it("student cannot request review for someone else's attempt", async () => {
    const owner = await User.create({ name: 'Owner', email: 'o@example.com', password: 'password123', role: 'student' })
    const other = await User.create({ name: 'Other', email: 'x@example.com', password: 'password123', role: 'student' })
    const exam = await Exam.create({ title: 'Exam 1', date: new Date() })
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: owner._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
    })

    const token = signToken(String(other._id))

    const res = await request(createApp())
      .post(`/api/exams/attempts/${attempt._id}/request-review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hi' })

    expect(res.status).toBe(403)
  })
})
